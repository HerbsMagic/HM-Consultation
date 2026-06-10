const { useState: useNavState, useEffect: useNavEffect } = React;

function Navbar({ page, setPage }) {
  const [scrolled, setScrolled] = useNavState(false);
  const [mobileOpen, setMobileOpen] = useNavState(false);

  useNavEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMobileOpen(false);
    if (page !== 'home') { setPage('home'); setTimeout(() => scrollToId(id), 140); return; }
    scrollToId(id);
  };
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const navLinks = [
    { id: 'how', label: 'How It Works' },
    { id: 'consultation', label: 'Consultation' },
    { id: 'doctor', label: 'Your Doctor' },
    { id: 'testimonials', label: 'Reviews' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(247,251,249,0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${scrolled ? 'rgba(0,51,52,0.12)' : 'transparent'}`,
      boxShadow: scrolled ? '0 4px 32px rgba(0,51,52,0.09)' : 'none',
      transition: 'all 0.35s ease',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 clamp(1rem,3vw,2rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          {/* Logo */}
          <div onClick={() => { setPage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <img src="public/HM.png" alt="Herbs Magic" style={{ height: 44, width: 'auto' }}
              onError={e => e.target.src = 'public/image.png'} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 700, color: 'var(--green-950)', letterSpacing: '0.04em' }}>HERBS MAGIC</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 500, color: 'var(--grad-start)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ayurvedic Consultation</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(238,244,242,0.7)', border: '1px solid rgba(0,51,52,0.1)', borderRadius: 999, padding: '6px 10px' }}
            className="nav-desktop">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)} style={{
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, color: 'var(--green-mid)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '7px 14px',
                borderRadius: 999, transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'white'; e.target.style.color = 'var(--green-950)'; }}
              onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--green-mid)'; }}>
                {l.label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <button onClick={() => setPage('appointment')}
            className="nav-cta"
            style={{
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'white',
              background: 'linear-gradient(135deg, var(--green-950), var(--green-700))',
              border: 'none', cursor: 'pointer', padding: '10px 22px',
              borderRadius: 999, letterSpacing: '0.02em',
              boxShadow: '0 6px 20px rgba(0,51,52,0.3)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,51,52,0.38)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,51,52,0.3)'; }}>
            Book Consultation
          </button>

          {/* Mobile toggle */}
          <button className="nav-hamburger" onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: 'none', background: 'none', border: '1px solid rgba(0,51,52,0.2)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', color: 'var(--green-950)' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ padding: '12px 0 16px', borderTop: '1px solid rgba(0,51,52,0.08)' }}>
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 500, color: 'var(--text-dark)', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 10, transition: 'background 0.2s' }}
                onMouseEnter={e => e.target.style.background = 'var(--bg-soft)'}
                onMouseLeave={e => e.target.style.background = 'none'}>
                {l.label}
              </button>
            ))}
            <button onClick={() => { setMobileOpen(false); setPage('appointment'); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, var(--green-950), var(--green-700))', border: 'none', cursor: 'pointer', padding: '12px', borderRadius: 10, marginTop: 8 }}>
              Book Consultation
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-cta { display: none !important; }
          .nav-hamburger { display: flex !important; align-items: center; }
        }
      `}</style>
    </nav>
  );
}

window.Navbar = Navbar;
