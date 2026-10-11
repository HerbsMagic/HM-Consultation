// backend/.env first, then the repo-root .env (shared RAZORPAY_KEY_ID); first value wins
require('dotenv').config({ path: [require('path').join(__dirname, '.env'), require('path').join(__dirname, '..', '.env')] });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// MOCK MODE: Activated when no real Razorpay secret is provided.
// This lets you test the full UI booking flow locally without real payment keys.
const MOCK_MODE = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'your_test_secret_here';
if (MOCK_MODE && process.env.NODE_ENV === 'production') {
  // Fail closed: mock mode skips signature verification, so never allow it in production.
  console.error('FATAL: RAZORPAY_KEY_SECRET is not set. Refusing to start in production.');
  process.exit(1);
}
if (MOCK_MODE) {
  console.log('⚠️  MOCK MODE ACTIVE — No real Razorpay secret found. Payments will be simulated.');
}

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json());

// Initialize SQLite Database
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'database.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT,
    email TEXT,
    phone TEXT,
    age TEXT,
    gender TEXT,
    healthGoal TEXT,
    notes TEXT,
    appointmentDate TEXT,
    appointmentTime TEXT,
    consultationFee REAL,
    paymentStatus TEXT,
    razorpayOrderId TEXT,
    razorpayPaymentId TEXT,
    razorpaySignature TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Columns added after the first release (existing databases get them on startup).
const existingColumns = db.prepare('PRAGMA table_info(appointments)').all().map(c => c.name);
if (!existingColumns.includes('status')) db.exec("ALTER TABLE appointments ADD COLUMN status TEXT DEFAULT 'confirmed'");
if (!existingColumns.includes('adminNotes')) db.exec('ALTER TABLE appointments ADD COLUMN adminNotes TEXT');

const APPOINTMENT_STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'];

// A slot is taken by any paid appointment that has not been cancelled.
const findSlotHolder = db.prepare(`
  SELECT id FROM appointments
  WHERE appointmentDate = ? AND appointmentTime = ? AND paymentStatus = 'paid'
    AND COALESCE(status, 'confirmed') != 'cancelled' AND id != ?
`);

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Initialize Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Emails are best-effort: skipped when SMTP is not configured, never block a response.
const sendMail = (options) => {
  if (!process.env.SMTP_HOST) return;
  transporter.sendMail({ from: `"Herbs Magic" <${process.env.SMTP_USER}>`, ...options }).catch(err => {
    console.error('Failed to send email:', err);
  });
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

// Consultation fee is always decided server-side; never trust the client amount.
const getFee = () => {
  const fee = Number(process.env.CONSULTATION_FEE || 499);
  return Number.isFinite(fee) && fee > 0 ? fee : 499;
};

// Admin auth. Two ways in, both sent as "Authorization: Bearer <token>":
//  - a session token from POST /api/admin/login (ADMIN_USERNAME / ADMIN_PASSWORD env), used by the admin panel
//  - the static ADMIN_TOKEN env, for scripts / curl
const ADMIN_SESSION_HOURS = 12;

const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// Derived from the password, so changing ADMIN_PASSWORD signs everyone out.
const sessionSecret = () => crypto.createHash('sha256').update('hm-admin-session|' + process.env.ADMIN_PASSWORD).digest();

const signSession = () => {
  const expiresAt = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt };
};

const verifySession = (token) => {
  if (!process.env.ADMIN_PASSWORD) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
};

const requireAdmin = (req, res, next) => {
  const staticToken = process.env.ADMIN_TOKEN;
  if (!staticToken && !process.env.ADMIN_PASSWORD) return res.status(503).json({ message: 'Admin access not configured' });
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (given && (verifySession(given) || (staticToken && safeEqual(given, staticToken)))) return next();
  res.status(401).json({ message: 'Unauthorized' });
};

// Login throttle: 5 wrong attempts per IP locks that IP out for 15 minutes (in-memory).
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

