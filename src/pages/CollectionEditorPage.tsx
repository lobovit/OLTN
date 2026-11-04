import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { CollectionWithAccounts } from "../api/types";
import { t } from "../i18n/pt-BR";
import { buildCollectionPayload, canCreateCollection } from "../lib/collections";
import { httpStatusOf, userMessageForError } from "../lib/errors";
import { languageName } from "../lib/format";
import { clientFor, hrefFor, isOwnInstance } from "../lib/identity";
import { back, navigate } from "../lib/router";
import { currentAccount, toast } from "../state/store";
import { useAppState } from "../state/hooks";
import { useCollectionsSupport } from "../components/collections/useCollectionsSupport";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import "../components/collections/collections.css";

interface Props {
  params: { instance?: string; id?: string };
}

interface CollectionForm {
  name: string;
  description: string;
  tag: string;
  language: string;
  discoverable: boolean;
  sensitive: boolean;
}

type EditorStatus = "loading" | "ready" | "unsupported" | "forbidden" | "limit" | "error";

const EMPTY_FORM: CollectionForm = {
  name: "",
  description: "",
  tag: "",
  language: "",
  discoverable: true,
  sensitive: false,
};

function formFromCollection(data: CollectionWithAccounts): CollectionForm {
  return {
    name: data.collection.name,
    description: data.collection.description ?? "",
    tag: data.collection.tag?.name ?? "",
    language: data.collection.language ?? "",
    discoverable: data.collection.discoverable,
    sensitive: data.collection.sensitive,
  };
}

function Notice({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div class="center-state">
      <Icon name="list-check-line" size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
      <div class="btn-row">
        <button type="button" class="btn ghost" onClick={() => back()}>
          <Icon name="back-line" size={16} />
          {t.back}
        </button>
        {onRetry && (
          <button type="button" class="btn ghost" onClick={onRetry}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        )}
      </div>
    </div>
  );
}

