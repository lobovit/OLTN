import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { getRest } from "../api/client";
import type { List } from "../api/types";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { navigate } from "../lib/router";
import { Timeline } from "../components/feed/Timeline";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount, toast } from "../state/store";

export function ListsPage(): JSX.Element {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  const reload = useCallback(async () => {
    const account = currentAccount();
    if (!account) {
      setLoading(false);
      return;
    }
    const client = getRest(account.instance, account.accessToken);
    try {
      setLists(await client.v1.lists.list());
    } catch (err) {
      console.warn("[oltn] lists load failed", err);
      setLists([]);
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
    const name = title.trim();
    if (!account || !name) return;
    const client = getRest(account.instance, account.accessToken);
    try {
      await client.v1.lists.create({ title: name });
      setTitle("");
      toast(t.save);
      await reload();
    } catch (err) {
      console.warn("[oltn] list create failed", err);
      toast(userMessageForError(err), "error");
    }
  };

  return (
    <PageShell title={t.lists} showBack>
      <form class="list-create" onSubmit={(e) => void create(e)}>
        <input
          class="field"
          placeholder={t.newListPlaceholder}
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn primary" disabled={!title.trim()}>
          <Icon name="plus-line" size={16} />
          {t.save}
        </button>
      </form>
      {loading ? (
        <div class="center-state">
          <span class="spinner" />
        </div>
      ) : !lists.length ? (
        <div class="center-state">
          <Icon name="list-check-line" size={28} />
          <h3>{t.emptyLists}</h3>
        </div>
      ) : (
        <div class="account-list">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              class="list-row"
              onClick={() => navigate(`/l/${list.id}`)}
            >
              <Icon name="list-check-line" size={18} />
              <div class="row-main">
                <div class="row-title">{list.title}</div>
              </div>
              <Icon name="arrow-right-line" size={16} />
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}

interface ListProps {
  params: { id: string };
}

export function ListPage({ params }: ListProps): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.lists} showBack>
      <Timeline
        kind={{ type: "list", listId: params.id }}
        instance={account?.instance}
        emptyTitle={t.empty}
      />
    </PageShell>
  );
}
