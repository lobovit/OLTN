import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Account } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { clientFor, hrefFor } from "../../lib/identity";
import { Link } from "../../lib/router";
import { toast } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { useAccountSearch } from "./useAccountSearch";

interface Props {
  instance: string;
  listId: string;
}

/** Members tab: paginated list with remove, plus account search to add. */
export function ListMembers({ instance, listId }: Props): JSX.Element {
  const [members, setMembers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [handle, setHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const iterator = useRef<AsyncIterableIterator<Account[]> | null>(null);
  const suggestions = useAccountSearch(
    instance,
    handle,
    members.map((member) => member.id),
  );

  const fetchPage = useCallback(
    async (first: boolean) => {
      if (first) {
        iterator.current = null;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        if (!iterator.current) {
          iterator.current = clientFor(instance)
            .client.v1.lists.$select(listId)
            .accounts.list({ limit: 40 })
            .values();
        }
        const page = await iterator.current.next();
        const value: Account[] = page.value ?? [];
        if (page.done) iterator.current = null;
        setMembers((prev: Account[]) => {
          if (first) return value;
          const seen = new Set(prev.map((member) => member.id));
          return [...prev, ...value.filter((member) => !seen.has(member.id))];
        });
        setMore(!page.done && value.length >= 40);
      } catch (err) {
        console.warn("[oltn] list members failed", err);
        toast(userMessageForError(err), "error");
        setMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [instance, listId],
  );

  useEffect(() => {
    setMembers([]);
    setHandle("");
    void fetchPage(true);
  }, [fetchPage]);

  const addMember = async (candidate: Account): Promise<void> => {
    if (adding) return;
    setAdding(true);
    try {
      await clientFor(instance)
        .client.v1.lists.$select(listId)
        .accounts.create({ accountIds: [candidate.id] });
      setHandle("");
      toast(t.listMemberAdded, "ok");
      await fetchPage(true);
    } catch (err) {
      console.warn("[oltn] list member add failed", err);
      toast(userMessageForError(err), "error");
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member: Account): Promise<void> => {
    try {
      await clientFor(instance)
        .client.v1.lists.$select(listId)
        .accounts.remove({ accountIds: [member.id] });
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
      toast(t.listMemberRemoved, "ok");
    } catch (err) {
      console.warn("[oltn] list member remove failed", err);
      toast(userMessageForError(err), "error");
    }
  };

  return (
    <div class="list-members">
      <div class="list-member-tools">
        <input
          class="field"
          placeholder={t.memberSearchPlaceholder}
          aria-label={t.addMember}
          value={handle}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          onInput={(e) => setHandle((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = suggestions[0];
            if (first) void addMember(first);
          }}
        />
        <p class="muted list-member-hint">{t.membersOnlyFollowed}</p>
        {handle.trim() && suggestions.length > 0 && (
          <div class="list-suggestions" role="listbox" aria-label={t.addMember}>
            {suggestions.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="option"
                class="list-suggestion"
                disabled={adding}
                onClick={() => void addMember(candidate)}
              >
                <Avatar
                  src={candidate.avatarStatic || candidate.avatar}
                  name={candidate.displayName || candidate.username}
                  size={26}
                />
                <span class="list-suggestion-name">
                  {candidate.displayName || candidate.username}
                </span>
                <span class="list-suggestion-acct">@{candidate.acct}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div class="center-state">
          <span class="spinner" />
        </div>
      ) : !members.length ? (
        <div class="center-state">
          <Icon name="group-line" size={28} />
          <h3>{t.noMembers}</h3>
        </div>
      ) : (
        <div class="account-list">
          {members.map((member) => (
            <div class="list-row list-member-row" key={member.id}>
              <Link class="list-row-main" href={hrefFor.accountById(instance, member.id)}>
                <Avatar
                  src={member.avatar}
                  name={member.displayName || member.username}
                  size={38}
                />
                <div class="row-main">
                  <div class="row-title">{member.displayName || member.username}</div>
                  <div class="row-sub">@{member.acct}</div>
                </div>
              </Link>
              <button
                type="button"
                class="icon-btn danger"
                title={t.removeFromList}
                aria-label={t.removeFromList}
                onClick={() => void removeMember(member)}
              >
                <Icon name="close-line" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {more && !loading && (
        <div class="load-more">
          <button
            type="button"
            class="btn ghost"
            disabled={loadingMore}
            onClick={() => void fetchPage(false)}
          >
            {loadingMore ? <span class="spinner" /> : <Icon name="dropdown-line" size={16} />}
            {loadingMore ? t.loadingMore : t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
