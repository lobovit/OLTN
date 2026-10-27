import type {
  AccountMeta,
  FilterAction,
  FilterContext,
  FloatRect,
  NewsletterSource,
  RestClient,
  SavedLayout,
  Settings,
  Shortcut,
  ShortcutType,
} from "../api/types";
import { PANEL_COLORS } from "./panel-colors";
import { layoutFromSettings } from "./layout";
import { DEFAULT_SETTINGS, type AccountPrefs } from "../state/store";

export const BACKUP_FORMAT = "oltn-backup";
export const BACKUP_VERSION = 1;

export interface BackupList {
  title: string;
  accounts: string[];
}

export interface BackupFilterKeyword {
  keyword: string;
  wholeWord: boolean;
}

export interface BackupFilter {
  title: string;
  context: FilterContext[];
  action: FilterAction;
  keywords: BackupFilterKeyword[];
}

/** Portable snapshot of the current account plus the local OLTN setup. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  account: { acct: string; instance: string };
  settings: Settings;
  prefs: AccountPrefs;
  following: string[];
  lists: BackupList[];
  filters: BackupFilter[];
  mutes: string[];
  blocks: string[];
  domainBlocks: string[];
}

export interface BackupCounts {
  following: number;
  lists: number;
  filters: number;
  mutes: number;
  blocks: number;
  domainBlocks: number;
}

const LIMITS = {
  following: 5000,
  mutes: 5000,
  blocks: 5000,
  domainBlocks: 1000,
  lists: 100,
  listAccounts: 500,
  filters: 200,
  filterKeywords: 50,
};

const THEMES = new Set<string>(["dark", "light", "auto"]);
const ACCENTS = new Set<string>(PANEL_COLORS);
const LANGUAGES = new Set<string>(["en", "pt-BR"]);
const SHORTCUT_TYPES = new Set([
  "home",
  "local",
  "federated",
  "notifications",
  "mentions",
  "direct",
  "list",
  "hashtag",
  "bookmarks",
  "favourites",
  "boosts",
  "trending",
]);
const FILTER_CONTEXTS = new Set(["home", "notifications", "public", "thread", "account"]);
const FILTER_ACTIONS = new Set(["warn", "hide", "blur"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Full lowercase @user@instance handle (local accts get the source instance). */
export function fullAcct(acct: string, instance: string): string {
  const value = acct.trim().replace(/^@+/, "").toLowerCase();
  if (!value) return "";
  return value.includes("@") ? value : instance ? `${value}@${instance}` : value;
}

function normalizeHandle(value: unknown, instance: string): string | null {
  const acct = textOf(value);
  if (!acct) return null;
  const full = fullAcct(acct, instance);
  return /^[^@\s]+@[^@\s]+$/.test(full) ? full : null;
}

function handleList(value: unknown, instance: string, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const handles: string[] = [];
  for (const entry of value) {
    const handle = normalizeHandle(entry, instance);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
    if (handles.length >= max) break;
  }
  return handles;
}

function normalizeDomain(value: unknown): string | null {
  const raw = textOf(value)?.trim().toLowerCase();
  if (!raw) return null;
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9.-]*$/.test(domain) ? domain : null;
}

function domainList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const entry of value) {
    const domain = normalizeDomain(entry);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
    if (domains.length >= LIMITS.domainBlocks) break;
  }
  return domains;
}

/** Keeps only known setting fields with safe values. */
export function sanitizeSettings(value: unknown): Settings {
  const base = DEFAULT_SETTINGS;
  if (!isRecord(value)) return { ...base, pomodoro: { ...base.pomodoro } };
  const pomodoro = isRecord(value.pomodoro) ? value.pomodoro : {};
  const navOrder = Array.isArray(value.navOrder)
    ? value.navOrder.filter((entry): entry is string => typeof entry === "string").slice(0, 50)
    : base.navOrder;
  return {
    theme: THEMES.has(value.theme as string) ? (value.theme as Settings["theme"]) : base.theme,
    accent: ACCENTS.has(value.accent as string)
      ? (value.accent as Settings["accent"])
      : base.accent,
    language: LANGUAGES.has(value.language as string)
      ? (value.language as Settings["language"])
      : base.language,
    textSize: clampInt(value.textSize, 13, 20, base.textSize),
    layout: layoutFromSettings(value, base.layout),
    autoStream: typeof value.autoStream === "boolean" ? value.autoStream : base.autoStream,
    autoplayGifs: typeof value.autoplayGifs === "boolean" ? value.autoplayGifs : base.autoplayGifs,
    navOrder,
    pomodoro: {
      focusMinutes: clampInt(pomodoro.focusMinutes, 1, 180, base.pomodoro.focusMinutes),
      shortBreakMinutes: clampInt(
        pomodoro.shortBreakMinutes,
        1,
        180,
        base.pomodoro.shortBreakMinutes,
      ),
      longBreakMinutes: clampInt(pomodoro.longBreakMinutes, 1, 180, base.pomodoro.longBreakMinutes),
      cycles: clampInt(pomodoro.cycles, 1, 12, base.pomodoro.cycles),
      autoContinue:
        typeof pomodoro.autoContinue === "boolean"
          ? pomodoro.autoContinue
          : base.pomodoro.autoContinue,
    },
  };
}

