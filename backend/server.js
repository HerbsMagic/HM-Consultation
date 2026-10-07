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

// Consultation fee is always decided server-side; never trust the client amount.
const getFee = () => {
  const fee = Number(process.env.CONSULTATION_FEE || 499);
  return Number.isFinite(fee) && fee > 0 ? fee : 499;
};

// Simple bearer-token guard for admin endpoints (ADMIN_TOKEN env).
const requireAdmin = (req, res, next) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return res.status(503).json({ message: 'Admin access not configured' });
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

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
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, ...appointmentData } = req.body;

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
    const mailOptions = {
      from: `"Herbs Magic" <${process.env.SMTP_USER}>`,
      to: `${appointmentData.email}, ${process.env.DOCTOR_EMAIL}`, // send to patient and doctor
      subject: `Appointment Confirmed: ${appointmentData.fullName}`,
      html: `
        <h3>Your Consultation is Confirmed!</h3>
        <p>Dear ${appointmentData.fullName},</p>
        <p>Your appointment has been successfully booked.</p>
        <ul>
          <li><strong>Date:</strong> ${appointmentData.appointmentDate}</li>
          <li><strong>Time:</strong> ${appointmentData.appointmentTime}</li>
          <li><strong>Goal:</strong> ${appointmentData.healthGoal}</li>
        </ul>
        <p>We look forward to speaking with you!</p>
      `
    };
    
    transporter.sendMail(mailOptions).catch(err => {
      console.error('Failed to send confirmation email:', err);
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
    const stmt = db.prepare('SELECT appointmentTime FROM appointments WHERE appointmentDate = ? AND paymentStatus = ?');
    const rows = stmt.all(date, 'paid');
    const bookedSlots = rows.map(r => r.appointmentTime);
    res.json({ bookedSlots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booked slots' });
  }
});

// Endpoint 5: (Optional) List Bookings for Admin
app.get('/api/b2b-appointments', requireAdmin, (req, res) => {
  const stmt = db.prepare('SELECT * FROM appointments ORDER BY createdAt DESC');
  const appointments = stmt.all();
  res.json({ data: appointments });
});

// Start Server
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`Server is running on port ${PORT}`);
});
