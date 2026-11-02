import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { t } from "../../i18n/pt-BR";
import {
  disablePush,
  enablePush,
  isPushEnabled,
  preparePush,
  PushError,
  pushSupport,
  type PushSupport,
} from "../../lib/push";
import { pushErrorMessage } from "../../lib/push-errors";
import { beginAccountReconnect } from "../../state/boot";
import { currentAccount, toast } from "../../state/store";
import { Icon } from "../ui/Icon";

export function PushSettings(): JSX.Element | null {
  const account = currentAccount();
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const next = pushSupport();
    setSupport(next);
    if (next === "supported") setPermission(Notification.permission);
    if (!account || next !== "supported") {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    void isPushEnabled(account)
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    void preparePush(account)
      .catch((err) => {
        if (!cancelled && err instanceof PushError && err.kind === "scope") setNeedsAuth(true);
      })
      .then(() => {
        if (cancelled) return;
        void isPushEnabled(account)
          .then((value) => {
            if (!cancelled) setEnabled(value);
          })
          .catch(() => {});
      });
    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.instance]);

  if (!account) return null;

  const reconnect = async (): Promise<void> => {
    if (reconnecting) return;
    setReconnecting(true);
    try {
      await beginAccountReconnect(account);
    } catch {
      toast(t.pushReconnectError, "error");
      setReconnecting(false);
    }
  };

  const toggle = async (): Promise<void> => {
    if (busy || checking || needsAuth) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush(account);
        setEnabled(false);
        toast(t.pushDisabledToast, "ok");
      } else {
        await enablePush(account);
        setEnabled(true);
        toast(t.pushEnabledToast, "ok");
      }
    } catch (err) {
      toast(err instanceof PushError ? pushErrorMessage(err.kind) : t.pushError, "error");
    } finally {
      if (support === "supported") setPermission(Notification.permission);
      setBusy(false);
    }
  };

  return (
    <section class="settings-section">
      <h2 class="section-title">{t.pushNotifications}</h2>
      {support === "supported" ? (
        needsAuth ? (
          <>
            <p class="muted">{t.pushScopeError}</p>
            <button
              type="button"
              class="btn primary"
              disabled={reconnecting}
              onClick={() => void reconnect()}
            >
              {reconnecting ? <span class="spinner" /> : <Icon name="refresh-2-line" size={16} />}
              {t.pushReconnect}
            </button>
          </>
        ) : (
          <>
            <div class="setting-row">
              <span>{enabled ? t.pushEnabled : t.pushDisabled}</span>
              <button
                type="button"
                class="btn"
                disabled={busy || checking}
                onClick={() => void toggle()}
              >
                {busy ? <span class="spinner" /> : <Icon name="notification-line" size={16} />}
                {enabled ? t.pushDisable : t.pushEnable}
              </button>
            </div>
            {permission === "denied" && <p class="muted">{t.pushPermissionDenied}</p>}
          </>
        )
      ) : (
        <p class="muted">{support === "insecure" ? t.pushInsecure : t.pushUnsupported}</p>
      )}
    </section>
  );
}
