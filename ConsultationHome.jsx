const { useState: useHomeState, useEffect: useHomeEffect } = React;

// ── scroll reveal ──
function useReveal() {
  useHomeEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const cFaqs = [
  { q: "What happens during the 1:1 consultation?", a: "Dr. Lungare reviews your health goal, history and routine, then gives you a personalised Ayurvedic plan — diet, herbs and daily rituals tailored to your body type (prakriti)." },
  { q: "Is the consultation online or in-clinic?", a: "Both options are available. You can book a private online session from anywhere, or an in-person visit. Choose your slot during booking." },
  { q: "Do I need any prior knowledge of Ayurveda?", a: "Not at all. Dr. Lungare explains everything in simple terms and gives you practical, realistic steps you can actually follow." },
  { q: "Will I be prescribed medicines?", a: "You receive a personalised protocol of diet, lifestyle and herbal formulations. Classical herbs can be shipped to you. Medicine cost is separate from the consultation fee." },
  { q: "What payment methods are accepted?", a: "We accept UPI, credit/debit cards and net banking, secured by Razorpay. International patients can pay in INR using most cards." },
  { q: "Can I reschedule my appointment?", a: "Yes. You can reschedule or cancel for a full credit up to 4 hours before your slot, directly from your confirmation email." },
];

const cTestimonials = [
  { name: "Priya Sharma", msg: "Dr. Lungare's diet plan finally fixed my digestion after years of trying everything. He actually listened — it never felt rushed.", rating: 4.8, initial: "P" },
  { name: "Rajesh Kumar", msg: "Booked the 1:1 consultation for weight management. Clear, practical guidance and the herbs were posted to my door. Down 6kg.", rating: 4.6, initial: "R" },
  { name: "Anita Desai", msg: "I was sceptical about online Ayurveda. The session was thorough and the routine was realistic for my lifestyle. Highly recommend.", rating: 5, initial: "A" },
  { name: "Vikram Singh", msg: "Best health decision I've made. The combination of diet, herbs and daily rituals is powerful and easy to stick to.", rating: 4.7, initial: "V" },
  { name: "Meera Patel", msg: "As someone new to Ayurveda I found the explanations very clear. My energy and sleep have completely turned around.", rating: 4.3, initial: "M" },
  { name: "Suresh Reddy", msg: "Excellent consultation. The doctor's expertise shows. Worth every rupee — and the follow-up support is genuine.", rating: 4.9, initial: "S" },
];

function CStars({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 20 20" fill={i <= Math.round(rating) ? '#D97757' : '#e2e8e6'}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

function CFAQ({ faq, index }) {
  const [open, setOpen] = useHomeState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(0,51,52,0.08)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--text-dark)', textAlign: 'left', gap: 16,
      }}>
        <span>{index + 1}. {faq.q}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--grad-start)" strokeWidth="2.5"
          style={{ flexShrink: 0, transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div style={{ maxHeight: open ? 240 : 0, overflow: 'hidden', transition: 'max-height 0.4s ease', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, paddingBottom: open ? 16 : 0 }}>
        {faq.a}
      </div>
    </div>
  );
}

