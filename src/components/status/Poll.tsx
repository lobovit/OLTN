import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { Poll } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { fullDate, fullNumber, shortDate } from "../../lib/format";
import { clientFor } from "../../lib/identity";
import { votePoll } from "../../state/status-actions";
import { currentAccount } from "../../state/store";

interface PollViewProps {
  poll: Poll;
  statusKey: string;
  canVote: boolean;
}

export function PollView({ poll, statusKey, canVote }: PollViewProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const expired = poll.expired;
  const showResults = poll.voted || expired;
  const total = poll.votersCount ?? poll.votesCount;

  const vote = async (index: number): Promise<void> => {
    const account = currentAccount();
    if (!canVote || busy || expired || !account) return;
    setBusy(true);
    try {
      await votePoll(clientFor(account.instance), statusKey, index);
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
