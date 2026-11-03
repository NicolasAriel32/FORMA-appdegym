import { useEffect, useState } from "react";
import type { ReactElement } from "react";

export default function App(): ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">FORMA · MVP técnico</p>
        <h1 id="app-title">Entrená con continuidad.</h1>
        <p className="lead">
          La carcasa PWA está lista. El entrenamiento offline, la identidad y la sincronización se incorporarán por incrementos verificables.
        </p>
        <div className={`connection-status ${online ? "is-online" : "is-offline"}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {online ? "Con conexión" : "Sin conexión"}
        </div>
      </section>

      <section className="technical-card" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">Estado del proyecto</p>
          <h2 id="status-title">Base offline-first preparada</h2>
        </div>
        <ul>
          <li>Persistencia local atómica</li>
          <li>Outbox con operaciones idempotentes</li>
          <li>Recuperación por cursor y snapshot</li>
        </ul>
      </section>
    </main>
  );
}
