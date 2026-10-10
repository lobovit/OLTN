import type { JSX } from "preact";
import { Component } from "preact";
import type { ComponentChildren } from "preact";
import { t } from "../../i18n/pt-BR";
import { Icon } from "./Icon";

interface ErrorBoundaryProps {
  children: ComponentChildren;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Captura erros de renderização e mostra um fallback amigável. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error("[oltn] render error", error);
  }

  override render(): JSX.Element {
    if (this.state.error) {
      return (
        <div class="center-state error-boundary">
          <Icon name="information-line" size={28} />
          <h3>{t.error}</h3>
          <button type="button" class="btn" onClick={() => location.reload()}>
            <Icon name="refresh-2-line" size={16} />
            {t.reloadApp}
          </button>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}
