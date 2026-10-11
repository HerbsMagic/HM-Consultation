const { useState: useAppState, useEffect: useAppEffect } = React;

// The admin panel lives at /admin (or #/admin when the static server has no rewrite, e.g. local `serve`).
const isAdminRoute = () => /^\/admin\/?$/.test(window.location.pathname) || window.location.hash.startsWith('#/admin');
// The web server sends every unknown path to index.html, so unknown paths must be caught here.
const isKnownRoute = () => /^\/(index\.html)?$/.test(window.location.pathname) || isAdminRoute();

function NotFound() {
  useAppEffect(() => {
    const previous = document.title;
    document.title = 'Page not found | Herbs Magic';
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => { document.title = previous; robots.remove(); };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ background: 'white', borderRadius: 28, padding: 'clamp(32px,6vw,52px) clamp(24px,5vw,40px)', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,51,52,0.1)' }}>
        <img src="public/HM.png" alt="Herbs Magic" style={{ height: 52, width: 'auto', marginBottom: 20 }} onError={e => e.target.src = 'public/image.png'} />
        <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(3.5rem,10vw,5rem)', fontWeight: 700, color: 'var(--green-950)', lineHeight: 1 }}>404</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.9rem', fontWeight: 600, color: 'var(--green-950)', margin: '10px 0 12px' }}>Page not found</h1>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
          There is nothing at this address. Check the link for a typo, or head back to the homepage.
        </p>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)', overflowWrap: 'anywhere', marginBottom: 26 }}>{window.location.pathname}</p>
        <a href="/" style={{ display: 'inline-block', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, var(--green-950), var(--green-700))', textDecoration: 'none', padding: '13px 28px', borderRadius: 999, boxShadow: '0 6px 20px rgba(0,51,52,0.28)' }}>← Back to homepage</a>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useAppState(isAdminRoute() ? 'admin' : isKnownRoute() ? 'home' : 'notfound');

  useAppEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);

  useAppEffect(() => {
    const onHash = () => setPage(p => (isAdminRoute() ? 'admin' : p === 'admin' ? 'home' : p));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (page === 'admin') return <AdminPanel />;
  if (page === 'notfound') return <NotFound />;

  return (
    <div>
      <Navbar page={page} setPage={setPage} />
      {page === 'appointment'
        ? <AppointmentBooking setPage={setPage} />
        : <ConsultationHome setPage={setPage} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
