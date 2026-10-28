import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../api/client";
import type { List } from "../api/types";
import { t } from "../i18n/pt-BR";
import {
  isListPinned,
  removeListShortcut,
  renameListShortcut,
  toggleListShortcut,
} from "../lib/lists";
import { navigate } from "../lib/router";
import { saveShortcuts } from "../state/boot";
import { currentAccount, store, toast } from "../state/store";
import { Timeline } from "../components/feed/Timeline";
import { ListEditor } from "../components/lists/ListEditor";
import { ListMembers } from "../components/lists/ListMembers";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";

export function ListsPage(): JSX.Element {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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

  return (
    <>
      <PageShell
        title={t.lists}
        showBack
        actions={
          <button type="button" class="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus-line" size={16} />
            {t.newList}
          </button>
        }
      >
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
                  {list.exclusive && <div class="row-sub">{t.listExclusiveBadge}</div>}
                </div>
                <Icon name="arrow-right-line" size={16} />
              </button>
            ))}
          </div>
        )}
      </PageShell>
      {creating && (
        <ListEditor
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
          onDeleted={() => setCreating(false)}
        />
      )}
    </>
  );
}

type ListTab = "posts" | "members";

interface ListProps {
  params: { id: string };
}

export function ListPage({ params }: ListProps): JSX.Element {
  const account = currentAccount();
  const instance = account?.instance ?? "";
  const shortcuts = useSnapshot(store).shortcuts;
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<ListTab>("posts");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    const client = getRest(account.instance, account.accessToken);
    try {
      setList(await client.v1.lists.$select(params.id).fetch());
      setError(null);
    } catch (err) {
      console.warn("[oltn] list load failed", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [account, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !list) {
    return (
      <PageShell title={t.lists} showBack>
        <div class="center-state">
          <Icon name="list-check-line" size={28} />
          <h3>{t.errorNotFound}</h3>
          <button type="button" class="btn ghost" onClick={() => navigate("/l")}>
            <Icon name="back-line" size={16} />
            {t.lists}
          </button>
        </div>
      </PageShell>
    );
  }

  if (loading || !list) {
    return (
      <PageShell title={t.lists} showBack>
        <div class="center-state">
          <span class="spinner" />
        </div>
      </PageShell>
    );
  }

  const pinned = isListPinned(shortcuts, list.id);
  const togglePin = (): void => {
    saveShortcuts(toggleListShortcut(store.shortcuts, list));
    toast(pinned ? t.listUnpinned : t.listPinned, "ok");
  };
  const saved = (updated: List): void => {
    setEditing(false);
    setList(updated);
    if (isListPinned(store.shortcuts, updated.id)) {
      saveShortcuts(renameListShortcut(store.shortcuts, updated));
    }
  };
  const deleted = (): void => {
    if (isListPinned(store.shortcuts, list.id)) {
      saveShortcuts(removeListShortcut(store.shortcuts, list.id));
    }
    navigate("/l");
  };

  return (
    <>
      <PageShell
        title={list.title}
        subtitle={list.exclusive ? t.listExclusiveBadge : undefined}
        showBack
        actions={
          <div class="list-actions">
            <button
              type="button"
              class="icon-btn"
              title={pinned ? t.unpinList : t.pinList}
              aria-label={pinned ? t.unpinList : t.pinList}
              onClick={togglePin}
            >
              <Icon name={pinned ? "pin-fill" : "pin-line"} size={18} />
            </button>
            <button
              type="button"
              class="icon-btn"
              title={t.editList}
              aria-label={t.editList}
              onClick={() => setEditing(true)}
            >
              <Icon name="pencil-line" size={18} />
            </button>
          </div>
        }
      >
        <div class="subtabs">
          <button
            type="button"
            class={`subtab ${tab === "posts" ? "active" : ""}`}
            onClick={() => setTab("posts")}
          >
            {t.posts}
          </button>
          <button
            type="button"
            class={`subtab ${tab === "members" ? "active" : ""}`}
            onClick={() => setTab("members")}
          >
            {t.members}
          </button>
        </div>
        {tab === "posts" ? (
          <Timeline
            kind={{ type: "list", listId: list.id }}
            instance={instance}
            emptyTitle={t.empty}
          />
        ) : (
          <ListMembers instance={instance} listId={list.id} />
        )}
      </PageShell>
      {editing && (
        <ListEditor
          list={list}
          onClose={() => setEditing(false)}
          onSaved={saved}
          onDeleted={deleted}
        />
      )}
    </>
  );
}
