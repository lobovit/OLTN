import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../state/store";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupCounts,
  backupFileName,
  collectPages,
  fullAcct,
  parseBackup,
  sanitizeFilters,
  sanitizePrefs,
  sanitizeSettings,
  type Backup,
} from "../backup";

function rawBackup(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-05-01T10:00:00.000Z",
    account: { acct: "alice@old.example", instance: "old.example" },
    settings: {},
    prefs: {},
    following: [],
    lists: [],
    filters: [],
    mutes: [],
    blocks: [],
    domainBlocks: [],
    ...over,
  });
}

function parsed(over: Record<string, unknown> = {}): Backup {
  const backup = parseBackup(rawBackup(over));
  if (!backup) throw new Error("backup should parse");
  return backup;
}

describe("fullAcct", () => {
  it("normalizes handles and completes local ones", () => {
    expect(fullAcct(" @Alice ", "old.example")).toBe("alice@old.example");
    expect(fullAcct("@Bob@Remote.Example", "old.example")).toBe("bob@remote.example");
  });
});

describe("parseBackup", () => {
  it("rejects files that are not OLTN backups", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ format: "other", version: 1 }))).toBeNull();
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toBeNull();
  });

  it("sanitizes handles, lists and filters", () => {
    const backup = parsed({
      following: ["@Alice", "bob@remote.example", "alice@old.example", "bad handle"],
      lists: [
        { title: " Friends ", accounts: ["@Alice", "bob@remote.example"] },
        { title: "", accounts: ["x@y.example"] },
      ],
      filters: [
        {
          title: "Spoilers",
          context: ["home", "nope"],
          action: "hide",
          keywords: [{ keyword: "finale", wholeWord: true }, { keyword: "" }],
        },
      ],
      mutes: ["carol@remote.example"],
      blocks: ["dave@remote.example"],
      domainBlocks: ["https://spam.example/path", "spam.example", ""],
    });
    expect(backup.following).toEqual(["alice@old.example", "bob@remote.example"]);
    expect(backup.lists).toEqual([
      { title: "Friends", accounts: ["alice@old.example", "bob@remote.example"] },
    ]);
    expect(backup.filters).toEqual([
      {
        title: "Spoilers",
        context: ["home"],
        action: "hide",
        keywords: [{ keyword: "finale", wholeWord: true }],
      },
    ]);
    expect(backup.mutes).toEqual(["carol@remote.example"]);
    expect(backup.blocks).toEqual(["dave@remote.example"]);
    expect(backup.domainBlocks).toEqual(["spam.example"]);
  });

  it("falls back to safe settings", () => {
    const backup = parsed({
      settings: { theme: "neon", accent: "purple", textSize: 99 },
    });
    expect(backup.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(backup.settings.accent).toBe("purple");
    expect(backup.settings.textSize).toBe(20);
  });

  it("migrates the legacy deckMode field from old backups", () => {
    expect(parsed({ settings: { deckMode: false } }).settings.layout).toBe("floats");
    expect(parsed({ settings: { deckMode: true } }).settings.layout).toBe("columns");
    expect(parsed({ settings: { layout: "social" } }).settings.layout).toBe("social");
  });
});

describe("sanitizeSettings", () => {
  it("keeps valid values and rejects unknown ones", () => {
    const settings = sanitizeSettings({
      theme: "light",
      accent: "purple",
      language: "pt-BR",
      textSize: 15,
      layout: "floats",
      autoStream: false,
      autoplayGifs: false,
      navOrder: ["/", "/settings", 3],
    });
    expect(settings.theme).toBe("light");
    expect(settings.accent).toBe("purple");
    expect(settings.language).toBe("pt-BR");
    expect(settings.textSize).toBe(15);
    expect(settings.layout).toBe("floats");
    expect(settings.navOrder).toEqual(["/", "/settings"]);
  });
});

describe("sanitizePrefs", () => {
  it("keeps valid shortcuts and panel colors", () => {
    const prefs = sanitizePrefs({
      shortcuts: [
        { id: "home", type: "home", label: "Home" },
        { id: "x", type: "nope", label: "Bad" },
        { id: "tag", type: "hashtag", label: "Tag", value: "masto" },
      ],
      columnOrder: ["home", 2],
      columnWidths: { home: 420, bad: "wide" },
      floats: { home: { x: 1, y: 2, w: 300, h: 400 }, bad: { x: 1 } },
      colors: { home: "purple", bad: "neon" },
    });
    expect(prefs.shortcuts.map((shortcut) => shortcut.id)).toEqual(["home", "tag"]);
    expect(prefs.columnOrder).toEqual(["home"]);
    expect(prefs.columnWidths).toEqual({ home: 420 });
    expect(prefs.floats).toEqual({ home: { x: 1, y: 2, w: 300, h: 400 } });
    expect(prefs.colors).toEqual({ home: "purple" });
  });

  it("drops unknown and removed preference keys", () => {
    const prefs = sanitizePrefs({ shortcuts: [], evil: true, savedLayouts: [] });
    expect(Object.keys(prefs)).toEqual(["shortcuts"]);
  });
});

describe("sanitizeFilters", () => {
  it("defaults unknown actions to warn and caps keywords", () => {
    const filters = sanitizeFilters([
      {
        title: "News",
        context: ["public"],
        action: "explode",
        keywords: Array.from({ length: 60 }, (_, index) => ({ keyword: `k${index}` })),
      },
    ]);
    expect(filters[0]?.action).toBe("warn");
    expect(filters[0]?.keywords).toHaveLength(50);
  });
});

describe("collectPages", () => {
  it("follows maxId cursors until a short page", async () => {
    const pages: Record<string, { id: string }[]> = {
      start: [{ id: "3" }, { id: "2" }],
      "2": [{ id: "1" }],
    };
    const seen: (string | undefined)[] = [];
    const items = await collectPages(async (maxId) => {
      seen.push(maxId);
      return pages[maxId ?? "start"] ?? [];
    }, 2);
    expect(items.map((item) => item.id)).toEqual(["3", "2", "1"]);
    expect(seen).toEqual([undefined, "2"]);
  });

  it("stops when a server repeats the same page", async () => {
    let calls = 0;
    const items = await collectPages(async () => {
      calls++;
      return [{ id: "1" }];
    }, 1);
    expect(items).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("respects the limit", async () => {
    const items = await collectPages(async () => [{ id: "1" }, { id: "2" }], 1, 1);
    expect(items.map((item) => item.id)).toEqual(["1"]);
  });
});

describe("backup metadata", () => {
  it("counts entries", () => {
    const backup = parsed({
      following: ["a@x.example"],
      lists: [{ title: "L", accounts: [] }],
      filters: [{ title: "F", context: [], action: "warn", keywords: [] }],
      mutes: ["b@x.example"],
      blocks: ["c@x.example"],
      domainBlocks: ["spam.example"],
    });
    expect(backupCounts(backup)).toEqual({
      following: 1,
      lists: 1,
      filters: 1,
      mutes: 1,
      blocks: 1,
      domainBlocks: 1,
    });
  });

  it("names the file after the day", () => {
    expect(backupFileName(new Date("2026-05-01T12:00:00Z"))).toBe("oltn-backup-2026-05-01.json");
  });
});
