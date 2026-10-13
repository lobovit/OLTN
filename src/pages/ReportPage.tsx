import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { t } from "../i18n/pt-BR";
import { sendReport, type ReportType } from "../lib/report";
import { toast } from "../state/store";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import "./report.css";

/** Report problems or suggest improvements (goes to the author's inbox). */
export function ReportPage(): JSX.Element {
  const [type, setType] = useState<ReportType>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const ok = await sendReport({ type, message, email: email.trim() || undefined });
      if (!ok) {
        toast(t.reportFailed, "error");
        return;
      }
      setMessage("");
      setEmail("");
      toast(t.reportThanks, "ok");
    } catch (err) {
      console.warn("[oltn] report failed", err);
      toast(t.reportFailed, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell title={t.reportIssues} showBack>
      <form class="report" onSubmit={(e) => void submit(e)}>
        <p class="muted">{t.reportHint}</p>

        <div class="report-types" role="radiogroup" aria-label={t.reportIssues}>
          <button
            type="button"
            class={`report-type ${type === "bug" ? "active" : ""}`}
            aria-pressed={type === "bug"}
            onClick={() => setType("bug")}
          >
            <Icon name="bug-line" size={15} />
            {t.reportProblem}
          </button>
          <button
            type="button"
            class={`report-type ${type === "suggestion" ? "active" : ""}`}
            aria-pressed={type === "suggestion"}
            onClick={() => setType("suggestion")}
          >
            <Icon name="bulb-line" size={15} />
            {t.reportSuggestion}
          </button>
        </div>

        <textarea
          class="field report-message"
          rows={6}
          placeholder={t.reportMessagePlaceholder}
          value={message}
          onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
        />
        <input
          class="field report-email"
          type="email"
          placeholder={t.reportReplyPlaceholder}
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn primary report-send" disabled={!message.trim() || sending}>
          {sending ? <span class="spinner" /> : <Icon name="share-forward-line" size={15} />}
          {sending ? t.reportSending : t.reportSend}
        </button>
      </form>
    </PageShell>
  );
}
