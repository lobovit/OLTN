/* Converte blocos de código (```lang ... ```) em imagem estilo Carbon,
   desenhada em canvas: cartão escuro com cantos arredondados, "semáforo",
   linguagem e realce de sintaxe simplificado. */

export interface CodeBlock {
  lang: string;
  code: string;
  /** Trecho original (com as cercas), usado para removê-lo do texto. */
  raw: string;
}

export interface Token {
  text: string;
  color: string;
}

const COLORS = {
  text: "#e6edf3",
  comment: "#8b949e",
  string: "#a5d6ff",
  number: "#79c0ff",
  keyword: "#ff7b72",
};

const JS_KEYWORDS = [
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "new",
  "class",
  "extends",
  "super",
  "this",
  "import",
  "export",
  "from",
  "default",
  "try",
  "catch",
  "finally",
  "throw",
  "await",
  "async",
  "yield",
  "typeof",
  "instanceof",
  "in",
  "of",
  "delete",
  "void",
  "static",
  "get",
  "set",
  "null",
  "undefined",
  "true",
  "false",
];

const KEYWORDS: Record<string, string[]> = {
  js: JS_KEYWORDS,
  ts: [
    ...JS_KEYWORDS,
    "interface",
    "type",
    "enum",
    "implements",
    "public",
    "private",
    "protected",
    "readonly",
    "as",
    "keyof",
    "infer",
    "never",
    "unknown",
    "any",
    "string",
    "number",
    "boolean",
    "declare",
    "abstract",
    "namespace",
  ],
  python: [
    "def",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "break",
    "continue",
    "class",
    "import",
    "from",
    "as",
    "with",
    "try",
    "except",
    "finally",
    "raise",
    "lambda",
    "yield",
    "async",
    "await",
    "pass",
    "global",
    "nonlocal",
    "assert",
    "del",
    "in",
    "is",
    "not",
    "and",
    "or",
    "None",
    "True",
    "False",
    "self",
  ],
  rust: [
    "fn",
    "let",
    "mut",
    "const",
    "struct",
    "enum",
    "impl",
    "trait",
    "pub",
    "use",
    "mod",
    "match",
    "if",
    "else",
    "while",
    "loop",
    "for",
    "in",
    "return",
    "break",
    "continue",
    "async",
    "await",
    "move",
    "ref",
    "self",
    "Self",
    "super",
    "crate",
    "where",
    "dyn",
    "unsafe",
    "static",
    "true",
    "false",
  ],
  go: [
    "func",
    "package",
    "import",
    "var",
    "const",
    "type",
    "struct",
    "interface",
    "map",
    "chan",
    "go",
    "defer",
    "select",
    "case",
    "switch",
    "default",
    "if",
    "else",
    "for",
    "range",
    "return",
    "break",
    "continue",
    "nil",
    "true",
    "false",
  ],
  java: [
    "public",
    "private",
    "protected",
    "class",
    "interface",
    "enum",
    "extends",
    "implements",
    "static",
    "final",
    "void",
    "int",
    "long",
    "double",
    "float",
    "boolean",
    "char",
    "String",
    "new",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "throws",
    "package",
    "import",
    "this",
    "super",
    "null",
    "true",
    "false",
  ],
  csharp: [
    "public",
    "private",
    "protected",
    "internal",
    "class",
    "interface",
    "struct",
    "enum",
    "record",
    "namespace",
    "using",
    "static",
    "readonly",
    "const",
    "void",
    "int",
    "long",
    "double",
    "float",
    "bool",
    "string",
    "var",
    "new",
    "return",
    "if",
    "else",
    "for",
    "foreach",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "async",
    "await",
    "this",
    "base",
    "null",
    "true",
    "false",
  ],
  ruby: [
    "def",
    "end",
    "class",
    "module",
    "if",
    "elsif",
    "else",
    "unless",
    "while",
    "until",
    "for",
    "do",
    "begin",
    "rescue",
    "ensure",
    "return",
    "yield",
    "require",
    "include",
    "attr_accessor",
    "nil",
    "true",
    "false",
    "self",
    "puts",
  ],
  php: [
    "function",
    "class",
    "interface",
    "trait",
    "extends",
    "implements",
    "public",
    "private",
    "protected",
    "static",
    "const",
    "return",
    "if",
    "else",
    "elseif",
    "foreach",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "new",
    "echo",
    "require",
    "include",
    "use",
    "namespace",
    "null",
    "true",
    "false",
  ],
  sql: [
    "SELECT",
    "FROM",
    "WHERE",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "ON",
    "GROUP",
    "BY",
    "ORDER",
    "HAVING",
    "LIMIT",
    "CREATE",
    "TABLE",
    "ALTER",
    "DROP",
    "INDEX",
    "PRIMARY",
    "KEY",
    "FOREIGN",
    "REFERENCES",
    "AND",
    "OR",
    "NOT",
    "NULL",
    "AS",
    "DISTINCT",
  ],
  bash: [
    "if",
    "then",
    "else",
    "elif",
    "fi",
    "for",
    "while",
    "do",
    "done",
    "case",
    "esac",
    "function",
    "return",
    "echo",
    "export",
    "local",
    "readonly",
    "source",
    "set",
    "unset",
    "exit",
  ],
  c: [
    "int",
    "char",
    "float",
    "double",
    "void",
    "long",
    "short",
    "unsigned",
    "signed",
    "struct",
    "union",
    "enum",
    "typedef",
    "const",
    "static",
    "extern",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "goto",
    "sizeof",
    "NULL",
  ],
};

