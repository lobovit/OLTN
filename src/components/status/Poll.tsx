import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Poll } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { fullDate, fullNumber, shortDate } from "../../lib/format";
import { currentAccount, patchStatus, toast } from "../../state/store";

interface PollViewProps {
  poll: Poll;
  statusKey: string;
  instance: string;
  canVote: boolean;
}

export function PollView({ poll, statusKey, instance, canVote }: PollViewProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const expired = poll.expired;
  const showResults = poll.voted || expired;
  const total = poll.votersCount ?? poll.votesCount;

  const vote = async (index: number): Promise<void> => {
    if (!canVote || busy || expired) return;
    if (!poll.multiple && poll.voted) return;
    const account = currentAccount();
    if (!account || account.instance !== instance) return;
    setBusy(true);
    try {
      const client = getRest(account.instance, account.accessToken);
      const updated = await client.v1.polls.$select(poll.id).votes.create({
        choices: [index],
      });
      patchStatus(statusKey, { poll: updated as Poll });
    } catch (err) {
      console.warn("[oltn] vote failed", err);
      toast(t.errorGeneric, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="poll" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((option, index) => {
        const votes = option.votesCount ?? 0;
        const pct = showResults && total > 0 ? Math.round((votes / total) * 100) : 0;
        const chosen = poll.ownVotes?.includes(index);
        return (
          <button
            key={index}
            type="button"
            class={`poll-option ${canVote && !expired ? "votable" : ""}`}
            onClick={() => void vote(index)}
            disabled={!canVote || expired || busy}
          >
            {showResults && <span class="bar" style={{ width: `${pct}%` }} />}
            <span class="label">
              {chosen && "✓ "}
              {option.title}
            </span>
            {showResults && total > 0 && <span class="pct">{pct}%</span>}
          </button>
        );
      })}
      <div class="poll-meta">
        <span>
          {fullNumber(total)} {total === 1 ? t.voteOne : t.voteMany}
        </span>
        <span title={poll.expiresAt ? fullDate(poll.expiresAt) : undefined}>
          {expired
            ? t.pollClosed
            : `${t.pollExpires} ${poll.expiresAt ? shortDate(poll.expiresAt) : t.soon}`}
        </span>
        {poll.multiple && <span>{t.pollMultiple}</span>}
      </div>
    </div>
  );
}
