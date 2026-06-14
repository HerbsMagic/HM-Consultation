const { useState: useBkState, useEffect: useBkEffect, useMemo: useBkMemo } = React;

const API_BASE = window.CONSULTATION_API_BASE || '';

const bkWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const bkMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Hardcoded slots by day name — no API needed
const bkDefaultSlots = {
  Mon: ['09:00','10:00','11:00','14:00','15:00','16:00'],
  Tue: ['09:00','10:00','11:00','14:00','15:00'],
  Wed: ['10:00','11:00','14:00','15:00','16:00'],
  Thu: ['09:00','10:00','11:00','14:00'],
  Fri: ['09:00','10:00','11:00','14:00','15:00','16:00'],
  Sat: ['10:00','11:00','12:00'],
};

function bkBuildMonthGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}
function bkKey(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function AppointmentBooking({ setPage }) {
  const today = new Date();
  const [calYear, setCalYear] = useBkState(today.getFullYear());
  const [calMonth, setCalMonth] = useBkState(today.getMonth());
  const [selectedDate, setSelectedDate] = useBkState('');
  const [selectedSlot, setSelectedSlot] = useBkState('');
  const [submitted, setSubmitted] = useBkState(false);
  const [loading, setLoading] = useBkState(false);
  const [error, setError] = useBkState('');
  const [form, setForm] = useBkState({ fullName: '', email: '', phone: '', age: '', gender: '', healthGoal: '', notes: '' });
  const [errors, setErrors] = useBkState({});

  const [consultFee, setConsultFee] = useBkState(null);

  useBkEffect(() => {
    fetch(`${API_BASE}/api/payments/config`)
      .then(r => r.json())
      .then(d => {
        const fee = Number(d?.consultationFee ?? d?.data?.consultationFee);
        if (fee > 0) setConsultFee(fee);
        else setConsultFee(499);
      })
      .catch(() => setConsultFee(499));
  }, []);

  const grid = useBkMemo(() => bkBuildMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const todayKey = bkKey(today.getFullYear(), today.getMonth(), today.getDate());

  const availableSlots = useBkMemo(() => {
    if (!selectedDate) return [];
    const dayName = bkWeekdays[new Date(selectedDate + 'T00:00:00').getDay()];
    return bkDefaultSlots[dayName] || [];
  }, [selectedDate]);

  useBkEffect(() => {
    if (availableSlots.length && !availableSlots.includes(selectedSlot)) setSelectedSlot(availableSlots[0]);
  }, [availableSlots]);

  const isDayAvailable = (y, m, d) => {
    const key = bkKey(y, m, d);
    if (key < todayKey) return false;
    const dayName = bkWeekdays[new Date(y, m, d).getDay()];
    return !!bkDefaultSlots[dayName]; // Sun has no entry → blocked
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.age.trim()) e.age = 'Required';
    if (!form.gender) e.gender = 'Required';
    if (!form.healthGoal) e.healthGoal = 'Required';
    if (!selectedDate) e.date = 'Select a date';
    if (!selectedSlot) e.slot = 'Select a time slot';
    return e;
  };

  const handleChange = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: undefined }));
    setError('');
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); setError('Please fill all required fields and choose a date & time.'); return; }
    setLoading(true); setError('');

    try {
      const keyId = window.RAZORPAY_KEY_ID || '';
      if (!keyId) throw new Error('Payment gateway not configured. Please contact support.');

      const orderRes = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: consultFee,
          currency: 'INR',
          purpose: 'consultation',
          webinarId: 'consultation-default',
          customer: { fullName: form.fullName, email: form.email, phone: form.phone },
          bookingMeta: { appointmentDate: selectedDate, appointmentTime: selectedSlot },
        }),
      });
      const orderData = await orderRes.json();
      const orderId = orderData?.id || orderData?.orderId || orderData?.data?.id || orderData?.order?.id;
      if (!orderId) throw new Error(orderData?.message || 'Failed to create order');

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: Math.round(consultFee * 100),
          currency: 'INR',
          order_id: orderId,
          name: 'Herbs Magic',
          description: `Consultation with Dr. Sangmeshwar Lungare — ₹${consultFee}`,
          prefill: { name: form.fullName, email: form.email, contact: form.phone },
          theme: { color: '#003334' },
          handler: async (paymentResponse) => {
            try {
              const res = await fetch(`${API_BASE}/api/b2b-appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...form,
                  appointmentDate: selectedDate,
                  appointmentTime: selectedSlot,
                  consultationFee: consultFee,
                  paymentStatus: 'paid',
                  razorpayPaymentId: paymentResponse.razorpay_payment_id,
                  razorpayOrderId: paymentResponse.razorpay_order_id,
                  razorpaySignature: paymentResponse.razorpay_signature,
                }),
              });
              if (!res.ok) {
                const text = await res.text();
                console.error('[Appointment] Save failed:', res.status, text);
              }
            } catch (saveErr) {
              console.error('[Appointment] Save error:', saveErr);
            }
            if (window.fbq) {
              fbq('track', 'Schedule');
              fbq('track', 'Purchase', { value: consultFee, currency: 'INR' });
            }
            setLoading(false);
            setSubmitted(true);
            resolve();
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              setError('Payment was cancelled. Please try again.');
              reject(new Error('Payment cancelled'));
            },
          },
        });
        if (window.fbq) fbq('track', 'InitiateCheckout', { value: consultFee, currency: 'INR' });
        rzp.open();
      });
    } catch (err) {
      setLoading(false);
      if (err.message !== 'Payment cancelled') {
        setError(err.message || 'Booking failed. Please try again.');
      }
    }
  };

  const inputSt = (err) => ({
    width: '100%', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-dark)',
    background: 'white', border: `1.5px solid ${err ? '#e74c3c' : 'rgba(0,51,52,0.15)'}`,
    borderRadius: 12, padding: '12px 14px', outline: 'none', transition: 'border 0.2s, box-shadow 0.2s', appearance: 'none',
  });
  const labelSt = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6, display: 'block', letterSpacing: '0.03em' };
  const errSt = { fontFamily: 'var(--sans)', fontSize: 11, color: '#e74c3c', marginTop: 4 };
  const niceDate = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  if (submitted) {
    return (
      <div style={{ paddingTop: 68, minHeight: '100vh', background: 'var(--bg-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 40px' }}>
        <div style={{ background: 'white', borderRadius: 28, padding: '52px 40px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,51,52,0.1)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-success)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--grad-start)" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 600, color: 'var(--green-950)', marginBottom: 12 }}>Consultation Booked!</h2>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 10 }}>
            Consultation booked for ₹{consultFee}. A confirmation and calendar invite are on the way to <strong style={{ color: 'var(--text-dark)' }}>{form.email}</strong>.
          </p>
          <div style={{ background: 'var(--bg-soft)', borderRadius: 14, padding: '16px 18px', margin: '20px 0 28px', textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-dark)', fontWeight: 700, marginBottom: 6 }}>{form.fullName}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)' }}>📅 {niceDate} &nbsp;·&nbsp; ⏰ {selectedSlot} IST</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>🧑‍⚕️ Dr. Sangmeshwar Lungare · {form.healthGoal}</div>
          </div>
          <button onClick={() => setPage('home')} style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, var(--green-950), var(--green-700))', border: 'none', cursor: 'pointer', padding: '12px 28px', borderRadius: 999, boxShadow: '0 6px 20px rgba(0,51,52,0.28)' }}>← Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 68, minHeight: '100vh', background: 'var(--bg-mint)' }}>
      <style>{`
        .ab-input:focus { border-color: var(--grad-start) !important; box-shadow: 0 0 0 3px rgba(80,180,149,0.15) !important; }
        .slot-btn { font-family: var(--sans); font-size: 13px; font-weight: 600; border-radius: 10px; padding: 9px 14px; cursor: pointer; border: 1.5px solid rgba(0,51,52,0.15); background: white; color: var(--text-dark); transition: all 0.2s; }
        .slot-btn:hover { border-color: var(--grad-start); background: var(--bg-soft); }
        .slot-btn.active { background: var(--green-950); color: white; border-color: var(--green-950); }
        .cal-day { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-family: var(--sans); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: 1.5px solid transparent; }
        .cal-day.available { color: var(--text-dark); }
        .cal-day.available:hover { background: var(--bg-card); }
        .cal-day.selected { background: var(--green-950); color: white; border-radius: 50%; }
        .cal-day.unavailable { color: #c8d4d0; cursor: default; }
        .cal-day.today { border: 1.5px solid var(--orange); border-radius: 50%; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px clamp(1rem,3vw,2rem) 60px' }}>
        <button onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--grad-start)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 28, padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Home
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }} className="ab-grid">
          {/* Sidebar */}
          <div style={{ background: 'var(--green-950)', borderRadius: 24, padding: '28px 22px', color: 'white', position: 'sticky', top: 84 }} className="ab-side">
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Book a Session</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 600, marginBottom: 4, lineHeight: 1.15 }}>1:1 Consultation</h2>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>Dr. Sangmeshwar Lungare, BAMS</p>
            <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}>
              <img src="public/doctor.jpeg" alt="Dr. Lungare" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', objectPosition: 'top' }} onError={e => e.target.src = 'https://images.pexels.com/photos/8939925/pexels-photo-8939925.jpeg'} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, marginBottom: 2 }}>{consultFee != null ? `₹${consultFee}` : '…'}</div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Consultation Fee</div>
            </div>
            {['Weight loss', 'Weight gain', 'Body recomposition', 'Muscle gain'].map(g => (
              <div key={g} style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.55)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>✓ {g}</div>
            ))}
          </div>

          {/* Main */}
          <div style={{ background: 'white', borderRadius: 24, padding: 'clamp(20px,3vw,36px)', boxShadow: '0 8px 40px rgba(0,51,52,0.07)', border: '1px solid rgba(0,51,52,0.06)' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.8rem', fontWeight: 600, color: 'var(--green-950)', marginBottom: 6 }}>Book Your Consultation</h1>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>Choose your preferred date, time, and fill in your details.</p>

            {error && <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontFamily: 'var(--sans)', fontSize: 13, color: '#c0392b', marginBottom: 20 }}>{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Personal Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="form-2col">
                <div>
                  <label style={labelSt}>Full Name *</label>
                  <input value={form.fullName} onChange={e => handleChange('fullName', e.target.value)} placeholder="Your full name" style={inputSt(errors.fullName)} className="ab-input" />
                  {errors.fullName && <p style={errSt}>{errors.fullName}</p>}
                </div>
                <div>
                  <label style={labelSt}>Email *</label>
                  <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="you@example.com" style={inputSt(errors.email)} className="ab-input" />
                  {errors.email && <p style={errSt}>{errors.email}</p>}
                </div>
                <div>
                  <label style={labelSt}>Phone *</label>
                  <input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+91 98765 43210" style={inputSt(errors.phone)} className="ab-input" />
                  {errors.phone && <p style={errSt}>{errors.phone}</p>}
                </div>
                <div>
                  <label style={labelSt}>Age *</label>
                  <input type="number" min="1" value={form.age} onChange={e => handleChange('age', e.target.value)} placeholder="Your age" style={inputSt(errors.age)} className="ab-input" />
                  {errors.age && <p style={errSt}>{errors.age}</p>}
                </div>
                <div>
                  <label style={labelSt}>Gender *</label>
                  <select value={form.gender} onChange={e => handleChange('gender', e.target.value)} style={inputSt(errors.gender)} className="ab-input">
                    <option value="">Select gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && <p style={errSt}>{errors.gender}</p>}
                </div>
                <div>
                  <label style={labelSt}>Health Goal *</label>
                  <select value={form.healthGoal} onChange={e => handleChange('healthGoal', e.target.value)} style={inputSt(errors.healthGoal)} className="ab-input">
                    <option value="">Select goal</option>
                    <option value="Weight loss">Weight loss</option>
                    <option value="Weight gain">Weight gain</option>
                    <option value="Body recomposition">Body recomposition</option>
                    <option value="Body building / Muscle gain">Body building / Muscle gain</option>
                    <option value="Digestion & gut health">Digestion &amp; gut health</option>
                    <option value="Sleep & stress">Sleep &amp; stress</option>
                  </select>
                  {errors.healthGoal && <p style={errSt}>{errors.healthGoal}</p>}
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelSt}>Notes / Medical Context <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} placeholder="Any health conditions, medications, or goals…" style={{ ...inputSt(false), resize: 'none' }} className="ab-input" />
              </div>

              {/* Calendar */}
              <div style={{ borderTop: '1px solid rgba(0,51,52,0.07)', paddingTop: 24, marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Select Date & Time</div>

                <div style={{ background: 'var(--bg-soft)', borderRadius: 16, padding: '20px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                        style={{ background: 'white', border: '1px solid rgba(0,51,52,0.12)', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dark)" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>{bkMonths[calMonth]} {calYear}</span>
                      <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                        style={{ background: 'white', border: '1px solid rgba(0,51,52,0.12)', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dark)" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 8 }}>
                      {bkWeekdays.map(d => <div key={d} style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>{d}</div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                      {grid.map((d, i) => {
                        if (!d) return <div key={i}></div>;
                        const key = bkKey(calYear, calMonth, d);
                        const avail = isDayAvailable(calYear, calMonth, d);
                        const sel = key === selectedDate;
                        const tod = key === todayKey;
                        return (
                          <div key={i} className={`cal-day ${avail ? (sel ? 'selected' : 'available') : 'unavailable'} ${tod && !sel ? 'today' : ''}`}
                            onClick={() => { if (avail) { setSelectedDate(key); setErrors(e => ({ ...e, date: undefined })); } }}
                            style={{ margin: '0 auto' }}>
                            {d}
                          </div>
                        );
                      })}
                    </div>
                    {errors.date && <p style={{ ...errSt, marginTop: 8 }}>{errors.date}</p>}
                  </div>
              </div>

              {selectedDate && availableSlots.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 12 }}>
                    Available slots for {niceDate}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableSlots.map(slot => (
                      <button key={slot} type="button" className={`slot-btn ${slot === selectedSlot ? 'active' : ''}`}
                        onClick={() => { setSelectedSlot(slot); setErrors(e => ({ ...e, slot: undefined })); }}>
                        {slot}
                      </button>
                    ))}
                  </div>
                  {errors.slot && <p style={errSt}>{errors.slot}</p>}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ width: '100%', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: 'white', background: loading ? '#a0b8b0' : 'var(--green-950)', border: 'none', cursor: loading ? 'wait' : 'pointer', padding: '16px', borderRadius: 12, letterSpacing: '0.02em', transition: 'all 0.25s' }}>
                {loading ? 'Processing…' : `Confirm & Pay ${consultFee != null ? `₹${consultFee}` : '…'}`}
              </button>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>🔒 Secured by Razorpay · Your data is safe</p>
            </form>
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){ .ab-grid { grid-template-columns: 1fr !important; } .ab-side { position: static !important; } }
        @media(max-width:540px){ .form-2col { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

window.AppointmentBooking = AppointmentBooking;