const LANG_ALIASES: Record<string, string> = {
  javascript: "js",
  jsx: "js",
  node: "js",
  typescript: "ts",
  tsx: "ts",
  py: "python",
  python3: "python",
  rs: "rust",
  golang: "go",
  rb: "ruby",
  cpp: "c",
  "c++": "c",
  cxx: "c",
  h: "c",
  cs: "csharp",
  "c#": "csharp",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  postgres: "sql",
  mysql: "sql",
  sqlite: "sql",
};

function normalizeLang(lang: string): string {
  const first =
    lang
      .trim()
      .toLowerCase()
      .split(/[\s,:]/)[0] ?? "";
  return LANG_ALIASES[first] ?? first;
}

/** Extrai blocos cercados por ``` (com ou sem linguagem). */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /^[ \t]*```[ \t]*([^\n`]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    blocks.push({
      lang: match[1].trim(),
      code: match[2].replace(/\n$/, ""),
      raw: match[0],
    });
  }
  return blocks;
}

/** Realce simplificado: comentário, string, número e palavra-chave. */
export function tokenizeLine(line: string, lang: string): Token[] {
  const keywords = KEYWORDS[normalizeLang(lang)] ?? [];
  const tokens: Token[] = [];
  const re =
    /(\/\/.*$|#.*$|--.*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    if (match.index > last)
      tokens.push({ text: line.slice(last, match.index), color: COLORS.text });
    if (match[1]) tokens.push({ text: match[0], color: COLORS.comment });
    else if (match[2]) tokens.push({ text: match[0], color: COLORS.string });
    else if (match[3]) tokens.push({ text: match[0], color: COLORS.number });
    else if (match[4] && keywords.includes(match[4]))
      tokens.push({ text: match[0], color: COLORS.keyword });
    else tokens.push({ text: match[0], color: COLORS.text });
    last = match.index + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: COLORS.text });
  return tokens;
}

const FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const UI_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_SIZE = 15;
const LINE_HEIGHT = 24;
const PAD = 22;
const HEADER = 46;
const RADIUS = 18;
const MAX_CONTENT = 1180;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Renderiza o bloco como PNG (2x) e devolve um File para upload. */
export async function codeBlockToImageFile(block: CodeBlock): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let lines = block.code.replace(/\t/g, "  ").replace(/\r/g, "").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) lines = [""];

  ctx.font = `${FONT_SIZE}px ${FONT_STACK}`;
  const tokenLines = lines.map((line) => tokenizeLine(line, block.lang));
  let maxWidth = 0;
  for (const tokens of tokenLines) {
    let width = 0;
    for (const token of tokens) width += ctx.measureText(token.text).width;
    maxWidth = Math.max(maxWidth, width);
  }
  const contentWidth = Math.max(160, Math.min(maxWidth, MAX_CONTENT));

  // Quebra visual das linhas (mantendo as cores dos tokens).
  const visual: Token[][] = [];
  for (const tokens of tokenLines) {
    let line: Token[] = [];
    let x = 0;
    for (const token of tokens) {
      let rest = token.text;
      while (rest.length) {
        const restWidth = ctx.measureText(rest).width;
        if (x + restWidth <= contentWidth) {
          line.push({ text: rest, color: token.color });
          x += restWidth;
          break;
        }
        let cut = rest.length - 1;
        while (cut > 0 && x + ctx.measureText(rest.slice(0, cut)).width > contentWidth) cut--;
        if (cut === 0) {
          line.push({ text: rest, color: token.color });
          rest = "";
        } else {
          line.push({ text: rest.slice(0, cut), color: token.color });
          rest = rest.slice(cut);
        }
        visual.push(line);
        line = [];
        x = 0;
      }
    }
    visual.push(line.length ? line : [{ text: "", color: COLORS.text }]);
  }

  const width = Math.ceil(contentWidth) + PAD * 2;
  const height = Math.ceil(
    HEADER + PAD * 2 + visual.length * LINE_HEIGHT - (LINE_HEIGHT - FONT_SIZE),
  );
  const scale = 2;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.scale(scale, scale);

  roundRect(ctx, 0, 0, width, height, RADIUS);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1b222c");
  gradient.addColorStop(1, "#0d1117");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, width - 1, height - 1, RADIUS - 1);
  ctx.stroke();

  const dotY = HEADER / 2;
  for (const [index, color] of ["#ff5f57", "#febc2e", "#28c840"].entries()) {
    ctx.beginPath();
    ctx.arc(PAD + 6 + index * 18, dotY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (block.lang) {
    ctx.font = `600 12px ${UI_STACK}`;
    ctx.fillStyle = COLORS.comment;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(block.lang, width - PAD, dotY + 1);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.beginPath();
  ctx.moveTo(0, HEADER + 0.5);
  ctx.lineTo(width, HEADER + 0.5);
  ctx.stroke();

  ctx.font = `${FONT_SIZE}px ${FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = HEADER + PAD + FONT_SIZE;
  for (const line of visual) {
    let x = PAD;
    for (const token of line) {
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
    y += LINE_HEIGHT;
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return new File([blob], `code-${Date.now()}.png`, { type: "image/png" });
}
