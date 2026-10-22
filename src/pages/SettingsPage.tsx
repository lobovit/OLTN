import type { JSX } from "preact";
import { useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../api/client";
import type { Shortcut, ShortcutType } from "../api/types";
import { t } from "../i18n/pt-BR";
import {
  backupCounts,
  backupFileName,
  collectBackup,
  parseBackup,
  type Backup,
} from "../lib/backup";
import { userMessageForError } from "../lib/errors";
import {
  importAccountData,
  type ImportPhase,
  type ImportProgress,
  type ImportSummary,
} from "../lib/import-backup";
import { navigate } from "../lib/router";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import {
  applyAppearance,
  replacePrefs,
  resetColumnLayout,
  saveSettings,
  saveShortcuts,
  signOut,
  syncStream,
} from "../state/boot";
import { accountNS, currentAccount, store, toast } from "../state/store";

const LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["pt-BR", "Português"],
] as const;

const IMPORT_PHASES: Record<ImportPhase, () => string> = {
  following: () => t.following,
  lists: () => t.lists,
  filters: () => t.filters,
  mutes: () => t.mutes,
  blocks: () => t.blocks,
  domains: () => t.domainBlocks,
};

export function SettingsPage(): JSX.Element {
  const snap = useSnapshot(store);
  const settings = snap.settings;
  const shortcuts = snap.shortcuts;
  const [scType, setScType] = useState<ShortcutType>("hashtag");
  const [scValue, setScValue] = useState("");
  const [scLabel, setScLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef(false);

  const themeOptions = [
    ["dark", t.themeDark],
    ["light", t.themeLight],
    ["auto", t.themeAuto],
  ] as const;

  const accentOptions = [
    ["green", t.accentGreen, "#3ddc97"],
    ["orange", t.accentOrange, "#f59e0b"],
    ["purple", t.accentPurple, "#a78bfa"],
    ["blue", t.accentBlue, "#60a5fa"],
    ["pink", t.accentPink, "#f472b6"],
  ] as const;

  const shortcutTypes: [ShortcutType, string][] = [
    ["home", t.home],
    ["local", t.local],
    ["federated", t.federated],
    ["notifications", t.notifications],
    ["mentions", t.mentions],
    ["direct", t.messages],
    ["list", t.lists],
    ["hashtag", t.hashtag],
    ["bookmarks", t.bookmarks],
    ["favourites", t.favourites],
    ["boosts", t.boosts],
    ["trending", t.trending],
  ];

  const update = (patch: Partial<typeof settings>): void => {
    store.settings = { ...store.settings, ...patch };
    saveSettings();
  };

  const resetLayout = (): void => {
    resetColumnLayout();
    toast(t.layoutReset, "ok");
  };

  const addShortcut = (e: Event): void => {
    e.preventDefault();
    const needsValue = scType === "list" || scType === "hashtag";
    if (needsValue && !scValue.trim()) return;
    const shortcut: Shortcut = {
      id: `${scType}:${scValue.trim() || scType}`,
      type: scType,
      label: scLabel.trim() || shortcutTypes.find(([k]) => k === scType)?.[1] || scType,
      value: needsValue ? scValue.trim() : undefined,
    };
    if (shortcuts.some((s) => s.id === shortcut.id)) return;
    saveShortcuts([...shortcuts, shortcut]);
    setScValue("");
    setScLabel("");
  };

  const exportData = async (): Promise<void> => {
    const account = currentAccount();
    if (!account || exporting || importing) return;
    setExporting(true);
    try {
      const client = getRest(account.instance, account.accessToken);
      const backup = await collectBackup(
        client,
        account,
        store.settings,
        store.prefs[accountNS(account)],
      );
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t.exportDone, "ok");
    } catch (err) {
      console.warn("[oltn] backup export failed", err);
      toast(userMessageForError(err), "error");
    } finally {
      setExporting(false);
    }
  };

  const chooseFile = async (e: Event): Promise<void> => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast(t.importInvalid, "error");
      return;
    }
    const parsed = parseBackup(await file.text());
    if (!parsed) {
      toast(t.importInvalid, "error");
      return;
    }
    setImportSummary(null);
    setPending(parsed);
  };

  const startImport = async (): Promise<void> => {
    const backup = pending;
    const account = currentAccount();
    if (!backup || !account || importing) return;
    setPending(null);
    setImportSummary(null);
    cancelRef.current = false;
    store.settings = backup.settings;
    saveSettings();
    replacePrefs(backup.prefs);
    setImporting({ phase: "following", done: 0, total: backup.following.length });
    try {
      const summary = await importAccountData(
        getRest(account.instance, account.accessToken),
        backup,
        {
          onProgress: setImporting,
          isCancelled: () => cancelRef.current,
        },
      );
      setImportSummary(summary);
      toast(
        cancelRef.current ? t.importCancelled : t.importDone,
        cancelRef.current ? undefined : "ok",
      );
    } catch (err) {
      console.warn("[oltn] backup import failed", err);
      toast(userMessageForError(err), "error");
    } finally {
      setImporting(null);
    }
  };

  const counts = pending ? backupCounts(pending) : null;

  return (
    <PageShell title={t.settings} showBack>
      <div class="settings">
        <section class="settings-section">
          <h2 class="section-title">{t.appearance}</h2>
          <div class="setting-row">
            <span>{t.theme}</span>
            <div class="segmented">
              {themeOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  class={`seg ${settings.theme === value ? "active" : ""}`}
                  onClick={() => update({ theme: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div class="setting-row">
            <span>{t.language}</span>
            <div class="segmented">
              {LANGUAGE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  class={`seg ${settings.language === value ? "active" : ""}`}
                  onClick={() => update({ language: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div class="setting-row">
            <span>{t.accent}</span>
            <div class="accent-swatches">
              {accentOptions.map(([value, label, color]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.accent === value}
                  aria-label={label}
                  title={label}
                  class={`accent-swatch ${settings.accent === value ? "active" : ""}`}
                  style={`--swatch:${color}`}
                  onClick={() => update({ accent: value })}
                />
              ))}
            </div>
          </div>
          <div class="setting-row">
            <span>{t.textSize}</span>
            <input
              type="range"
              min="13"
              max="20"
              value={settings.textSize}
              onInput={(e) => {
                store.settings = {
                  ...store.settings,
                  textSize: Number((e.target as HTMLInputElement).value),
                };
                applyAppearance();
              }}
              onChange={() => saveSettings()}
            />
          </div>
          <div class="setting-row">
            <span>{t.deckMode}</span>
            <input
              type="checkbox"
              class="switch"
              role="switch"
              checked={settings.deckMode}
              aria-label={t.deckMode}
              onChange={(e) => {
                update({ deckMode: (e.target as HTMLInputElement).checked });
              }}
            />
          </div>
          <p class="muted">{t.deckModeHint}</p>
          <p class="muted">{t.layoutHint}</p>
          <div class="btn-row">
            <button type="button" class="btn" onClick={() => navigate("/layouts")}>
              <Icon name="layout-grid-line" size={16} />
              {t.layouts}
            </button>
            <button type="button" class="btn ghost" onClick={resetLayout}>
              <Icon name="refresh-2-line" size={16} />
              {t.resetLayout}
            </button>
          </div>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.connection}</h2>
          <div class="setting-row">
            <span>{t.autoStream}</span>
            <input
              type="checkbox"
              class="switch"
              role="switch"
              checked={settings.autoStream}
              aria-label={t.autoStream}
              onChange={(e) => {
                update({ autoStream: (e.target as HTMLInputElement).checked });
                syncStream();
              }}
            />
          </div>
          <p class="muted">{t.autoStreamHint}</p>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.media}</h2>
          <div class="setting-row">
            <span>{t.autoplayGifs}</span>
            <input
              type="checkbox"
              class="switch"
              role="switch"
              checked={settings.autoplayGifs}
              aria-label={t.autoplayGifs}
              onChange={(e) => {
                update({ autoplayGifs: (e.target as HTMLInputElement).checked });
              }}
            />
          </div>
          <p class="muted">{t.autoplayGifsHint}</p>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.shortcuts}</h2>
          <p class="muted">{t.shortcutsHint}</p>
          <div class="shortcut-list">
            {shortcuts.map((shortcut) => (
              <div class="shortcut-chip" key={shortcut.id}>
                <Icon name="pin-line" size={14} />
                <span>
                  {shortcut.value ? `${shortcut.label} (${shortcut.value})` : shortcut.label}
                </span>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t.removeShortcut}
                  onClick={() => saveShortcuts(shortcuts.filter((s) => s.id !== shortcut.id))}
                >
                  <Icon name="close-line" size={14} />
                </button>
              </div>
            ))}
          </div>
          <form class="shortcut-add" onSubmit={addShortcut}>
            <select
              class="field"
              value={scType}
              onChange={(e) => setScType((e.target as HTMLSelectElement).value as ShortcutType)}
            >
              {shortcutTypes.map(([value, label]) => (
                <option value={value}>{label}</option>
              ))}
            </select>
            {(scType === "list" || scType === "hashtag") && (
              <input
                class="field"
                placeholder={scType === "list" ? t.listIdPlaceholder : "tag"}
                value={scValue}
                onInput={(e) => setScValue((e.target as HTMLInputElement).value)}
              />
            )}
            <input
              class="field"
              placeholder={t.shortcutLabelPlaceholder}
              value={scLabel}
              onInput={(e) => setScLabel((e.target as HTMLInputElement).value)}
            />
            <button type="submit" class="btn primary">
              <Icon name="plus-line" size={16} />
              {t.addShortcut}
            </button>
          </form>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.keyboard}</h2>
          <p class="muted">{t.keyboardHint}</p>
          <button type="button" class="btn ghost" onClick={() => (store.ui.shortcutsHelp = true)}>
            <Icon name="keyboard-line" size={16} />
            {t.shortcutsHelp}
          </button>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.accounts}</h2>
          <button type="button" class="btn ghost" onClick={() => navigate("/accounts")}>
            <Icon name="switch-line" size={16} />
            {t.accounts}
          </button>
          <button
            type="button"
            class="btn ghost danger"
            onClick={() => {
              if (confirm(t.logoutConfirm)) {
                void signOut().then(() => navigate("/login", { replace: true }));
              }
            }}
          >
            <Icon name="exit-line" size={16} />
            {t.logout}
          </button>
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.data}</h2>
          <p class="muted">{t.dataHint}</p>
          <div class="btn-row">
            <button
              type="button"
              class="btn"
              disabled={exporting || !!importing}
              onClick={() => void exportData()}
            >
              {exporting ? <span class="spinner" /> : <Icon name="file-export-line" size={16} />}
              {t.exportData}
            </button>
            <button
              type="button"
              class="btn ghost"
              disabled={!!importing}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="file-import-line" size={16} />
              {t.importData}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            class="data-file-input"
            onChange={(e) => void chooseFile(e)}
          />
          {pending && counts && (
            <div class="data-preview">
              <strong>
                {t.importFrom} @{pending.account.acct || "?"}
              </strong>
              <ul class="data-counts">
                <li>
                  {t.following}: {counts.following}
                </li>
                <li>
                  {t.lists}: {counts.lists}
                </li>
                <li>
                  {t.filters}: {counts.filters}
                </li>
                <li>
                  {t.mutes}: {counts.mutes}
                </li>
                <li>
                  {t.blocks}: {counts.blocks}
                </li>
                <li>
                  {t.domainBlocks}: {counts.domainBlocks}
                </li>
              </ul>
              <p class="muted">{t.importWarning}</p>
              <div class="btn-row">
                <button type="button" class="btn primary" onClick={() => void startImport()}>
                  {t.importStart}
                </button>
                <button type="button" class="btn ghost" onClick={() => setPending(null)}>
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
          {importing && (
            <div class="data-progress">
              <span>
                {IMPORT_PHASES[importing.phase]()} {importing.done}/{importing.total}
              </span>
              <progress value={importing.done} max={Math.max(1, importing.total)} />
              <button
                type="button"
                class="btn ghost"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                {t.cancel}
              </button>
            </div>
          )}
          {importSummary && !importing && (
            <p class="muted">
              {t.following}: {importSummary.followed} · {t.lists}: {importSummary.lists} ·{" "}
              {t.filters}: {importSummary.filters} · {t.mutes}: {importSummary.mutes} · {t.blocks}:{" "}
              {importSummary.blocks} · {t.domainBlocks}: {importSummary.domains}
              {importSummary.skipped > 0 && ` · ${t.importSkipped}: ${importSummary.skipped}`}
            </p>
          )}
        </section>

        <section class="settings-section">
          <h2 class="section-title">{t.about}</h2>
          <p class="muted">{t.aboutText}</p>
        </section>
      </div>
    </PageShell>
  );
}
