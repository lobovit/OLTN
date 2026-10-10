import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Shortcut, ShortcutType } from "../api/types";
import { t } from "../i18n/pt-BR";
import { navigate } from "../lib/router";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import {
  applyAppearance,
  resetColumnLayout,
  saveSettings,
  saveShortcuts,
  signOut,
  syncStream,
} from "../state/boot";
import { store, toast } from "../state/store";

const LANGUAGE_OPTIONS = [
  ["pt-BR", "Português"],
  ["en", "English"],
] as const;

export function SettingsPage(): JSX.Element {
  const snap = useSnapshot(store);
  const settings = snap.settings;
  const shortcuts = snap.shortcuts;
  const [scType, setScType] = useState<ShortcutType>("hashtag");
  const [scValue, setScValue] = useState("");
  const [scLabel, setScLabel] = useState("");

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
                placeholder={scType === "list" ? "id da lista" : "tag"}
                value={scValue}
                onInput={(e) => setScValue((e.target as HTMLInputElement).value)}
              />
            )}
            <input
              class="field"
              placeholder="nome (opcional)"
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
          <h2 class="section-title">{t.about}</h2>
          <p class="muted">{t.aboutText}</p>
        </section>
      </div>
    </PageShell>
  );
}
