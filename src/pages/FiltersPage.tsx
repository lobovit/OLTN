import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { getRest } from "../api/client";
import type { Filter } from "../api/types";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount, toast } from "../state/store";

function contextLabel(context: string): string {
  switch (context) {
    case "home":
      return t.contextHome;
    case "notifications":
      return t.contextNotifications;
    case "public":
      return t.contextPublic;
    case "thread":
      return t.contextThread;
    case "account":
      return t.contextAccount;
    default:
      return context;
  }
}

export function FiltersPage(): JSX.Element {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [phrase, setPhrase] = useState("");
  const [title, setTitle] = useState("");
  const [action, setAction] = useState<"warn" | "hide">("warn");

  const reload = useCallback(async () => {
    const account = currentAccount();
    if (!account) {
      setLoading(false);
      return;
    }
    const client = getRest(account.instance, account.accessToken);
    try {
      setFilters(await client.v2.filters.list());
    } catch (err) {
      console.warn("[oltn] filters load failed", err);
      setFilters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (e: Event): Promise<void> => {
    e.preventDefault();
    const account = currentAccount();
    if (!account || !phrase.trim()) return;
    const client = getRest(account.instance, account.accessToken);
    try {
      await client.v2.filters.create({
        title: title.trim() || phrase.trim(),
        context: ["home", "public"],
        filterAction: action,
        keywordsAttributes: [{ keyword: phrase.trim() }],
      });
      setPhrase("");
      setTitle("");
      toast(t.save);
      await reload();
    } catch (err) {
      console.warn("[oltn] filter create failed", err);
      toast(userMessageForError(err), "error");
    }
  };

  const remove = async (id: string): Promise<void> => {
    const account = currentAccount();
    if (!account) return;
    const client = getRest(account.instance, account.accessToken);
    try {
      await client.v2.filters.$select(id).remove();
      await reload();
    } catch (err) {
      console.warn("[oltn] filter remove failed", err);
      toast(userMessageForError(err), "error");
    }
  };

  let body: JSX.Element;
  if (loading) {
    body = (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  } else if (!filters.length) {
    body = (
      <div class="center-state">
        <Icon name="filter-line" size={28} />
        <h3>{t.emptyFilters}</h3>
      </div>
    );
  } else {
    body = (
      <div class="account-list">
        {filters.map((filter) => (
          <div class="list-row" key={filter.id}>
            <Icon name="filter-line" size={18} />
            <div class="row-main">
              <div class="row-title">{filter.title}</div>
              <div class="row-sub">
                {filter.keywords.map((k) => k.keyword).join(", ")} —{" "}
                {filter.filterAction === "hide" ? t.filterHides : t.filterWarns}{" "}
                {filter.context.map(contextLabel).join(", ")}
              </div>
            </div>
            <button
              type="button"
              class="icon-btn"
              aria-label={t.delete}
              onClick={() => void remove(filter.id)}
            >
              <Icon name="delete-line" size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <PageShell title={t.filters} showBack>
      <form class="filter-create" onSubmit={(e) => void create(e)}>
        <input
          class="field"
          placeholder={t.contentWarning}
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
        />
        <input
          class="field"
          placeholder={t.filterKeywordPlaceholder}
          value={phrase}
          onInput={(e) => setPhrase((e.target as HTMLInputElement).value)}
        />
        <div class="segmented">
          {(["warn", "hide"] as const).map((a) => (
            <button
              key={a}
              type="button"
              class={`seg ${action === a ? "active" : ""}`}
              onClick={() => setAction(a)}
            >
              {a === "warn" ? t.warn : t.hide}
            </button>
          ))}
        </div>
        <button type="submit" class="btn primary" disabled={!phrase.trim()}>
          <Icon name="plus-line" size={16} />
          {t.save}
        </button>
      </form>
      {body}
    </PageShell>
  );
}
