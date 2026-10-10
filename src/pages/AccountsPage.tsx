import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../i18n/pt-BR";
import { navigate } from "../lib/router";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { removeAccount, switchAccount } from "../state/boot";
import { store } from "../state/store";

export function AccountsPage(): JSX.Element {
  const snap = useSnapshot(store);
  const accounts = snap.accounts;
  const currentId = snap.currentAccountId;

  const remove = (id: string): void => {
    const wasCurrent = id === currentId;
    removeAccount(id);
    if (wasCurrent) {
      if (store.currentAccountId) {
        void switchAccount(store.currentAccountId);
      } else {
        navigate("/login", { replace: true });
      }
    }
  };

  return (
    <PageShell title={t.accounts} showBack>
      <div class="account-list">
        {accounts.map((account) => (
          <div class="list-row" key={account.id}>
            <Avatar src={account.avatar} name={account.displayName} size={38} />
            <div class="row-main">
              <div class="row-title">{account.displayName}</div>
              <div class="row-sub">{account.handle}</div>
            </div>
            {account.id === currentId ? (
              <Icon name="check-line" size={18} />
            ) : (
              <button
                type="button"
                class="btn ghost small"
                onClick={() => {
                  void switchAccount(account.id).then(() => navigate("/", { replace: true }));
                }}
              >
                {t.switchAccount}
              </button>
            )}
            <button
              type="button"
              class="icon-btn"
              aria-label={t.delete}
              onClick={() => {
                if (confirm(t.removeAccountConfirm)) remove(account.id);
              }}
            >
              <Icon name="delete-line" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: "16px" }}>
        <button type="button" class="btn primary block" onClick={() => navigate("/login")}>
          <Icon name="plus-line" size={16} />
          {t.addAccount}
        </button>
      </div>
    </PageShell>
  );
}
