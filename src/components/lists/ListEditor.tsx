import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { CreateListParams, List, ListRepliesPolicy } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { currentAccount, toast } from "../../state/store";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";

interface Props {
  list?: List;
  onClose: () => void;
  onSaved: (list: List) => void;
  onDeleted: () => void;
}

/** Create/edit (and delete) a list: title, replies policy and exclusivity. */
export function ListEditor({ list, onClose, onSaved, onDeleted }: Props): JSX.Element {
  const edit = !!list;
  const [title, setTitle] = useState(list?.title ?? "");
  const [repliesPolicy, setRepliesPolicy] = useState<ListRepliesPolicy>(
    list?.repliesPolicy ?? "list",
  );
  const [exclusive, setExclusive] = useState(list?.exclusive ?? false);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    const account = currentAccount();
    const name = title.trim();
    if (!account || !name || busy) return;
    setBusy(true);
    const client = getRest(account.instance, account.accessToken);
    // masto's list params omit replies_policy even though the API accepts it.
    const params = {
      title: name,
      repliesPolicy,
      exclusive,
    } as unknown as CreateListParams;
    try {
      const result = edit
        ? await client.v1.lists.$select(list.id).update(params)
        : await client.v1.lists.create(params);
      toast(edit ? t.listSaved : t.listCreated, "ok");
      onSaved(result);
    } catch (err) {
      console.warn("[oltn] list save failed", err);
      toast(userMessageForError(err, edit ? t.errorSave : t.errorGeneric), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    const account = currentAccount();
    if (!edit || !account || busy || !window.confirm(t.deleteListConfirm)) return;
    setBusy(true);
    const client = getRest(account.instance, account.accessToken);
    try {
      await client.v1.lists.$select(list.id).remove();
      toast(t.listDeleted, "ok");
      onDeleted();
    } catch (err) {
      console.warn("[oltn] list delete failed", err);
      toast(userMessageForError(err), "error");
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={edit ? t.editList : t.newList}
      onClose={onClose}
      draggable
      positionKey="list-editor"
      class="list-editor-sheet"
      footer={
        <>
          {edit && (
            <button
              type="button"
              class="btn ghost danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Icon name="delete-line" size={16} />
              {t.deleteList}
            </button>
          )}
          <div class="spacer" />
          <button type="button" class="btn ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            class="btn primary"
            disabled={busy || !title.trim()}
            onClick={() => void save()}
          >
            {busy && <span class="spinner" />}
            {edit ? t.save : t.createList}
          </button>
        </>
      }
    >
      <div class="list-editor">
        <label class="list-editor-row">
          <span>{t.listName}</span>
          <input
            class="field"
            maxLength={255}
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="list-editor-row">
          <span>{t.listRepliesPolicy}</span>
          <select
            class="field"
            value={repliesPolicy}
            onChange={(e) =>
              setRepliesPolicy((e.target as HTMLSelectElement).value as ListRepliesPolicy)
            }
          >
            <option value="list">{t.listRepliesList}</option>
            <option value="followed">{t.listRepliesFollowed}</option>
            <option value="none">{t.listRepliesNone}</option>
          </select>
        </label>
        <label class="list-editor-check">
          <input
            type="checkbox"
            checked={exclusive}
            onChange={(e) => setExclusive((e.target as HTMLInputElement).checked)}
          />
          <span>{t.listExclusive}</span>
        </label>
        <p class="muted list-editor-hint">{t.listExclusiveHint}</p>
      </div>
    </Sheet>
  );
}
