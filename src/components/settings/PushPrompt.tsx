import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { readJSON, writeJSON } from "../../lib/storage";
import { enablePush, preparePush, PushError, pushSupport } from "../../lib/push";
import { pushErrorMessage } from "../../lib/push-errors";
import { beginAccountReconnect } from "../../state/boot";
import { currentAccount, store, toast } from "../../state/store";
import { Icon } from "../ui/Icon";

const DISMISS_KEY = "push-prompt-dismissed";

type PromptAction = "enable" | "reconnect";

export function PushPrompt(): JSX.Element | null {
  const snap = useSnapshot(store);
  const account = currentAccount();
  const [action, setAction] = useState<PromptAction | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!snap.booted || snap.auth !== "authenticated" || !account) return;
    if (readJSON<boolean>(DISMISS_KEY, false)) return;
    if (pushSupport() !== "supported" || Notification.permission !== "default") return;
    let cancelled = false;
    setVisible(false);
    setAction(null);
    void preparePush(account)
      .then(() => {
        if (cancelled) return;
        setAction("enable");
        setVisible(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof PushError && err.kind === "scope") {
          setAction("reconnect");
          setVisible(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [snap.booted, snap.auth, account?.id, account?.instance]);

  if (!visible || !action) return null;

  const dismiss = (): void => {
    writeJSON(DISMISS_KEY, true);
    setVisible(false);
  };

  const activate = async (): Promise<void> => {
    if (!account || busy) return;
    setBusy(true);
    try {
      if (action === "reconnect") {
        await beginAccountReconnect(account);
        return;
      }
      await enablePush(account);
      writeJSON(DISMISS_KEY, true);
      setVisible(false);
      toast(t.pushEnabledToast, "ok");
    } catch (err) {
      if (err instanceof PushError) {
        if (err.kind === "permission") {
          writeJSON(DISMISS_KEY, true);
          setVisible(false);
        } else if (err.kind === "scope") {
          setAction("reconnect");
        }
        toast(pushErrorMessage(err.kind), "error");
      } else {
        toast(t.pushError, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside class="push-prompt" aria-label={t.pushPromptTitle}>
      <span class="push-prompt-icon">
        <Icon name="notification-line" size={18} />
      </span>
      <div class="push-prompt-copy">
        <strong>{t.pushPromptTitle}</strong>
        <span>{action === "reconnect" ? t.pushPromptReconnectText : t.pushHint}</span>
      </div>
      <div class="push-prompt-actions">
        <button type="button" class="btn sm ghost" onClick={dismiss}>
          {t.pushLater}
        </button>
        <button
          type="button"
          class="btn sm primary"
          disabled={busy}
          onClick={() => void activate()}
        >
          {busy ? <span class="spinner" /> : null}
          {action === "reconnect" ? t.pushReconnect : t.pushActivate}
        </button>
      </div>
    </aside>
  );
}
