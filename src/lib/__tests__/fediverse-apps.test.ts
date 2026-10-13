import { describe, expect, it } from "vitest";
import { FEDIVERSE_APPS, FEDIVERSE_CATEGORIES } from "../fediverse-apps";

describe("fediverse apps data", () => {
  it("lists a decent catalog with unique names", () => {
    expect(FEDIVERSE_APPS.length).toBeGreaterThanOrEqual(50);
    const names = FEDIVERSE_APPS.map((app) => app.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every app has a description, a website and a known category", () => {
    for (const app of FEDIVERSE_APPS) {
      expect(app.description.length).toBeGreaterThan(10);
      expect(app.descriptionPt.length).toBeGreaterThan(10);
      expect(app.website).toMatch(/^https?:\/\//);
      expect(FEDIVERSE_CATEGORIES).toContain(app.category);
    }
  });

  it("categories cover every app", () => {
    const used = new Set(FEDIVERSE_APPS.map((app) => app.category));
    for (const category of used) expect(FEDIVERSE_CATEGORIES).toContain(category);
  });
});
