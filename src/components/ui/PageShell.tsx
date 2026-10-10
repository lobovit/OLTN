import type { ComponentChildren, JSX } from "preact";
import { back } from "../../lib/router";
import { Icon } from "./Icon";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ComponentChildren;
  showBack?: boolean;
  children: ComponentChildren;
  flush?: boolean;
}

export function PageShell({
  title,
  subtitle,
  actions,
  showBack,
  children,
}: PageShellProps): JSX.Element {
  return (
    <>
      <header class="deck-header">
        {showBack && (
          <button
            type="button"
            class="icon-btn back-btn"
            onClick={() => back()}
            aria-label="Voltar"
          >
            <Icon name="back-line" size={20} />
          </button>
        )}
        <div class="page-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <div class="subtitle ellipsis">{subtitle}</div>}
          </div>
        </div>
        <div class="spacer" />
        {actions}
      </header>
      <div class="deck-body">{children}</div>
    </>
  );
}
