const { useState: useAppState, useEffect: useAppEffect } = React;

function App() {
  const [page, setPage] = useAppState('home');

  useAppEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);

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
