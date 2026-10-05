import { Component, type ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="startup glass" role="alert">
        <h1>No se pudo abrir el tablero</h1>
        <p>
          Recarga para obtener una versión consistente de la aplicación y sus
          datos.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reintentar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