app.post('/api/admin/login', (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: 'Admin login is not configured' });

  const now = Date.now();
  let entry = loginAttempts.get(req.ip);
  if (entry && entry.resetAt <= now) { loginAttempts.delete(req.ip); entry = undefined; }
  if (entry && entry.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ message: 'Too many attempts. Try again in a few minutes.' });
  }

  const { username, password } = req.body || {};
  const userOk = safeEqual(username || '', process.env.ADMIN_USERNAME || 'admin');
  const passOk = safeEqual(password || '', process.env.ADMIN_PASSWORD);
  if (!userOk || !passOk) {
    loginAttempts.set(req.ip, { count: (entry?.count || 0) + 1, resetAt: entry?.resetAt || now + LOGIN_LOCK_MS });
    return res.status(401).json({ message: 'Wrong username or password' });
  }

  loginAttempts.delete(req.ip);
  res.json(signSession());
});

// Endpoint 1: Get Config
// Frontend uses this to get the consultation fee and razorpay key.
app.get('/api/payments/config', (req, res) => {
  res.json({ 
    consultationFee: getFee(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID
  });
});

// Endpoint 2: Create Razorpay Order
// Called right before opening the Razorpay payment modal on the frontend.
app.post('/api/payments/create-order', async (req, res) => {
  const amount = getFee();

  // Refuse before any money moves if the slot was taken while the form was open.
  const { appointmentDate, appointmentTime } = req.body?.bookingMeta || {};
  if (appointmentDate && appointmentTime && findSlotHolder.get(appointmentDate, appointmentTime, 0)) {
    return res.status(409).json({ message: 'That time slot was just booked. Please choose another slot.' });
  }

  // MOCK MODE: Return a fake order ID for local UI testing
  if (MOCK_MODE) {
    const mockOrderId = 'mock_order_' + Date.now();
    console.log(`[MOCK] Created fake order: ${mockOrderId} for ₹${amount}`);
    return res.json({ id: mockOrderId, amount: amount * 100, currency: 'INR' });
  }

  try {
    const options = {
      amount: amount * 100, // Razorpay amount is in paise (₹1 = 100 paise)
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ message: 'Error creating order' });
  }
});

// Endpoint 3: Verify Payment & Save Appointment
// Called by the frontend after a successful payment through Razorpay.
app.post('/api/b2b-appointments', (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, ...appointmentData } = req.body || {};

  // 1. Verify Payment Signature (Security Step)
  // In MOCK MODE, skip verification entirely for local testing.
  if (!MOCK_MODE) {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + '|' + razorpayPaymentId)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }
  } else {
    console.log(`[MOCK] Skipping signature verification for order: ${razorpayOrderId}`);
  }

  // 2. Save Appointment to SQLite Database
  try {
    // One payment = one booking, so a retried request returns the booking it already made.
    if (razorpayPaymentId) {
      const existing = db.prepare('SELECT id FROM appointments WHERE razorpayPaymentId = ?').get(razorpayPaymentId);
      if (existing) {
        return res.status(200).json({ success: true, message: 'Appointment already booked', bookingId: existing.id });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO appointments (
        fullName, email, phone, age, gender, healthGoal, notes, 
        appointmentDate, appointmentTime, consultationFee, paymentStatus, 
        razorpayOrderId, razorpayPaymentId, razorpaySignature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      appointmentData.fullName, appointmentData.email, appointmentData.phone,
      appointmentData.age, appointmentData.gender, appointmentData.healthGoal,
      appointmentData.notes, appointmentData.appointmentDate, appointmentData.appointmentTime,
      getFee(), 'paid', // set server-side, only reached after signature verification
      razorpayOrderId, razorpayPaymentId, razorpaySignature
    );

    res.status(201).json({ 
      success: true, 
      message: 'Appointment booked successfully',
      bookingId: result.lastInsertRowid
    });

    // 3. Send Email Notification
    sendMail({
      to: [appointmentData.email, process.env.DOCTOR_EMAIL].filter(Boolean).join(', '), // send to patient and doctor
      subject: `Appointment Confirmed: ${appointmentData.fullName}`,
      html: `
        <h3>Your Consultation is Confirmed!</h3>
        <p>Dear ${escapeHtml(appointmentData.fullName)},</p>
        <p>Your appointment has been successfully booked.</p>
        <ul>
          <li><strong>Date:</strong> ${escapeHtml(appointmentData.appointmentDate)}</li>
          <li><strong>Time:</strong> ${escapeHtml(appointmentData.appointmentTime)}</li>
          <li><strong>Goal:</strong> ${escapeHtml(appointmentData.healthGoal)}</li>
        </ul>
        <p>We look forward to speaking with you!</p>
      `
    });

  } catch (dbError) {
    console.error('Error saving appointment:', dbError);
    res.status(500).json({ message: 'Error saving appointment to database' });
  }
});

