export default function Loading() {
  return (
    <main className="system-state-page" aria-busy="true" aria-live="polite">
      <section className="system-state-card system-state-loading">
        <span className="system-state-orbit" aria-hidden="true" />
        <span className="section-kicker">Gestão de Institutos</span>
        <h1>Organizando a operação.</h1>
        <p>Os dados da competência estão sendo preparados.</p>
      </section>
    </main>
  );
}
