import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { AccountField, UpdateCredentialsParams } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { updateCurrentAccountMeta } from "../../state/boot";
import { currentAccount, store, toast } from "../../state/store";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/Avatar";

interface ProfileEditorProps {
  instance: string;
  onClose: () => void;
  onSaved?: () => void;
}

const MAX_FIELDS = 4;

export function ProfileEditor({ instance, onClose, onSaved }: ProfileEditorProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState(false);
  const [fields, setFields] = useState<{ name: string; value: string }[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const account = currentAccount();
    if (!account) return;
    let cancelled = false;
    void (async () => {
      try {
        const client = getRest(instance, account.accessToken);
        const cred = await client.v1.accounts.verifyCredentials();
        if (cancelled) return;
        setDisplayName(cred.displayName || "");
        setNote(cred.source?.note ?? "");
        setLocked(!!cred.locked);
        setAvatarPreview(cred.avatarStatic || cred.avatar);
        setHeaderPreview(cred.headerStatic || cred.header || null);
        const sourceFields: AccountField[] = cred.source?.fields ?? [];
        setFields(sourceFields.slice(0, MAX_FIELDS).map((f) => ({ name: f.name, value: f.value })));
      } catch (err) {
        console.warn("[oltn] profile load failed", err);
        toast(userMessageForError(err, t.errorLoad), "error");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  /* releases temporary preview URLs */
  useEffect(
    () => () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
      if (headerPreview?.startsWith("blob:")) URL.revokeObjectURL(headerPreview);
    },
    [avatarPreview, headerPreview],
  );

  const pickAvatar = (file: File | null): void => {
    if (!file) return;
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const pickHeader = (file: File | null): void => {
    if (!file) return;
    if (headerPreview?.startsWith("blob:")) URL.revokeObjectURL(headerPreview);
    setHeaderFile(file);
    setHeaderPreview(URL.createObjectURL(file));
  };

  const updateField = (index: number, patch: Partial<{ name: string; value: string }>): void => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const save = async (): Promise<void> => {
    const account = currentAccount();
    if (!account || busy) return;
    setBusy(true);
    try {
      const client = getRest(instance, account.accessToken);
      const params: UpdateCredentialsParams = {
        displayName,
        note,
        locked,
        fieldsAttributes: fields
          .filter((f) => f.name.trim() || f.value.trim())
          .map((f) => ({ name: f.name.trim(), value: f.value.trim() })),
        ...(avatarFile ? { avatar: avatarFile } : {}),
        ...(headerFile ? { header: headerFile } : {}),
      };
      const updated = await client.v1.accounts.updateCredentials(params);
      store.me = updated;
      updateCurrentAccountMeta({
        displayName: updated.displayName || updated.username,
        avatar: updated.avatar,
      });
      toast(t.saved, "ok");
      onSaved?.();
      onClose();
    } catch (err) {
      console.warn("[oltn] profile save failed", err);
      toast(userMessageForError(err, t.errorSave), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t.editProfile}
      onClose={onClose}
      draggable
      positionKey="profile-edit"
      footer={
        <>
          <div class="spacer" />
          <button
            type="button"
            class="btn primary"
            disabled={busy || loading}
            onClick={() => void save()}
          >
            {busy && <span class="spinner" />}
            {busy ? t.saving : t.save}
          </button>
        </>
      }
    >
      {loading ? (
        <div class="center-state">
          <span class="spinner" />
        </div>
      ) : (
        <div class="profile-edit">
          <div class="profile-edit-media">
            <button
              type="button"
              class="header-pick"
              aria-label={t.headerLabel}
              onClick={() => headerInputRef.current?.click()}
            >
              {headerPreview ? <img src={headerPreview} alt="" /> : <span class="header-empty" />}
              <span class="media-badge">
                <Icon name="photo-album-line" size={14} />
                {t.headerLabel}
              </span>
            </button>
            <button
              type="button"
              class="avatar-pick"
              aria-label={t.avatarLabel}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Avatar src={avatarPreview ?? undefined} name={displayName || "?"} size={64} />
              <span class="media-badge">
                <Icon name="photo-album-line" size={13} />
              </span>
            </button>
          </div>
          <input
            ref={avatarInputRef}
            class="compose-file"
            type="file"
            accept="image/*"
            onChange={(e) => {
              pickAvatar((e.target as HTMLInputElement).files?.[0] ?? null);
              (e.target as HTMLInputElement).value = "";
            }}
          />
          <input
            ref={headerInputRef}
            class="compose-file"
            type="file"
            accept="image/*"
            onChange={(e) => {
              pickHeader((e.target as HTMLInputElement).files?.[0] ?? null);
              (e.target as HTMLInputElement).value = "";
            }}
          />
          <label class="profile-label">
            {t.displayName}
            <input
              class="field"
              maxLength={40}
              value={displayName}
              onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="profile-label">
            {t.bio}
            <textarea
              class="field"
              rows={4}
              maxLength={500}
              value={note}
              onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
            />
          </label>
          <div class="setting-row">
            <span>{t.lockedProfile}</span>
            <input
              type="checkbox"
              class="switch"
              role="switch"
              checked={locked}
              aria-label={t.lockedProfile}
              onChange={(e) => setLocked((e.target as HTMLInputElement).checked)}
            />
          </div>
          <p class="muted">{t.lockedHint}</p>
          <div class="profile-fields">
            <span class="profile-label-text">{t.profileFields}</span>
            {fields.map((field, index) => (
              <div class="profile-field-row" key={index}>
                <input
                  class="field"
                  placeholder={t.fieldName}
                  maxLength={255}
                  value={field.name}
                  onInput={(e) =>
                    updateField(index, { name: (e.target as HTMLInputElement).value })
                  }
                />
                <input
                  class="field"
                  placeholder={t.fieldValue}
                  maxLength={255}
                  value={field.value}
                  onInput={(e) =>
                    updateField(index, { value: (e.target as HTMLInputElement).value })
                  }
                />
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t.delete}
                  onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Icon name="close-line" size={14} />
                </button>
              </div>
            ))}
            {fields.length < MAX_FIELDS && (
              <button
                type="button"
                class="btn ghost sm"
                onClick={() => setFields((prev) => [...prev, { name: "", value: "" }])}
              >
                <Icon name="plus-line" size={14} />
                {t.addField}
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
