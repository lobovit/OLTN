import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { SavedLayout, Shortcut } from "../api/types";
import { t } from "../i18n/pt-BR";
import {
  buildLayoutShortcuts,
  LAYOUT_PRESETS,
  orderColumns,
  type LayoutPreset,
} from "../lib/layout";
import { navigate } from "../lib/router";
import { shortcutLabel } from "../app/shortcuts";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { saveColumnLayout, saveSavedLayouts, saveShortcuts } from "../state/boot";
import { accountNS, currentAccount, store, toast } from "../state/store";

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function tKey(key: string): string | undefined {
  return (t as Record<string, string>)[key];
}

export function LayoutsPage(): JSX.Element {
  const snap = useSnapshot(store);
  const account = currentAccount();
  const prefs = account ? snap.prefs[accountNS(account)] : undefined;
  const widths = prefs?.columnWidths ?? {};
  const saved = prefs?.savedLayouts ?? [];
  const ordered = orderColumns(snap.shortcuts, prefs?.columnOrder ?? []);
  const currentIds = ordered.map((s) => s.id);
  const [name, setName] = useState("");

  const localize = (list: readonly Shortcut[]): Shortcut[] =>
    list.map((s) => ({ ...s, label: tKey(s.label) ?? s.label }));

  const applyColumns = (
    columns: readonly Shortcut[],
    columnWidths: Readonly<Record<string, number>>,
  ): void => {
    saveShortcuts(columns.map((s) => ({ ...s })));
    saveColumnLayout(
      columns.map((s) => s.id),
      { ...columnWidths },
    );
    toast(t.layoutApplied, "ok");
    navigate("/");
  };

  const applyPreset = (preset: LayoutPreset): void => {
    const next = localize(buildLayoutShortcuts(preset, snap.shortcuts));
    const kept: Record<string, number> = {};
    for (const s of next) if (widths[s.id] != null) kept[s.id] = widths[s.id];
    applyColumns(next, kept);
  };

  const saveCurrent = (e: Event): void => {
    e.preventDefault();
    if (!ordered.length) return;
    const item: SavedLayout = {
      id: `layout-${Date.now()}`,
      name: name.trim() || `Layout ${saved.length + 1}`,
      columns: ordered.map((s) => ({ ...s })),
      widths: { ...widths },
    };
    saveSavedLayouts([...saved, item]);
    setName("");
    toast(t.layoutSaved, "ok");
  };

  const removeSaved = (id: string): void => {
    saveSavedLayouts(saved.filter((item) => item.id !== id));
  };

  const presetActive = (preset: LayoutPreset): boolean =>
    sameOrder(
      buildLayoutShortcuts(preset, snap.shortcuts).map((s) => s.id),
      currentIds,
    );

  const savedActive = (item: SavedLayout): boolean =>
    sameOrder(
      item.columns.map((s) => s.id),
      currentIds,
    );

  const custom =
    currentIds.length > 0 && !LAYOUT_PRESETS.some(presetActive) && !saved.some(savedActive);

  return (
    <PageShell title={t.layouts} showBack>
      <div class="settings">
        <p class="muted settings-intro">{t.layoutsHint}</p>

        <div class="layout-current">
          <span class="layout-current-label">{t.currentLayout}</span>
          <span class="layout-chips">
            {ordered.length ? (
              ordered.slice(0, 6).map((s) => (
                <span class="layout-chip" key={s.id}>
                  {shortcutLabel(s)}
                </span>
              ))
            ) : (
              <span class="layout-chip">{t.emptyColumns}</span>
            )}
          </span>
          {custom && <em class="layout-flag">{t.customLayout}</em>}
        </div>

        <form class="layout-save" onSubmit={saveCurrent}>
          <input
            class="field"
            placeholder={t.layoutName}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />
          <button type="submit" class="btn" disabled={!ordered.length}>
            <Icon name="pin-line" size={16} />
            {t.saveLayout}
          </button>
        </form>

        <section class="layout-group">
          <h2 class="section-title">{t.myLayouts}</h2>
          {saved.length ? (
            <div class="layout-list">
              {saved.map((item) => (
                <div key={item.id} class={`layout-card ${savedActive(item) ? "active" : ""}`}>
                  <button
                    type="button"
                    class="layout-main"
                    onClick={() => applyColumns(item.columns, item.widths ?? {})}
                  >
                    <span class="layout-icon">
                      <Icon name="layout-grid-line" size={18} />
                    </span>
                    <span class="layout-text">
                      <span class="layout-name">
                        {item.name}
                        {savedActive(item) && <em class="layout-flag">{t.layoutActive}</em>}
                      </span>
                      <span class="layout-chips">
                        {item.columns.slice(0, 6).map((s) => (
                          <span class="layout-chip" key={s.id}>
                            {shortcutLabel(s)}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn layout-remove"
                    title={t.deleteLayout}
                    aria-label={`${t.deleteLayout}: ${item.name}`}
                    onClick={() => removeSaved(item.id)}
                  >
                    <Icon name="delete-line" size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p class="muted layout-empty">{t.noSavedLayouts}</p>
          )}
        </section>

        <section class="layout-group">
          <h2 class="section-title">{t.presets}</h2>
          <div class="layout-list">
            {LAYOUT_PRESETS.map((preset) => {
              const result = localize(buildLayoutShortcuts(preset, snap.shortcuts));
              const active = presetActive(preset);
              return (
                <button
                  key={preset.id}
                  type="button"
                  class={`layout-card ${active ? "active" : ""}`}
                  aria-label={`${tKey(preset.labelKey)}: ${tKey(preset.descKey)}`}
                  onClick={() => applyPreset(preset)}
                >
                  <span class="layout-icon">
                    <Icon name={preset.icon} size={18} />
                  </span>
                  <span class="layout-text">
                    <span class="layout-name">
                      {tKey(preset.labelKey)}
                      {active && <em class="layout-flag">{t.layoutActive}</em>}
                    </span>
                    <span class="layout-desc">{tKey(preset.descKey)}</span>
                    <span class="layout-chips">
                      {result.map((s) => (
                        <span class="layout-chip" key={s.id}>
                          {shortcutLabel(s)}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
