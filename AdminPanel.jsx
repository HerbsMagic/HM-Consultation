const { useState: useAdmState, useEffect: useAdmEffect, useMemo: useAdmMemo, useCallback: useAdmCallback } = React;

const ADM_API = window.CONSULTATION_API_BASE || '';
const ADM_TOKEN_KEY = 'hm_admin_token';

const admStatuses = {
  confirmed: { label: 'Confirmed', bg: 'var(--bg-success)', color: '#0b6b3a' },
  completed: { label: 'Completed', bg: 'var(--bg-teal)', color: '#0b5a57' },
  cancelled: { label: 'Cancelled', bg: 'var(--tag-rose)', color: '#a12a2a' },
  no_show: { label: 'No-show', bg: 'var(--tag-peach)', color: '#9a4a12' },
};
const admFilters = [['upcoming', 'Upcoming'], ['today', 'Today'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']];

// sessionStorage can throw (private mode / blocked storage) — the panel still works, just without staying signed in.
function admReadToken() { try { return sessionStorage.getItem(ADM_TOKEN_KEY) || ''; } catch (e) { return ''; } }
function admWriteToken(token) {
  try { token ? sessionStorage.setItem(ADM_TOKEN_KEY, token) : sessionStorage.removeItem(ADM_TOKEN_KEY); } catch (e) {}
}

function admTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function admNiceDate(key) {
  if (!key) return '—';
  const d = new Date(key + 'T00:00:00');
  return isNaN(d) ? key : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
// createdAt is stored by SQLite in UTC as "YYYY-MM-DD HH:MM:SS"
function admNiceStamp(stamp) {
  if (!stamp) return '—';
  const d = new Date(stamp.replace(' ', 'T') + 'Z');
  return isNaN(d) ? stamp : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function admStatusOf(b) { return admStatuses[b.status] ? b.status : 'confirmed'; }
function admWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`;
}

function admDownloadCsv(rows) {
  const cols = [
    ['id', 'Booking ID'], ['fullName', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['age', 'Age'], ['gender', 'Gender'],
    ['healthGoal', 'Health goal'], ['notes', 'Patient notes'], ['appointmentDate', 'Date'], ['appointmentTime', 'Time'],
    ['status', 'Status'], ['consultationFee', 'Fee'], ['paymentStatus', 'Payment'], ['razorpayPaymentId', 'Razorpay payment ID'],
    ['razorpayOrderId', 'Razorpay order ID'], ['adminNotes', 'Admin notes'], ['createdAt', 'Booked at (UTC)'],
  ];
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // patient-typed text must not run as a spreadsheet formula
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.map(c => cell(c[1])).join(',')].concat(rows.map(r => cols.map(c => cell(r[c[0]])).join(',')));
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `consultation-bookings-${admTodayKey()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const admInputSt = {
  width: '100%', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-dark)', background: 'white',
  border: '1.5px solid rgba(0,51,52,0.15)', borderRadius: 12, padding: '12px 14px', outline: 'none',
};
const admLabelSt = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6, display: 'block', letterSpacing: '0.03em' };
const admBtnSt = {
  fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--green-950)', background: 'white',
  border: '1.5px solid rgba(0,51,52,0.18)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
};
const admPrimarySt = { ...admBtnSt, color: 'white', background: 'var(--green-950)', border: '1.5px solid var(--green-950)' };

function AdmBadge({ status }) {
  const s = admStatuses[status] || admStatuses.confirmed;
  return <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function AdminLogin({ onLogin, notice }) {
  const [username, setUsername] = useAdmState('');
  const [password, setPassword] = useAdmState('');
  const [busy, setBusy] = useAdmState(false);
  const [error, setError] = useAdmState('');

  const submit = async (ev) => {
    ev.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${ADM_API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.message || 'Sign in failed. Please try again.');
      onLogin(data.token);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Cannot reach the server. Check your connection and try again.' : err.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <form onSubmit={submit} noValidate style={{ background: 'white', borderRadius: 28, padding: 'clamp(28px,5vw,44px)', maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,51,52,0.1)', border: '1px solid rgba(0,51,52,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
          <img src="public/HM.png" alt="Herbs Magic" style={{ height: 44, width: 'auto' }} onError={e => e.target.src = 'public/image.png'} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color: 'var(--green-950)', letterSpacing: '0.04em' }}>HERBS MAGIC</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 500, color: 'var(--grad-start)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Admin Panel</span>
          </div>
        </div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.9rem', fontWeight: 600, color: 'var(--green-950)', marginBottom: 6, lineHeight: 1.15 }}>Sign in</h1>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 22 }}>View and manage consultation bookings.</p>

        {(error || notice) && <div role="alert" style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 13, color: '#c0392b', marginBottom: 18 }}>{error || notice}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={admLabelSt} htmlFor="adm-user">Username</label>
          <input id="adm-user" value={username} onChange={e => { setUsername(e.target.value); setError(''); }} autoComplete="username" autoFocus style={admInputSt} className="adm-input" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={admLabelSt} htmlFor="adm-pass">Password</label>
          <input id="adm-pass" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" style={admInputSt} className="adm-input" />
        </div>
        <button type="submit" disabled={busy} style={{ width: '100%', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: 'white', background: busy ? '#a0b8b0' : 'var(--green-950)', border: 'none', cursor: busy ? 'wait' : 'pointer', padding: '15px', borderRadius: 12, letterSpacing: '0.02em' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a href="/" style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--grad-start)', marginTop: 18, textDecoration: 'none', fontWeight: 600 }}>← Back to website</a>
      </form>
    </div>
  );
}

function AdminBookingDetail({ booking, isConflict, onClose, onSave }) {
  const [status, setStatus] = useAdmState(admStatusOf(booking));
  const [date, setDate] = useAdmState(booking.appointmentDate || '');
  const [time, setTime] = useAdmState(booking.appointmentTime || '');
  const [adminNotes, setAdminNotes] = useAdmState(booking.adminNotes || '');
  const [busy, setBusy] = useAdmState(false);
  const [error, setError] = useAdmState('');

  useAdmEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const moved = date !== (booking.appointmentDate || '') || time !== (booking.appointmentTime || '');
  const dirty = moved || status !== admStatusOf(booking) || adminNotes !== (booking.adminNotes || '');

  const save = async () => {
    if (!date || !time) { setError('Choose both a date and a time.'); return; }
    setBusy(true); setError('');
    try {
      await onSave(booking.id, { status, adminNotes, appointmentDate: date, appointmentTime: time });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  const wa = admWhatsApp(booking.phone);
  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(0,51,52,0.06)' }}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--text-dark)', overflowWrap: 'anywhere', minWidth: 0 }}>{value || '—'}</span>
    </div>
  );
  const linkSt = { color: 'var(--grad-start)', fontWeight: 600, textDecoration: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,51,52,0.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <div role="dialog" aria-modal="true" aria-label={`Booking ${booking.id}`} onClick={e => e.stopPropagation()}
        style={{ background: 'white', width: '100%', maxWidth: 480, height: '100%', overflowY: 'auto', padding: 'clamp(20px,4vw,32px)', boxShadow: '-16px 0 48px rgba(0,51,52,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Booking #{booking.id}</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.7rem', fontWeight: 600, color: 'var(--green-950)', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{booking.fullName || 'Unnamed patient'}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ ...admBtnSt, padding: '7px 12px', flexShrink: 0 }}>✕</button>
        </div>

        {isConflict && <div style={{ background: 'var(--tag-peach)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontSize: 13, color: '#9a4a12', marginBottom: 16 }}>Another active booking has this same date and time. Reschedule one of them.</div>}

        <div style={{ marginBottom: 22 }}>
          {row('Email', booking.email && <a href={`mailto:${booking.email}`} style={linkSt}>{booking.email}</a>)}
          {row('Phone', booking.phone && (
            <span>
              <a href={`tel:${booking.phone}`} style={linkSt}>{booking.phone}</a>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...linkSt, marginLeft: 12 }}>WhatsApp ↗</a>}
            </span>
          ))}
          {row('Age / Gender', [booking.age, booking.gender].filter(Boolean).join(' · '))}
          {row('Health goal', booking.healthGoal)}
          {row('Patient notes', booking.notes)}
          {row('Paid', `₹${booking.consultationFee ?? '—'} · ${booking.paymentStatus || '—'}`)}
          {row('Payment ID', booking.razorpayPaymentId)}
          {row('Order ID', booking.razorpayOrderId)}
          {row('Booked on', admNiceStamp(booking.createdAt))}
        </div>

        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Manage</div>

        <label style={admLabelSt}>Status</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {Object.keys(admStatuses).map(key => (
            <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key}
              style={{ ...admBtnSt, padding: '8px 14px', ...(status === key ? { background: 'var(--green-950)', color: 'white', borderColor: 'var(--green-950)' } : {}) }}>
              {admStatuses[key].label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
          <div>
            <label style={admLabelSt} htmlFor="adm-date">Date</label>
            <input id="adm-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={admInputSt} className="adm-input" />
          </div>
          <div>
            <label style={admLabelSt} htmlFor="adm-time">Time (IST)</label>
            <input id="adm-time" type="time" value={time} onChange={e => setTime(e.target.value)} style={admInputSt} className="adm-input" />
          </div>
        </div>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, minHeight: 18 }}>
          {moved && status !== 'cancelled' ? 'The patient will be emailed the new date and time.' : ''}
        </p>

        <label style={admLabelSt} htmlFor="adm-notes">Admin notes <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(only visible here)</span></label>
        <textarea id="adm-notes" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={4} maxLength={2000} placeholder="Follow-ups, prescriptions sent, refund details…" style={{ ...admInputSt, resize: 'vertical', marginBottom: 18 }} className="adm-input" />

        {error && <div role="alert" style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 13, color: '#c0392b', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={save} disabled={busy || !dirty} style={{ ...admPrimarySt, flex: 1, padding: '13px', borderRadius: 12, fontSize: 14, opacity: busy || !dirty ? 0.5 : 1, cursor: busy ? 'wait' : dirty ? 'pointer' : 'default' }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onClose} style={{ ...admBtnSt, padding: '13px 20px', borderRadius: 12, fontSize: 14 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ token, onLogout }) {
  const [bookings, setBookings] = useAdmState(null);
  const [loading, setLoading] = useAdmState(true);
  const [error, setError] = useAdmState('');
  const [filter, setFilter] = useAdmState('upcoming');
  const [query, setQuery] = useAdmState('');
  const [openId, setOpenId] = useAdmState(null);

  const api = useAdmCallback(async (path, options) => {
    const res = await fetch(`${ADM_API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { onLogout('Your session has expired. Please sign in again.'); throw new Error('Session expired'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }, [token]);

  const load = useAdmCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api('/api/b2b-appointments');
      setBookings(data.data || []);
    } catch (err) {
      if (err.message !== 'Session expired') setError(err.message === 'Failed to fetch' ? 'Cannot reach the server. Check your connection and try again.' : err.message);
    }
    setLoading(false);
  }, [api]);

  useAdmEffect(() => { load(); }, [load]);

  const saveBooking = async (id, changes) => {
    const data = await api(`/api/b2b-appointments/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    setBookings(list => list.map(b => (b.id === id ? data.data : b)));
  };

  const today = admTodayKey();
  const all = bookings || [];

  // Active bookings sharing a date + time are double-booked
  const conflictIds = useAdmMemo(() => {
    const bySlot = {};
    all.forEach(b => {
      if (admStatusOf(b) === 'cancelled') return;
      const key = `${b.appointmentDate}|${b.appointmentTime}`;
      (bySlot[key] = bySlot[key] || []).push(b.id);
    });
    const ids = new Set();
    Object.values(bySlot).forEach(group => { if (group.length > 1) group.forEach(id => ids.add(id)); });
    return ids;
  }, [bookings]);

  const inFilter = (b, f) => {
    const s = admStatusOf(b);
    if (f === 'all') return true;
    if (f === 'cancelled') return s === 'cancelled';
    if (f === 'today') return s !== 'cancelled' && b.appointmentDate === today;
    if (f === 'upcoming') return s === 'confirmed' && b.appointmentDate >= today;
    return s !== 'cancelled' && (b.appointmentDate < today || s !== 'confirmed'); // past
  };
  const counts = useAdmMemo(() => {
    const c = {};
    admFilters.forEach(([key]) => { c[key] = all.filter(b => inFilter(b, key)).length; });
    return c;
  }, [bookings, today]);

  const visible = useAdmMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = all.filter(b => inFilter(b, filter)).filter(b => !q ||
      [b.fullName, b.email, b.phone, b.healthGoal, b.razorpayPaymentId, b.id].some(v => String(v ?? '').toLowerCase().includes(q)));
    const slot = (b) => `${b.appointmentDate} ${b.appointmentTime}`;
    const soonestFirst = filter === 'upcoming' || filter === 'today';
    return rows.sort((a, b) => (soonestFirst ? slot(a).localeCompare(slot(b)) : slot(b).localeCompare(slot(a))));
  }, [bookings, filter, query, today]);

  const paid = all.filter(b => b.paymentStatus === 'paid');
  const revenue = paid.reduce((sum, b) => sum + (Number(b.consultationFee) || 0), 0);
  const stats = [
    ['Today', counts.today],
    ['Upcoming', counts.upcoming],
    ['Total bookings', all.length],
    ['Collected', `₹${revenue.toLocaleString('en-IN')}`],
  ];
  const open = openId != null ? all.find(b => b.id === openId) : null;
  const thSt = { fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap' };
  const tdSt = { fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--text-dark)', padding: '14px', borderTop: '1px solid rgba(0,51,52,0.06)', verticalAlign: 'top' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-mint)' }}>
      <header style={{ background: 'white', borderBottom: '1px solid rgba(0,51,52,0.1)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '12px clamp(1rem,3vw,2rem)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="public/HM.png" alt="Herbs Magic" style={{ height: 40, width: 'auto' }} onError={e => e.target.src = 'public/image.png'} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color: 'var(--green-950)', letterSpacing: '0.04em' }}>HERBS MAGIC</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 500, color: 'var(--grad-start)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Admin · Bookings</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={load} disabled={loading} style={admBtnSt}>{loading ? 'Refreshing…' : 'Refresh'}</button>
            <button onClick={() => admDownloadCsv(visible)} disabled={!visible.length} style={{ ...admBtnSt, opacity: visible.length ? 1 : 0.5 }}>Export CSV</button>
            <button onClick={() => onLogout('')} style={admPrimarySt}>Sign out</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px clamp(1rem,3vw,2rem) 60px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.7rem,3vw,2.2rem)', fontWeight: 600, color: 'var(--green-950)', marginBottom: 20, lineHeight: 1.1 }}>Consultation bookings</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }} className="adm-stats">
          {stats.map(([label, value]) => (
            <div key={label} style={{ background: 'white', border: '1px solid rgba(0,51,52,0.08)', borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 700, color: 'var(--green-950)', lineHeight: 1 }}>{bookings ? value : '…'}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>

        {conflictIds.size > 0 && <div style={{ background: 'var(--tag-peach)', borderRadius: 12, padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 13, color: '#9a4a12', marginBottom: 16 }}>{conflictIds.size} bookings share a time slot with another booking. They are marked “Double-booked” below.</div>}
        {error && <div role="alert" style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 13, color: '#c0392b', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><span>{error}</span><button onClick={load} style={{ ...admBtnSt, padding: '6px 14px' }}>Try again</button></div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {admFilters.map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}
                style={{ ...admBtnSt, padding: '8px 14px', ...(filter === key ? { background: 'var(--green-950)', color: 'white', borderColor: 'var(--green-950)' } : {}) }}>
                {label} <span style={{ opacity: 0.65, fontWeight: 500 }}>{bookings ? counts[key] : ''}</span>
              </button>
            ))}
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone, email, payment ID" aria-label="Search bookings" style={{ ...admInputSt, width: 'min(100%, 320px)', padding: '10px 14px', borderRadius: 999 }} className="adm-input" />
        </div>

        <div style={{ background: 'white', border: '1px solid rgba(0,51,52,0.08)', borderRadius: 20, overflow: 'hidden' }}>
          {!bookings && loading && <div style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-muted)', padding: '48px 20px', textAlign: 'center' }}>Loading bookings…</div>}
          {bookings && visible.length === 0 && (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-muted)', padding: '48px 20px', textAlign: 'center' }}>
              {all.length === 0 ? 'No bookings yet. New bookings appear here as soon as a patient pays.' : query.trim() ? 'No bookings match your search.' : 'No bookings in this view.'}
            </div>
          )}
          {bookings && visible.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-soft)' }}>
                    {['Appointment', 'Patient', 'Contact', 'Health goal', 'Paid', 'Status', ''].map(h => <th key={h} style={thSt}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(b => (
                    <tr key={b.id} className="adm-row" onClick={() => setOpenId(b.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700 }}>{admNiceDate(b.appointmentDate)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{b.appointmentTime || '—'} IST</div>
                        {conflictIds.has(b.id) && <div style={{ marginTop: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#9a4a12', background: 'var(--tag-peach)', borderRadius: 999, padding: '3px 9px' }}>Double-booked</span></div>}
                      </td>
                      <td style={{ ...tdSt, maxWidth: 200, overflowWrap: 'break-word' }}>
                        <div style={{ fontWeight: 700 }}>{b.fullName || '—'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{[b.age && `${b.age} yrs`, b.gender].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td style={{ ...tdSt, maxWidth: 230, overflowWrap: 'break-word' }}>
                        <div>{b.phone || '—'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{b.email}</div>
                      </td>
                      <td style={{ ...tdSt, maxWidth: 180 }}>{b.healthGoal || '—'}</td>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>₹{b.consultationFee ?? '—'}</td>
                      <td style={tdSt}><AdmBadge status={admStatusOf(b)} /></td>
                      <td style={{ ...tdSt, textAlign: 'right' }}>
                        <button onClick={e => { e.stopPropagation(); setOpenId(b.id); }} style={{ ...admBtnSt, padding: '6px 14px' }}>Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {open && <AdminBookingDetail key={open.id} booking={open} isConflict={conflictIds.has(open.id)} onClose={() => setOpenId(null)} onSave={saveBooking} />}
    </div>
  );
}

function AdminPanel() {
  const [token, setToken] = useAdmState(admReadToken);
  const [notice, setNotice] = useAdmState('');

  useAdmEffect(() => {
    const previous = document.title;
    document.title = 'Admin · Herbs Magic Consultation';
    return () => { document.title = previous; };
  }, []);

  const login = (newToken) => { admWriteToken(newToken); setNotice(''); setToken(newToken); };
  const logout = (message) => { admWriteToken(''); setNotice(message || ''); setToken(''); };

  return (
    <div>
      <style>{`
        .adm-input:focus { border-color: var(--grad-start) !important; box-shadow: 0 0 0 3px rgba(80,180,149,0.15) !important; }
        .adm-row:hover { background: var(--bg-mint); }
        @media(max-width:760px){ .adm-stats { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
      {token ? <AdminDashboard token={token} onLogout={logout} /> : <AdminLogin onLogin={login} notice={notice} />}
    </div>
  );
}

window.AdminPanel = AdminPanel;