function ConsultationHome({ setPage }) {
  useReveal();
  const [tIdx, setTIdx] = useHomeState(0);
  const [consultFee, setConsultFee] = useHomeState(null);

  useHomeEffect(() => {
    const base = window.CONSULTATION_API_BASE || '';
    fetch(`${base}/api/payments/config`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { if (data.consultationFee) setConsultFee(data.consultationFee); })
      .catch(() => { setConsultFee(499); });
  }, []);

  const feeLabel = consultFee != null ? `₹${consultFee}` : '…';

  useHomeEffect(() => {
    const t = setInterval(() => setTIdx(i => (i + 1) % cTestimonials.length), 5000);
    return () => clearInterval(t);
  }, []);

  const book = () => setPage('appointment');

  const sectionTitle = (label, sub, light) => (
    <div style={{ marginBottom: 40 }} data-reveal>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 2, background: 'var(--orange)', borderRadius: 2 }}></div>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: light ? 'rgba(255,255,255,0.5)' : 'var(--orange)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 600, color: light ? 'white' : 'var(--green-950)', lineHeight: 1.1 }}>{sub}</h2>
    </div>
  );

  const steps = [
    ['01', 'Share your goal', 'Tell us your health goal and a little about your routine while booking — it takes two minutes.', 'M12 2a5 5 0 015 5c0 2-1 3-1 5h-8c0-2-1-3-1-5a5 5 0 015-5z M9 18h6 M10 21h4'],
    ['02', 'Pick a slot', 'Choose a date and time that suits you. Reschedule freely up to 4 hours before.', 'M3 5h18v16H3z M3 9h18 M8 3v4 M16 3v4'],
    ['03', 'Meet Dr. Lungare', 'A focused 1:1 session with a BAMS Ayurvedic physician — not a chatbot or a generic form.', 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c1-4 4-6 8-6s7 2 8 6'],
    ['04', 'Get your plan', 'Receive a personalised diet, herb and lifestyle protocol made for your body, delivered to your inbox.', 'M12 3c3 4 6 7 6 10a6 6 0 01-12 0c0-3 3-6 6-10z'],
  ];

  const included = [
    'Full assessment of your dosha & body type',
    'Personalised diet & daily routine plan',
    'Herbal protocol tailored to your goal',
    'Time to ask questions — no rush',
    'Plan delivered to your inbox after the call',
    'Follow-up guidance & free reschedule',
  ];

  return (
    <div style={{ paddingTop: 68 }}>
      <style>{`
        [data-reveal] { opacity: 0; transform: translateY(28px); transition: opacity 0.65s ease, transform 0.65s ease; }
        [data-reveal].revealed { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1 !important; transform: none !important; } }
        .card-lift { transition: transform 0.28s ease, box-shadow 0.28s ease; }
        .card-lift:hover { transform: translateY(-5px); box-shadow: 0 24px 60px rgba(0,51,52,0.14); }
        .btn-primary { font-family: var(--sans); font-size: 14px; font-weight: 600; color: white; background: linear-gradient(135deg, var(--green-950), var(--green-700)); border: none; cursor: pointer; padding: 13px 28px; border-radius: 999px; letter-spacing: 0.02em; box-shadow: 0 6px 20px rgba(0,51,52,0.28); transition: all 0.25s ease; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,51,52,0.38); }
        .btn-outline { font-family: var(--sans); font-size: 14px; font-weight: 600; color: var(--green-950); background: white; border: 1.5px solid rgba(0,51,52,0.25); cursor: pointer; padding: 12px 26px; border-radius: 999px; transition: all 0.25s ease; }
        .btn-outline:hover { background: var(--bg-soft); border-color: var(--green-mid); }
        .ch-section { padding: 80px 0; }
        .ch-container { max-width: 1200px; margin: 0 auto; padding: 0 clamp(1rem, 3vw, 2rem); }
        @media(max-width:768px){ .ch-section { padding: 56px 0; } }
        @keyframes ch-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>

      {/* ── HERO ── */}
      <section style={{ padding: 0, background: 'var(--bg-white)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,180,149,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.07) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

        <div className="ch-container" style={{ paddingTop: 72, paddingBottom: 80 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }} className="hero-grid">
            <div data-reveal>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid rgba(0,51,52,0.12)', borderRadius: 999, padding: '6px 16px', marginBottom: 24 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)', animation: 'ch-pulse 2s infinite' }}></div>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--green-mid)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>1:1 Ayurvedic Consultation</span>
              </div>

              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(2.4rem,5vw,3.8rem)', fontWeight: 600, color: 'var(--green-950)', lineHeight: 1.06, marginBottom: 20 }}>
                Personalised Ayurvedic care, <em style={{ color: 'var(--grad-start)', fontStyle: 'italic' }}>one-to-one</em> with your doctor
              </h1>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 'clamp(0.95rem,1.4vw,1.1rem)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
                Book a private session with Dr. Sangmeshwar Lungare and walk away with a diet, herb and lifestyle plan made for your body — not a generic checklist.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
                {['Personalised Plan', '1:1 Doctor Consultation', 'Secure Payment'].map(c => (
                  <span key={c} style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--green-mid)', background: 'var(--bg-soft)', border: '1px solid rgba(0,61,43,0.12)', borderRadius: 999, padding: '7px 16px' }}>{c}</span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ fontSize: 15, padding: '15px 32px' }} onClick={book}>Book Consultation →</button>
                <button className="btn-outline" style={{ fontSize: 15, padding: '14px 30px' }} onClick={() => { const el = document.getElementById('how'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' }); }}>How It Works</button>
              </div>

              <div style={{ display: 'flex', gap: 32, marginTop: 44, paddingTop: 32, borderTop: '1px solid rgba(0,51,52,0.1)' }}>
                {[['10,000+', 'Lives Transformed'], ['15+', 'Years Experience'], ['4.8★', 'Avg. Rating']].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.5rem,2.5vw,2.2rem)', fontWeight: 700, color: 'var(--green-950)', lineHeight: 1 }}>{v}</div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal style={{ transitionDelay: '0.15s', position: 'relative' }}>
              <div style={{ borderRadius: 28, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,51,52,0.18)', position: 'relative', aspectRatio: '4/5' }}>
                <img src="public/doctor.jpeg" alt="Dr. Sangmeshwar Lungare"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  onError={e => e.target.src = 'https://images.pexels.com/photos/8939925/pexels-photo-8939925.jpeg'} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(0,51,52,0.6) 100%)' }}></div>
                <div style={{ position: 'absolute', left: 22, bottom: 20, color: 'white' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Dr. Sangmeshwar Lungare</div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>BAMS · Ayurvedic Physician</div>
                </div>
              </div>
              {/* Floating fee badge */}
              <div style={{ position: 'absolute', top: 24, right: -20, background: 'white', borderRadius: 20, padding: '14px 20px', boxShadow: '0 16px 48px rgba(0,51,52,0.16)', border: '1px solid rgba(0,51,52,0.08)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, color: 'var(--green-950)' }}>{feeLabel}</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Consultation Fee</div>
              </div>
              <div style={{ position: 'absolute', bottom: -18, left: -20, background: 'white', borderRadius: 16, padding: '12px 16px', boxShadow: '0 16px 48px rgba(0,51,52,0.16)', border: '1px solid rgba(0,51,52,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#3FA66B', boxShadow: '0 0 0 4px rgba(63,166,107,0.18)' }}></div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-dark)' }}>Next slot · <span style={{ color: 'var(--grad-start)' }}>Today</span></div>
              </div>
            </div>
          </div>
        </div>
        <style>{`@media(max-width:860px){ .hero-grid { grid-template-columns:1fr !important; gap: 40px !important; } }`}</style>
      </section>

      {/* ── FEATURES BAR ── */}
      <section style={{ background: 'var(--green-950)', padding: '36px 0' }}>
        <div className="ch-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }} className="features-bar">
            {[
              ['🌿', 'Root-Cause Care', 'Treats the cause, not symptoms'],
              ['🧑‍⚕️', '1:1 With a Doctor', 'BAMS physician, 15+ years'],
              ['🔒', 'Secure Payment', 'Razorpay · UPI / cards / netbanking'],
              ['♾️', 'Follow-Up Support', 'Free reschedule & guidance'],
            ].map(([icon, t, s]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
                <div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, color: 'white' }}>{t}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media(max-width:700px){ .features-bar { grid-template-columns: 1fr 1fr !important; gap: 20px !important; } }`}</style>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="ch-section" style={{ background: 'var(--bg-white)' }}>
        <div className="ch-container">
          {sectionTitle('How It Works', 'From concern to protocol in four steps')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 22 }} className="how-grid">
            {steps.map(([num, t, d, path], i) => (
              <div key={num} data-reveal className="card-lift" style={{ transitionDelay: `${i*0.08}s`, background: 'var(--bg-mint)', border: '1px solid rgba(0,51,52,0.08)', borderRadius: 22, padding: '28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-950)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
                  </div>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'rgba(0,51,52,0.12)' }}>{num}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 600, color: 'var(--green-950)', marginBottom: 8 }}>{t}</h3>
                <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
        <style>{`@media(max-width:900px){ .how-grid { grid-template-columns: 1fr 1fr !important; } } @media(max-width:520px){ .how-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ── CONSULTATION DETAILS ── */}
      <section id="consultation" className="ch-section" style={{ background: 'var(--bg-mint)' }}>
        <div className="ch-container">
          {sectionTitle('The Consultation', 'One focused session, a plan that fits your life')}
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', gap: 28, alignItems: 'stretch' }} className="consult-grid">
            {/* What's included */}
            <div data-reveal className="card-lift" style={{ background: 'white', border: '1px solid rgba(0,51,52,0.08)', borderRadius: 24, padding: 'clamp(28px,3vw,40px)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>What's Included</div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.9rem', fontWeight: 600, color: 'var(--green-950)', marginBottom: 24 }}>Everything in your <em style={{ color: 'var(--grad-start)' }}>1:1 session</em></h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }} className="incl-grid">
                {included.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--grad-start)', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-dark)', lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(0,51,52,0.08)' }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>We commonly help with</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                  {['Weight loss', 'Weight gain', 'Body recomposition', 'Muscle gain', 'Digestion', 'Sleep & stress'].map(g => (
                    <span key={g} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--green-mid)', background: 'var(--bg-soft)', border: '1px solid rgba(0,61,43,0.12)', borderRadius: 999, padding: '7px 14px' }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing / book card */}
            <div data-reveal style={{ transitionDelay: '0.1s', background: 'var(--green-950)', borderRadius: 24, padding: 'clamp(28px,3vw,38px)', color: 'white', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Book a Session</div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.7rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.15 }}>1:1 Consultation</h3>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 22 }}>with Dr. Sangmeshwar Lungare, BAMS</p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{feeLabel}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>per session</span>
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>Online or in-clinic · ~30–40 min</div>

              {['Personalised diet & herb plan', 'Free reschedule up to 4 hrs before', 'Secure payment via Razorpay'].map(x => (
                <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--grad-end)" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.85)' }}>{x}</span>
                </div>
              ))}

              <button className="btn-primary" style={{ marginTop: 26, width: '100%', background: 'var(--orange)', boxShadow: '0 8px 24px rgba(217,119,87,0.35)', fontSize: 15, padding: '15px' }} onClick={book}>Book Your Consultation →</button>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 12 }}>🔒 No charge if you cancel in time</p>
            </div>
          </div>
        </div>
        <style>{`
          @media(max-width:900px){ .consult-grid { grid-template-columns: 1fr !important; } }
          @media(max-width:520px){ .incl-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>

      {/* ── DOCTOR ── */}
      <section id="doctor" className="ch-section" style={{ background: 'var(--bg-white)' }}>
        <div className="ch-container">
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 48, alignItems: 'center', background: 'var(--bg-mint)', borderRadius: 32, padding: 'clamp(28px,4vw,48px)', boxShadow: '0 12px 48px rgba(0,51,52,0.07)', border: '1px solid rgba(0,51,52,0.07)' }} className="doctor-grid">
            <div data-reveal style={{ position: 'relative' }}>
              <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,51,52,0.15)' }}>
                <img src="public/doctor.jpeg" alt="Dr. Sangmeshwar Lungare"
                  style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', objectPosition: 'top' }}
                  onError={e => { e.target.src = 'https://images.pexels.com/photos/8939925/pexels-photo-8939925.jpeg'; }} />
              </div>
              <div style={{ position: 'absolute', bottom: -16, right: -16, background: 'var(--green-950)', color: 'white', borderRadius: 18, padding: '14px 20px', boxShadow: '0 12px 32px rgba(0,51,52,0.3)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>15+</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>Years Exp.</div>
              </div>
            </div>
            <div data-reveal style={{ transitionDelay: '0.1s' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Your Doctor</div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 600, color: 'var(--green-950)', lineHeight: 1.1, marginBottom: 8 }}>Dr. Sangmeshwar Lungare</h2>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--grad-start)', marginBottom: 18 }}>BAMS Ayurvedic Physician</div>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                With over 15 years of dedicated practice in personalised Ayurvedic wellness, Dr. Lungare has transformed 10,000+ lives globally through his unique blend of ancient wisdom and practical, modern applications.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
                {['BAMS Certified', 'Ayurvedic Medicine', 'Meditation Expert', 'Wellness Coach'].map(t => (
                  <span key={t} style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--green-mid)', background: 'var(--bg-soft)', border: '1px solid rgba(0,61,43,0.12)', borderRadius: 999, padding: '6px 14px' }}>{t}</span>
                ))}
              </div>
              <button className="btn-primary" style={{ fontSize: 15, padding: '14px 30px' }} onClick={book}>Book a Consultation →</button>
            </div>
          </div>
        </div>
        <style>{`@media(max-width:900px){ .doctor-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="ch-section" style={{ background: 'var(--green-950)' }}>
        <div className="ch-container">
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 28, height: 2, background: 'var(--orange)', borderRadius: 2 }}></div>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Reviews</span>
          </div>
          <h2 data-reveal style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 600, color: 'white', lineHeight: 1.1, marginBottom: 48 }}>
            What our patients say
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }} className="test-grid" data-reveal>
            {cTestimonials.map((t, i) => {
              const isActive = i === tIdx;
              return (
                <div key={i} style={{ background: isActive ? 'white' : 'rgba(255,255,255,0.07)', border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '28px 24px', transition: 'all 0.4s ease', opacity: isActive ? 1 : 0.55, transform: isActive ? 'scale(1.02)' : 'scale(0.97)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: isActive ? 'var(--bg-card)' : 'rgba(80,180,149,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: isActive ? 'var(--green-950)' : 'white' }}>
                      {t.initial}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, color: isActive ? 'var(--text-dark)' : 'white' }}>{t.name}</div>
                      <CStars rating={t.rating} />
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--sans)', fontSize: 13.5, lineHeight: 1.65, color: isActive ? 'var(--text-muted)' : 'rgba(255,255,255,0.65)', fontStyle: 'italic' }}>"{t.msg}"</p>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }} data-reveal>
            {cTestimonials.map((_, i) => (
              <button key={i} onClick={() => setTIdx(i)}
                style={{ width: i === tIdx ? 24 : 8, height: 8, borderRadius: 999, background: i === tIdx ? 'var(--orange)' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />
            ))}
          </div>
          <style>{`@media(max-width:768px){ .test-grid { grid-template-columns: 1fr !important; } }`}</style>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faqs" className="ch-section" style={{ background: 'var(--bg-white)' }}>
        <div className="ch-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'start' }} className="faq-grid">
            <div>
              {sectionTitle('Need Help?', 'Frequently asked questions')}
              <div style={{ background: 'var(--bg-soft)', borderRadius: 24, padding: '12px 32px 20px' }}>
                {cFaqs.map((f, i) => <CFAQ key={i} faq={f} index={i} />)}
              </div>
            </div>
            <div data-reveal style={{ position: 'sticky', top: 96 }}>
              <div style={{ background: 'var(--green-950)', borderRadius: 28, padding: '40px 36px', color: 'white' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 600, marginBottom: 10, lineHeight: 1.1 }}>Still have a question?</div>
                <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 26 }}>
                  Reach out and a care guide will reply within a few hours — or just book your consultation and ask Dr. Lungare directly.
                </p>
                <button className="btn-primary" style={{ width: '100%', background: 'var(--orange)', boxShadow: '0 8px 24px rgba(217,119,87,0.35)', fontSize: 15, padding: '15px' }} onClick={book}>Book Consultation →</button>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <a href="mailto:hello@theherbsmagic.com" style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>✉️ hello@theherbsmagic.com</a>
                  <a href="https://www.theherbsmagic.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--sans)', fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>🌐 www.theherbsmagic.com ↗</a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <style>{`@media(max-width:900px){ .faq-grid { grid-template-columns: 1fr !important; gap: 40px !important; } .faq-grid > div:last-child { position: static !important; } }`}</style>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="ch-section" style={{ background: 'var(--bg-soft)' }}>
        <div className="ch-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }} className="contact-grid">
            <div data-reveal>
              {sectionTitle('Get in Touch', 'Clinic hours')}
              <p style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28, marginTop: -20 }}>
                Online consultations are available across these hours. In-clinic visits by appointment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['Mon–Fri', '9:00 AM – 6:00 PM'], ['Saturday', '10:00 AM – 4:00 PM'], ['Sunday', 'Closed']].map(([d, t]) => (
                  <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', background: 'white', borderRadius: 12, border: '1px solid rgba(0,51,52,0.07)' }}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'var(--text-dark)' }}>{d}</span>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--text-muted)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal style={{ transitionDelay: '0.1s', background: 'var(--green-950)', borderRadius: 28, padding: '44px 36px', color: 'white', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', fontWeight: 600, marginBottom: 10 }}>Ready to feel balanced?</div>
              <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 28 }}>
                Book your 1:1 consultation with Dr. Lungare and take the first considered step toward feeling like yourself again.
              </p>
              <button className="btn-primary" style={{ background: 'var(--orange)', boxShadow: '0 8px 24px rgba(217,119,87,0.35)', fontSize: 15, padding: '15px 34px' }} onClick={book}>
                Book Consultation — {feeLabel}
              </button>
            </div>
          </div>
        </div>
        <style>{`@media(max-width:768px){ .contact-grid { grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--footer-bg)', padding: '40px 0 28px' }}>
        <div className="ch-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="public/HM.png" alt="Herbs Magic" style={{ height: 36, width: 'auto', opacity: 0.95 }} onError={e => e.target.src = 'public/image.png'} />
              <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: '0.06em' }}>HERBS MAGIC</span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[['How It Works', 'how'], ['Consultation', 'consultation'], ['Your Doctor', 'doctor'], ['FAQs', 'faqs'], ['Contact', 'contact']].map(([l, id]) => (
                <span key={l} onClick={() => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' }); }} style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.55)'}>{l}</span>
              ))}
            </div>
          </div>
          <div style={{ paddingTop: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© 2025 Herbs Magic. All rights reserved.</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Ayurveda · Consultation · Wellness</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

window.ConsultationHome = ConsultationHome;
