import { describe, expect, it } from "vitest";
import type { Shortcut } from "../../api/types";
import {
  buildLayoutShortcuts,
  clampWidth,
  LAYOUT_PRESETS,
  moveInOrder,
  orderColumns,
  COLUMN_MAX,
  COLUMN_MIN,
} from "../layout";

describe("clampWidth", () => {
  it("respeita os limites da coluna", () => {
    expect(clampWidth(100)).toBe(COLUMN_MIN);
    expect(clampWidth(5000)).toBe(COLUMN_MAX);
    expect(clampWidth(420.6)).toBe(421);
  });
});

describe("orderColumns", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("sem order preserva a ordem original", () => {
    expect(orderColumns(items, []).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("aplica a order salva", () => {
    expect(orderColumns(items, ["c", "a", "b"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("ids novos vão para o fim na ordem original", () => {
    expect(orderColumns(items, ["b"]).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("ids da order que não existem são ignorados", () => {
    expect(orderColumns(items, ["zz", "c"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("moveInOrder", () => {
  const ids = ["a", "b", "c"];

  it("move para antes do alvo", () => {
    expect(moveInOrder(ids, "a", "c", "before")).toEqual(["b", "a", "c"]);
  });

  it("move para depois do alvo", () => {
    expect(moveInOrder(ids, "a", "b", "after")).toEqual(["b", "a", "c"]);
  });

  it("mover para o próprio alvo não muda nada", () => {
    expect(moveInOrder(ids, "a", "a", "before")).toEqual(ids);
  });

  it("alvo inexistente devolve a lista original", () => {
    expect(moveInOrder(ids, "a", "zz", "before")).toEqual(ids);
  });
});

describe("LAYOUT_PRESETS", () => {
  it("tem 6 layouts combinando 2 a 4 colunas", () => {
    expect(LAYOUT_PRESETS).toHaveLength(6);
    expect(LAYOUT_PRESETS.map((p) => p.columns.length)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it("cobre notificações primeiro e curtidas na segunda coluna", () => {
    expect(LAYOUT_PRESETS.find((p) => p.id === "foco")?.columns[0].type).toBe("notifications");
    expect(LAYOUT_PRESETS.find((p) => p.id === "curadoria")?.columns[1].type).toBe("favourites");
  });
});

describe("buildLayoutShortcuts", () => {
  const dupla = LAYOUT_PRESETS.find((p) => p.id === "dupla")!;

  it("usa as colunas do preset na ordem", () => {
    expect(buildLayoutShortcuts(dupla, []).map((s) => s.id)).toEqual(["home", "notifications"]);
  });

  it("preserva listas e hashtags fixadas no fim", () => {
    const existing: Shortcut[] = [
      { id: "list:1", type: "list", label: "Tech", value: "1" },
      { id: "home", type: "home", label: "Início" },
      { id: "hashtag:arte", type: "hashtag", label: "arte", value: "arte" },
    ];
    expect(buildLayoutShortcuts(dupla, existing).map((s) => s.id)).toEqual([
      "home",
      "notifications",
      "list:1",
      "hashtag:arte",
    ]);
  });

  it("substitui colunas padrão fora do layout", () => {
    const existing: Shortcut[] = [
      { id: "home", type: "home", label: "Início" },
      { id: "trending", type: "trending", label: "Em alta" },
    ];
    expect(buildLayoutShortcuts(dupla, existing).map((s) => s.id)).toEqual([
      "home",
      "notifications",
    ]);
  });
});
