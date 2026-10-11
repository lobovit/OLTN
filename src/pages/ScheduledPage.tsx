import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { getRest } from "../api/client";
import type { ScheduledStatus } from "../api/types";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { fullDate, toLocalInputValue } from "../lib/format";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount, toast } from "../state/store";

export function ScheduledPage(): JSX.Element {
  const [items, setItems] = useState<ScheduledStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async (): Promise<void> => {
    const account = currentAccount();
    if (!account) return;
    setLoading(true);
    try {
      const page = await getRest(account.instance, account.accessToken).v1.scheduledStatuses.list({
        limit: 40,
      });
      setItems([...page]);
    } catch (err) {
      console.warn("[oltn] scheduled statuses load failed", err);
      toast(userMessageForError(err, t.errorLoad), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (item: ScheduledStatus): Promise<void> => {
    const account = currentAccount();
    if (!account || busyId) return;
    setBusyId(item.id);
    try {
      await getRest(account.instance, account.accessToken)
        .v1.scheduledStatuses.$select(item.id)
        .remove();
      setItems((prev) => prev.filter((s) => s.id !== item.id));
      if (editingId === item.id) setEditingId(null);
      toast(t.scheduledCancelled, "ok");
    } catch (err) {
      console.warn("[oltn] scheduled cancel failed", err);
      toast(userMessageForError(err, t.errorGeneric), "error");
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: ScheduledStatus): void => {
    setEditingId(item.id);
    setEditValue(toLocalInputValue(new Date(item.scheduledAt)));
  };

  const editDate = editValue ? new Date(editValue) : null;
  const editValid = !!editDate && editDate.getTime() >= Date.now() + 5 * 60_000;

  const reschedule = async (item: ScheduledStatus): Promise<void> => {
    const account = currentAccount();
    if (!account || busyId || !editDate || !editValid) return;
    setBusyId(item.id);
    try {
      const updated = await getRest(account.instance, account.accessToken)
        .v1.scheduledStatuses.$select(item.id)
        .update({ scheduledAt: editDate.toISOString() });
      setItems((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
      setEditingId(null);
      toast(t.rescheduled, "ok");
    } catch (err) {
      console.warn("[oltn] scheduled update failed", err);
      toast(userMessageForError(err, t.errorSave), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell title={t.scheduledPosts} showBack>
      {loading ? (
        <div class="center-state">
          <span class="spinner" />
        </div>
      ) : !items.length ? (
        <div class="center-state">
          <Icon name="calendar-line" size={28} />
          <h3>{t.emptyScheduled}</h3>
        </div>
      ) : (
        <div class="account-list">
          {items.map((item) => (
            <div class="list-row" key={item.id}>
              <Icon name="calendar-line" size={18} />
              <div class="row-main">
                <div class="row-title ellipsis">{item.params.text || t.media}</div>
                <div class="row-sub">
                  {t.scheduledFor} {fullDate(item.scheduledAt)}
                </div>
                {editingId === item.id && (
                  <div class="schedule-edit">
                    <input
                      type="datetime-local"
                      class="field"
                      min={toLocalInputValue(new Date(Date.now() + 5 * 60_000))}
                      value={editValue}
                      onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
                    />
                    {!editValid && <span class="schedule-error">{t.scheduleTooSoon}</span>}
                    <div class="schedule-actions">
                      <button type="button" class="btn ghost sm" onClick={() => setEditingId(null)}>
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        class="btn primary sm"
                        disabled={!editValid || busyId === item.id}
                        onClick={() => void reschedule(item)}
                      >
                        {busyId === item.id && <span class="spinner" />}
                        {t.confirm}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {editingId !== item.id && (
                <>
                  <button
                    type="button"
                    class="icon-btn"
                    title={t.reschedule}
                    aria-label={t.reschedule}
                    disabled={busyId === item.id}
                    onClick={() => startEdit(item)}
                  >
                    <Icon name="calendar-line" size={18} />
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    title={t.cancelScheduled}
                    aria-label={t.cancelScheduled}
                    disabled={busyId === item.id}
                    onClick={() => void cancel(item)}
                  >
                    {busyId === item.id ? (
                      <span class="spinner" />
                    ) : (
                      <Icon name="delete-line" size={18} />
                    )}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
