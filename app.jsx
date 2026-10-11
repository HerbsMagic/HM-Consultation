const { useState: useAppState, useEffect: useAppEffect } = React;

// The admin panel lives at /admin (or #/admin when the static server has no rewrite, e.g. local `serve`).
const isAdminRoute = () => /^\/admin\/?$/.test(window.location.pathname) || window.location.hash.startsWith('#/admin');

function App() {
  const [page, setPage] = useAppState(isAdminRoute() ? 'admin' : 'home');

  useAppEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);

  useAppEffect(() => {
    const onHash = () => setPage(p => (isAdminRoute() ? 'admin' : p === 'admin' ? 'home' : p));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (page === 'admin') return <AdminPanel />;

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
