import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { navigate, useRouter } from "../lib/router";
import { NotificationsFeed } from "../components/feed/NotificationsFeed";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount } from "../state/store";

export function NotificationsPage({ mode }: { mode?: "all" | "mentions" }): JSX.Element {
  const account = currentAccount();
  const route = useRouter();
  const active = mode ?? (route.path === "/mentions" ? "mentions" : "all");

  if (!account) {
    return (
      <PageShell title={t.notifications}>
        <div class="center-state">
          <Icon name="notification-line" size={28} />
          <h3>{t.loginSubtitle}</h3>
          <button type="button" class="btn primary" onClick={() => navigate("/login")}>
            {t.loginButton}
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t.notifications}>
      <div class="subtabs">
        <button
          type="button"
          class={`subtab ${active === "all" ? "active" : ""}`}
          onClick={() => navigate("/notifications")}
        >
          {t.all}
        </button>
        <button
          type="button"
          class={`subtab ${active === "mentions" ? "active" : ""}`}
          onClick={() => navigate("/mentions")}
        >
          {t.mentions}
        </button>
      </div>
      <NotificationsFeed instance={account.instance} mode={active} />
    </PageShell>
  );
}