// Endpoint 4: Get Booked Slots for a Date
// Frontend uses this to disable already booked times
app.get('/api/b2b-appointments/booked-slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const stmt = db.prepare("SELECT appointmentTime FROM appointments WHERE appointmentDate = ? AND paymentStatus = ? AND COALESCE(status, 'confirmed') != 'cancelled'");
    const rows = stmt.all(date, 'paid');
    const bookedSlots = rows.map(r => r.appointmentTime);
    res.json({ bookedSlots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booked slots' });
  }
});

// Endpoint 5: List Bookings for Admin
app.get('/api/b2b-appointments', requireAdmin, (req, res) => {
  const stmt = db.prepare('SELECT * FROM appointments ORDER BY createdAt DESC');
  const appointments = stmt.all();
  res.json({ data: appointments });
});

// Endpoint 6: Update a Booking (Admin) — status, internal notes, reschedule
app.patch('/api/b2b-appointments/:id', requireAdmin, (req, res) => {
  const current = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ message: 'Booking not found' });

  const body = req.body || {};
  const next = {
    status: body.status ?? current.status ?? 'confirmed',
    adminNotes: body.adminNotes ?? current.adminNotes,
    appointmentDate: body.appointmentDate ?? current.appointmentDate,
    appointmentTime: body.appointmentTime ?? current.appointmentTime,
  };

  if (!APPOINTMENT_STATUSES.includes(next.status)) return res.status(400).json({ message: 'Invalid status' });
  if (next.adminNotes != null && (typeof next.adminNotes !== 'string' || next.adminNotes.length > 2000)) {
    return res.status(400).json({ message: 'Notes must be text of at most 2000 characters' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.appointmentDate) || !/^\d{2}:\d{2}$/.test(next.appointmentTime)) {
    return res.status(400).json({ message: 'Date must be YYYY-MM-DD and time HH:MM' });
  }

  const moved = next.appointmentDate !== current.appointmentDate || next.appointmentTime !== current.appointmentTime;
  const reactivated = current.status === 'cancelled' && next.status !== 'cancelled';
  if (next.status !== 'cancelled' && (moved || reactivated) && findSlotHolder.get(next.appointmentDate, next.appointmentTime, current.id)) {
    return res.status(409).json({ message: 'Another booking already holds that date and time' });
  }

  try {
    db.prepare('UPDATE appointments SET status = ?, adminNotes = ?, appointmentDate = ?, appointmentTime = ? WHERE id = ?')
      .run(next.status, next.adminNotes, next.appointmentDate, next.appointmentTime, current.id);
  } catch (dbError) {
    console.error('Error updating appointment:', dbError);
    return res.status(500).json({ message: 'Error updating appointment' });
  }

  // Tell the patient when their time changes
  if (moved && next.status !== 'cancelled' && current.email) {
    sendMail({
      to: current.email,
      subject: 'Your consultation has been rescheduled',
      html: `
        <h3>Your Consultation Has a New Time</h3>
        <p>Dear ${escapeHtml(current.fullName)},</p>
        <p>Your appointment with Herbs Magic has been rescheduled.</p>
        <ul>
          <li><strong>New date:</strong> ${escapeHtml(next.appointmentDate)}</li>
          <li><strong>New time:</strong> ${escapeHtml(next.appointmentTime)} IST</li>
        </ul>
        <p>If this time does not work for you, just reply to this email.</p>
      `
    });
  }

  res.json({ data: db.prepare('SELECT * FROM appointments WHERE id = ?').get(current.id) });
});

// Start Server
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`Server is running on port ${PORT}`);
});
