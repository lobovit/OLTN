import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../i18n/pt-BR";
import { navigate } from "../lib/router";
import { Timeline } from "../components/feed/Timeline";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount, store, type StreamState } from "../state/store";

function streamLabel(stream: StreamState): string {
  if (stream === "on") return t.streamingOn;
  if (stream === "connecting") return t.streamingConnecting;
  return t.streamingOff;
}

export function HomePage(): JSX.Element {
  const account = currentAccount();
  const stream = useSnapshot(store).stream;
  const label = streamLabel(stream);

  return (
    <PageShell
      title={t.home}
      actions={
        <>
          <span
            class={`stream-dot ${stream === "on" ? "on" : ""}`}
            aria-hidden="true"
            title={label}
          />
          <span class="sr-only">{label}</span>
          <button
            type="button"
            class="icon-btn"
            onClick={() => navigate("/settings")}
            aria-label={t.shortcuts}
          >
            <Icon name="keyboard-line" size={18} />
          </button>
        </>
      }
    >
      {account ? (
        <Timeline
          kind={{ type: "home" }}
          instance={account.instance}
          listenQueue
          emptyTitle={t.emptyHome}
          emptyHint={t.emptyHomeHint}
        />
      ) : (
        <div class="center-state">
          <Icon name="home-3-line" size={28} />
          <h3>{t.loginSubtitle}</h3>
          <button type="button" class="btn primary" onClick={() => navigate("/login")}>
            {t.loginButton}
          </button>
        </div>
      )}
    </PageShell>
  );
}