function sanitizeShortcut(value: unknown): Shortcut | null {
  if (!isRecord(value)) return null;
  const id = textOf(value.id)?.trim();
  const type = textOf(value.type);
  const label = textOf(value.label)?.trim();
  if (!id || !label || !type || !SHORTCUT_TYPES.has(type)) return null;
  const shortcut: Shortcut = {
    id: id.slice(0, 200),
    type: type as ShortcutType,
    label: label.slice(0, 120),
  };
  const shortcutValue = textOf(value.value)?.trim();
  if (shortcutValue) shortcut.value = shortcutValue.slice(0, 200);
  return shortcut;
}

function numberMap(value: unknown, max = 500): Record<string, number> {
  if (!isRecord(value)) return {};
  const map: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value).slice(0, max)) {
    if (typeof entry === "number" && Number.isFinite(entry)) map[key] = entry;
  }
  return map;
}

function rectMap(value: unknown): Record<string, FloatRect> {
  if (!isRecord(value)) return {};
  const map: Record<string, FloatRect> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 200)) {
    if (!isRecord(entry)) continue;
    const { x, y, w, h } = entry;
    if ([x, y, w, h].every((part) => typeof part === "number" && Number.isFinite(part))) {
      map[key] = { x: x as number, y: y as number, w: w as number, h: h as number };
    }
  }
  return map;
}

function colorMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 200)) {
    if (typeof entry === "string" && ACCENTS.has(entry)) map[key] = entry;
  }
  return map;
}

function newsletterSourcesOf(value: unknown): NewsletterSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources: NewsletterSource[] = [];
  for (const entry of value.slice(0, 100)) {
    if (!isRecord(entry)) continue;
    const id = textOf(entry.id)?.trim();
    const acct = textOf(entry.acct)?.trim();
    const name = textOf(entry.name)?.trim();
    if (id && acct && name) sources.push({ id, acct, name });
  }
  return sources;
}

function savedLayoutsOf(value: unknown): SavedLayout[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layouts: SavedLayout[] = [];
  for (const entry of value.slice(0, 50)) {
    if (!isRecord(entry)) continue;
    const id = textOf(entry.id)?.trim();
    const name = textOf(entry.name)?.trim();
    if (!id || !name || !Array.isArray(entry.columns)) continue;
    const columns = entry.columns
      .map(sanitizeShortcut)
      .filter((column): column is Shortcut => column !== null);
    layouts.push({ id, name, columns, widths: numberMap(entry.widths) });
  }
  return layouts;
}

/** Keeps only known preference fields and valid shortcut/layout shapes. */
export function sanitizePrefs(value: unknown): AccountPrefs {
  const prefs: AccountPrefs = { shortcuts: [] };
  if (!isRecord(value)) return prefs;
  if (Array.isArray(value.shortcuts)) {
    prefs.shortcuts = value.shortcuts
      .map(sanitizeShortcut)
      .filter((shortcut): shortcut is Shortcut => shortcut !== null)
      .slice(0, 200);
  }
  if (Array.isArray(value.columnOrder)) {
    prefs.columnOrder = value.columnOrder
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, 100);
  }
  const widths = numberMap(value.columnWidths);
  if (Object.keys(widths).length) prefs.columnWidths = widths;
  const savedLayouts = savedLayoutsOf(value.savedLayouts);
  if (savedLayouts) prefs.savedLayouts = savedLayouts;
  const floats = rectMap(value.floats);
  if (Object.keys(floats).length) prefs.floats = floats;
  if (Array.isArray(value.floatOrder)) {
    prefs.floatOrder = value.floatOrder
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, 100);
  }
  const colors = colorMap(value.colors);
  if (Object.keys(colors).length) prefs.colors = colors;
  const sources = newsletterSourcesOf(value.newsletterSources);
  if (sources) prefs.newsletterSources = sources;
  return prefs;
}

export function sanitizeLists(value: unknown, instance: string): BackupList[] {
  if (!Array.isArray(value)) return [];
  const lists: BackupList[] = [];
  for (const entry of value.slice(0, LIMITS.lists)) {
    if (!isRecord(entry)) continue;
    const title = textOf(entry.title)?.trim();
    if (!title) continue;
    lists.push({
      title: title.slice(0, 255),
      accounts: handleList(entry.accounts, instance, LIMITS.listAccounts),
    });
  }
  return lists;
}

