import { describe, expect, it } from "vitest";
import { extractCodeBlocks, tokenizeLine } from "../code-image";

describe("extractCodeBlocks", () => {
  it("extracts blocks with and without a language", () => {
    const text = "oi\n```python\nprint('x')\n```\nfim\n```\nplain\n```";
    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].lang).toBe("python");
    expect(blocks[0].code).toBe("print('x')");
    expect(blocks[0].raw).toContain("```python");
    expect(blocks[1].lang).toBe("");
    expect(blocks[1].code).toBe("plain");
  });

  it("preserves inner lines and ignores unclosed fences", () => {
    const [block] = extractCodeBlocks("```js\nconst a = 1;\n\nconst b = 2;\n```");
    expect(block.code).toBe("const a = 1;\n\nconst b = 2;");
    expect(extractCodeBlocks("```js\nconst a = 1;")).toHaveLength(0);
    expect(extractCodeBlocks("sem código")).toHaveLength(0);
  });
});

describe("tokenizeLine", () => {
  it("separates comment, string, number and keyword", () => {
    const tokens = tokenizeLine('let s = "hi"; // nota', "js");
    expect(tokens.find((token) => token.text === '"hi"')).toBeTruthy();
    expect(tokens.find((token) => token.text === "// nota")).toBeTruthy();
    const keyword = tokens.find((token) => token.text === "let");
    const plain = tokens.find((token) => token.text === "s");
    expect(keyword?.color).not.toBe(plain?.color);
  });

  it("recognizes numbers and keeps the default text", () => {
    const tokens = tokenizeLine("x = 42", "python");
    expect(tokens.find((token) => token.text === "42")).toBeTruthy();
    expect(tokens.map((token) => token.text).join("")).toBe("x = 42");
  });

  it("highlights Lisp and CLISP keywords", () => {
    for (const lang of ["lisp", "clisp"]) {
      const tokens = tokenizeLine("(defun f (x) (car x))", lang);
      const keyword = tokens.find((token) => token.text === "defun");
      const plain = tokens.find((token) => token.text === "f");
      expect(keyword?.color).not.toBe(plain?.color);
    }
  });

  it("uses `;` comments and keeps `#` reader syntax in Lisp", () => {
    const tokens = tokenizeLine("(defun f (x) #'car ; nota", "clisp");
    const plain = tokens.find((token) => token.text === "f")?.color;
    const hash = tokens.find((token) => token.text.includes("#"));
    const comment = tokens.find((token) => token.text === "; nota");
    expect(hash?.color).toBe(plain);
    expect(comment?.color).not.toBe(plain);
  });
});