export function CollectionEditorPage({ params }: Props): JSX.Element {
  const appState = useAppState();
  const account = currentAccount();
  const instance = params.instance ?? account?.instance ?? "";
  const editing = !!params.id;
  const supported = useCollectionsSupport(instance);
  const [collection, setCollection] = useState<CollectionWithAccounts | null>(null);
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [form, setForm] = useState<CollectionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (supported === null) {
      setStatus("loading");
      return;
    }
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    const me = appState.me;
    if (!me || !instance || !isOwnInstance(instance)) {
      setStatus("forbidden");
      return;
    }

    setStatus("loading");
    setLoadError(null);
    void (async () => {
      try {
        const client = clientFor(instance).client;
        if (editing && params.id) {
          const data = await client.v1.collections.$select(params.id).fetch();
          if (cancelled) return;
          if (!data.collection.local || data.collection.accountId !== me.id) {
            setStatus("forbidden");
            return;
          }
          setCollection(data);
          setForm(formFromCollection(data));
          setStatus("ready");
          return;
        }

        const limit = me.role?.collectionLimit ?? 0;
        if (limit <= 0) {
          setStatus("limit");
          return;
        }
        const page = await client.v1.accounts.$select(me.id).collections.list({ limit: 100 });
        if (cancelled) return;
        if (!canCreateCollection(limit, page.collections.length)) {
          setStatus("limit");
          return;
        }
        setCollection(null);
        setForm({ ...EMPTY_FORM, language: me.source?.language ?? "" });
        setStatus("ready");
      } catch (err) {
        console.warn("[oltn] collection editor load failed", err);
        if (cancelled) return;
        setLoadError(err);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    appState.me?.id,
    appState.me?.role?.collectionLimit,
    appState.me?.source?.language,
    editing,
    instance,
    params.id,
    revision,
    supported,
  ]);

  const update = <K extends keyof CollectionForm>(key: K, value: CollectionForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const name = form.name.trim();
  const canSave =
    status === "ready" && !saving && !!name && name.length <= 40 && form.description.length <= 100;

  const save = async (): Promise<void> => {
    if (!canSave || !account) return;
    setSaving(true);
    try {
      const client = clientFor(instance).client;
      const payload = buildCollectionPayload(form);
      const result =
        editing && collection
          ? await client.v1.collections.$select(collection.collection.id).update(payload)
          : await client.v1.collections.create(payload);
      toast(editing ? t.collectionSaved : t.collectionCreated, "ok");
      navigate(hrefFor.collection(result.collection.id, instance), { replace: true });
    } catch (err) {
      console.warn("[oltn] collection save failed", err);
      toast(
        userMessageForError(err, editing ? t.collectionSaveError : t.collectionCreateError),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? t.editCollection : t.newCollection;
  if (status === "loading") {
    return (
      <PageShell title={title} showBack>
        <div class="center-state">
          <span class="spinner" />
        </div>
      </PageShell>
    );
  }

  if (status !== "ready") {
    const notice =
      status === "unsupported"
        ? { title: t.collectionsUnavailable, message: t.collectionFormUnavailable }
        : status === "forbidden"
          ? { title: t.collectionEditForbidden, message: t.collectionEditForbiddenHint }
          : status === "limit"
            ? { title: t.collectionLimitReached, message: t.collectionLimitReachedHint }
            : {
                title:
                  httpStatusOf(loadError) === 404 ? t.collectionNotFound : t.collectionLoadError,
                message: userMessageForError(loadError, t.collectionLoadError),
              };
    return (
      <PageShell title={title} showBack>
        <Notice
          title={notice.title}
          message={notice.message}
          onRetry={status === "error" ? () => setRevision((n) => n + 1) : undefined}
        />
      </PageShell>
    );
  }

  const languages = appState.instance?.languages ?? [];
  const languageOptions =
    form.language && !languages.includes(form.language) ? [form.language, ...languages] : languages;

  return (
    <PageShell
      title={title}
      subtitle={t.collectionFormHint}
      showBack
      actions={
        <button type="submit" form="collection-form" class="btn primary" disabled={!canSave}>
          {saving ? <span class="spinner" /> : <Icon name="check-line" size={16} />}
          {saving ? t.saving : t.save}
        </button>
      }
    >
      <form
        id="collection-form"
        class="collection-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label class="profile-label">
          {t.collectionName}
          <input
            class="field"
            maxLength={40}
            required
            value={form.name}
            onInput={(e) => update("name", (e.target as HTMLInputElement).value)}
          />
          <span class="collection-editor-counter">{form.name.length}/40</span>
        </label>

        <label class="profile-label">
          {t.collectionDescription}
          <textarea
            class="field"
            rows={4}
            maxLength={100}
            value={form.description}
            onInput={(e) => update("description", (e.target as HTMLTextAreaElement).value)}
          />
          <span class="collection-editor-counter">{form.description.length}/100</span>
        </label>

        <div class="collection-editor-grid">
          <label class="profile-label">
            {t.collectionTopic}
            <input
              class="field"
              maxLength={40}
              placeholder={t.collectionTopicPlaceholder}
              value={form.tag}
              onInput={(e) => update("tag", (e.target as HTMLInputElement).value)}
            />
            <span class="collection-editor-hint">{t.collectionTopicHint}</span>
          </label>

          <label class="profile-label">
            {t.language}
            <select
              class="field"
              value={form.language}
              onChange={(e) => update("language", (e.target as HTMLSelectElement).value)}
            >
              <option value="">{t.collectionLanguageNone}</option>
              {languageOptions.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div class="setting-row collection-editor-setting">
          <span>
            <strong>{t.collectionDiscoverable}</strong>
            <small class="collection-editor-hint">{t.collectionDiscoverableHint}</small>
          </span>
          <input
            type="checkbox"
            class="switch"
            role="switch"
            checked={form.discoverable}
            aria-label={t.collectionDiscoverable}
            onChange={(e) => update("discoverable", (e.target as HTMLInputElement).checked)}
          />
        </div>

        <div class="setting-row collection-editor-setting">
          <span>
            <strong>{t.collectionSensitive}</strong>
            <small class="collection-editor-hint">{t.collectionSensitiveEditorHint}</small>
          </span>
          <input
            type="checkbox"
            class="switch"
            role="switch"
            checked={form.sensitive}
            aria-label={t.collectionSensitive}
            onChange={(e) => update("sensitive", (e.target as HTMLInputElement).checked)}
          />
        </div>
      </form>
    </PageShell>
  );
}
