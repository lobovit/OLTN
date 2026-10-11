import { describe, expect, it } from "vitest";
import { matchPath, matchRoutes, parseHash } from "../router";

describe("parseHash", () => {
  it("interpreta caminho simples", () => {
    expect(parseHash("#/notificacoes").path).toBe("/notificacoes");
    expect(parseHash("#/notificacoes").query.get("x")).toBe(null);
  });

  it("splits the query string", () => {
    const parsed = parseHash("#/search?q=masto&page=2");
    expect(parsed.path).toBe("/search");
    expect(parsed.query.get("q")).toBe("masto");
    expect(parsed.query.get("page")).toBe("2");
  });

  it("defaults to /", () => {
    expect(parseHash("").path).toBe("/");
    expect(parseHash("#").path).toBe("/");
  });
});

describe("matchPath", () => {
  it("matches static routes", () => {
    expect(matchPath("/l/:id", "/l/42")).toEqual({ id: "42" });
    expect(matchPath("/b", "/b")).toEqual({});
    expect(matchPath("/b", "/f")).toBe(null);
  });

  it("matches an optional instance at the start", () => {
    expect(matchPath("/:instance?/s/:id", "/mastodon.social/s/9")).toEqual({
      instance: "mastodon.social",
      id: "9",
    });
    expect(matchPath("/:instance?/s/:id", "/s/9")).toEqual({ id: "9" });
  });

  it("casa escopo opcional", () => {
    expect(matchPath("/:instance?/p/:scope", "/p/l")).toEqual({ scope: "l" });
    expect(matchPath("/:instance?/p", "/p")).toEqual({});
  });
});

describe("matchRoutes", () => {
  const routes = [
    { pattern: "/login" },
    { pattern: "/", id: "home" },
    { pattern: "/l/:id", id: "list" },
    { pattern: "/:instance/s/:id", id: "status" },
  ];

  it("retorna a primeira rota que casa", () => {
    expect(matchRoutes(routes, "/")?.def.id).toBe("home");
    expect(matchRoutes(routes, "/l/7")?.params).toEqual({ id: "7" });
    expect(matchRoutes(routes, "/foo/s/1")?.def.id).toBe("status");
  });
});