export function sanitizeFilters(value: unknown): BackupFilter[] {
  if (!Array.isArray(value)) return [];
  const filters: BackupFilter[] = [];
  for (const entry of value.slice(0, LIMITS.filters)) {
    if (!isRecord(entry)) continue;
    const title = textOf(entry.title)?.trim();
    if (!title) continue;
    const context = Array.isArray(entry.context)
      ? entry.context
          .filter((item): item is string => typeof item === "string" && FILTER_CONTEXTS.has(item))
          .slice(0, 5)
      : [];
    const action = FILTER_ACTIONS.has(entry.action as string)
      ? (entry.action as FilterAction)
      : "warn";
    const keywords: BackupFilterKeyword[] = [];
    if (Array.isArray(entry.keywords)) {
      for (const keyword of entry.keywords.slice(0, LIMITS.filterKeywords)) {
        if (!isRecord(keyword)) continue;
        const value = textOf(keyword.keyword)?.trim();
        if (!value) continue;
        keywords.push({ keyword: value, wholeWord: keyword.wholeWord === true });
      }
    }
    filters.push({
      title: title.slice(0, 255),
      context: context as FilterContext[],
      action,
      keywords,
    });
  }
  return filters;
}

/** Parses and sanitizes an OLTN backup file; null when it is not one. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT || raw.version !== BACKUP_VERSION) {
    return null;
  }
  const account = isRecord(raw.account) ? raw.account : {};
  const instance = textOf(account.instance)?.trim().toLowerCase() ?? "";
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: textOf(raw.exportedAt) ?? new Date().toISOString(),
    account: { acct: textOf(account.acct) ?? "", instance },
    settings: sanitizeSettings(raw.settings),
    prefs: sanitizePrefs(raw.prefs),
    following: handleList(raw.following, instance, LIMITS.following),
    lists: sanitizeLists(raw.lists, instance),
    filters: sanitizeFilters(raw.filters),
    mutes: handleList(raw.mutes, instance, LIMITS.mutes),
    blocks: handleList(raw.blocks, instance, LIMITS.blocks),
    domainBlocks: domainList(raw.domainBlocks),
  };
}

export function backupCounts(backup: Backup): BackupCounts {
  return {
    following: backup.following.length,
    lists: backup.lists.length,
    filters: backup.filters.length,
    mutes: backup.mutes.length,
    blocks: backup.blocks.length,
    domainBlocks: backup.domainBlocks.length,
  };
}

export function backupFileName(date = new Date()): string {
  return `oltn-backup-${date.toISOString().slice(0, 10)}.json`;
}

/** Collects all pages of an id-cursored collection, guarding repeated pages. */
export async function collectPages<T extends { id: string }>(
  fetchPage: (maxId?: string) => PromiseLike<readonly T[]>,
  limit = 80,
  max = 5000,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let maxId: string | undefined;
  while (items.length < max) {
    const page = await fetchPage(maxId);
    let added = 0;
    for (const item of page) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
      added++;
      if (items.length >= max) break;
    }
    if (page.length < limit || !added) break;
    maxId = page[page.length - 1]?.id;
    if (!maxId) break;
  }
  return items;
}

/** Reads the portable account data plus local settings into a backup. */
export async function collectBackup(
  client: RestClient,
  account: AccountMeta,
  settings: Settings,
  prefs: AccountPrefs | undefined,
): Promise<Backup> {
  const instance = account.instance;
  const following = await collectPages((maxId) =>
    client.v1.accounts.$select(account.id).following.list({ limit: 80, maxId }),
  );
  const lists = await client.v1.lists.list();
  const listsBackup: BackupList[] = [];
  for (const list of lists) {
    const members = await collectPages((maxId) =>
      client.v1.lists.$select(list.id).accounts.list({ limit: 80, maxId }),
    );
    listsBackup.push({
      title: list.title,
      accounts: members.map((member) => fullAcct(member.acct, instance)),
    });
  }
  const filters = await client.v2.filters.list();
  const mutes = await collectPages((maxId) => client.v1.mutes.list({ limit: 80, maxId }));
  const blocks = await collectPages((maxId) => client.v1.blocks.list({ limit: 80, maxId }));
  const domainBlocks = await client.v1.domainBlocks.list({ limit: 200 });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    account: { acct: account.handle, instance },
    settings,
    prefs: prefs ?? { shortcuts: [] },
    following: following.map((item) => fullAcct(item.acct, instance)),
    lists: listsBackup,
    filters: filters.map((filter) => ({
      title: filter.title,
      context: [...filter.context],
      action: filter.filterAction,
      keywords: filter.keywords.map((keyword) => ({
        keyword: keyword.keyword,
        wholeWord: keyword.wholeWord,
      })),
    })),
    mutes: mutes.map((item) => fullAcct(item.acct, instance)),
    blocks: blocks.map((item) => fullAcct(item.acct, instance)),
    domainBlocks: [...domainBlocks],
  };
}
