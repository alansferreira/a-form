import type {
  ColumnNode,
  Diagnostic,
  FieldNode,
  ResponsiveSpan,
  RowNode,
  SourceRange,
} from "a-form-core";

type TokenKind = "identifier" | "number" | "string" | ">" | "+" | "(" | ")" | "[" | "]" | "=" | "eof";

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

interface RawNode {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly RawNode[];
  readonly start: number;
  readonly end: number;
}

export interface ParseEmmetResult {
  readonly value?: readonly RowNode[];
  readonly diagnostics: readonly Diagnostic[];
}

function positionAt(source: string, offset: number) {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0,
    offset,
  };
}

function rangeAt(source: string, start: number, end: number): SourceRange {
  return { start: positionAt(source, start), end: positionAt(source, end) };
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;

  while (offset < source.length) {
    const character = source[offset]!;
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    if (">+()[]=".includes(character)) {
      tokens.push({ kind: character as TokenKind, value: character, start: offset, end: offset + 1 });
      offset += 1;
      continue;
    }
    if (character === "\"" || character === "'") {
      const quote = character;
      const start = offset;
      offset += 1;
      let value = "";
      while (offset < source.length && source[offset] !== quote) {
        if (source[offset] === "\\" && offset + 1 < source.length) {
          offset += 1;
        }
        value += source[offset];
        offset += 1;
      }
      if (source[offset] === quote) {
        offset += 1;
      }
      tokens.push({ kind: "string", value, start, end: offset });
      continue;
    }
    const start = offset;
    while (offset < source.length && !/[\s>+()[\]=]/.test(source[offset]!)) {
      offset += 1;
    }
    const value = source.slice(start, offset);
    tokens.push({
      kind: /^\d+$/.test(value) ? "number" : "identifier",
      value,
      start,
      end: offset,
    });
  }

  tokens.push({ kind: "eof", value: "", start: source.length, end: source.length });
  return tokens;
}

class EmmetParser {
  readonly diagnostics: Diagnostic[] = [];
  private index = 0;

  constructor(private readonly source: string, private readonly tokens: readonly Token[]) {}

  parse(): readonly RawNode[] {
    const nodes = this.parseSiblings();
    if (this.current().kind !== "eof") {
      this.error("YF_EMMET_UNEXPECTED", `Unexpected token '${this.current().value}'.`, this.current());
    }
    return nodes;
  }

  private parseSiblings(): RawNode[] {
    const nodes = this.parsePrimary();
    while (this.match("+")) {
      nodes.push(...this.parsePrimary());
    }
    return nodes;
  }

  private parsePrimary(): RawNode[] {
    let nodes: RawNode[];
    if (this.match("(")) {
      nodes = this.parseSiblings();
      this.expect(")", "Expected ')' to close the group.");
    } else {
      const token = this.expect("identifier", "Expected row, col or field.");
      if (!token) {
        return [];
      }
      const attributes = this.parseAttributes();
      nodes = [{ name: token.value, attributes, children: [], start: token.start, end: this.previous().end }];
    }

    if (this.match(">")) {
      const children = this.parseSiblings();
      nodes = nodes.map((node) => ({ ...node, children, end: children.at(-1)?.end ?? node.end }));
    }
    return nodes;
  }

  private parseAttributes(): Readonly<Record<string, string>> {
    if (!this.match("[")) {
      return {};
    }
    const attributes: Record<string, string> = {};
    while (this.current().kind !== "]" && this.current().kind !== "eof") {
      const name = this.expect("identifier", "Expected an attribute name.");
      if (!name) {
        this.advance();
        continue;
      }
      this.expect("=", `Expected '=' after '${name.value}'.`);
      const value = this.current();
      if (value.kind !== "identifier" && value.kind !== "number" && value.kind !== "string") {
        this.error("YF_EMMET_ATTRIBUTE", `Expected a value for '${name.value}'.`, value);
      } else {
        attributes[name.value] = value.value;
        this.advance();
      }
    }
    this.expect("]", "Expected ']' to close attributes.");
    return attributes;
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)]!;
  }

  private advance(): Token {
    const token = this.current();
    if (token.kind !== "eof") {
      this.index += 1;
    }
    return token;
  }

  private match(kind: TokenKind): boolean {
    if (this.current().kind !== kind) {
      return false;
    }
    this.advance();
    return true;
  }

  private expect(kind: TokenKind, message: string): Token | undefined {
    if (this.current().kind === kind) {
      return this.advance();
    }
    this.error("YF_EMMET_SYNTAX", message, this.current());
    return undefined;
  }

  private error(code: string, message: string, token: Token): void {
    this.diagnostics.push({
      code,
      message,
      severity: "error",
      path: [],
      range: rangeAt(this.source, token.start, token.end),
    });
  }
}

function numericAttribute(node: RawNode, name: keyof ResponsiveSpan, diagnostics: Diagnostic[], source: string): number | undefined {
  const rawValue = node.attributes[name];
  if (rawValue === undefined) {
    return undefined;
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    diagnostics.push({
      code: "YF_EMMET_SPAN",
      message: `${name} must be an integer.`,
      severity: "error",
      path: [],
      range: rangeAt(source, node.start, node.end),
    });
    return undefined;
  }
  return value;
}

function convertField(node: RawNode, diagnostics: Diagnostic[], source: string): FieldNode | undefined {
  const path = node.attributes.path;
  if (!path) {
    diagnostics.push({
      code: "YF_EMMET_FIELD_PATH",
      message: "field requires a path attribute.",
      severity: "error",
      path: [],
      range: rangeAt(source, node.start, node.end),
    });
    return undefined;
  }
  if (node.children.length > 0) {
    diagnostics.push({
      code: "YF_EMMET_FIELD_CHILDREN",
      message: "field cannot contain children.",
      severity: "error",
      path: [],
      range: rangeAt(source, node.start, node.end),
    });
  }
  return { type: "field", path, ...(node.attributes.id ? { id: node.attributes.id } : {}) };
}

function convertRow(node: RawNode, diagnostics: Diagnostic[], source: string): RowNode | undefined {
  if (node.name !== "row") {
    diagnostics.push({
      code: "YF_EMMET_ROOT",
      message: "The Emmet layout root may only contain row nodes.",
      severity: "error",
      path: [],
      range: rangeAt(source, node.start, node.end),
    });
    return undefined;
  }
  const children = node.children
    .map((child): ColumnNode | undefined => {
      if (child.name !== "col") {
        diagnostics.push({
          code: "YF_EMMET_ROW_CHILD",
          message: "row may only contain col nodes.",
          severity: "error",
          path: [],
          range: rangeAt(source, child.start, child.end),
        });
        return undefined;
      }
      const columnChildren = child.children
        .map((columnChild): FieldNode | RowNode | undefined => columnChild.name === "row"
          ? convertRow(columnChild, diagnostics, source)
          : columnChild.name === "field"
            ? convertField(columnChild, diagnostics, source)
            : undefined)
        .filter((value): value is FieldNode | RowNode => value !== undefined);
      const mobile = numericAttribute(child, "mobile", diagnostics, source);
      const tablet = numericAttribute(child, "tablet", diagnostics, source);
      const desktop = numericAttribute(child, "desktop", diagnostics, source);
      const span: ResponsiveSpan = {
        ...(mobile !== undefined ? { mobile } : {}),
        ...(tablet !== undefined ? { tablet } : {}),
        ...(desktop !== undefined ? { desktop } : {}),
      };
      return {
        type: "column",
        ...(child.attributes.id ? { id: child.attributes.id } : {}),
        ...(Object.keys(span).length > 0 ? { span } : {}),
        children: columnChildren,
      };
    })
    .filter((value): value is ColumnNode => value !== undefined);
  return {
    type: "row",
    ...(node.attributes.id ? { id: node.attributes.id } : {}),
    children,
  };
}

export function parseEmmetLayout(source: string): ParseEmmetResult {
  const parser = new EmmetParser(source, tokenize(source));
  const rawNodes = parser.parse();
  const diagnostics = [...parser.diagnostics];
  const value = rawNodes
    .map((node) => convertRow(node, diagnostics, source))
    .filter((node): node is RowNode => node !== undefined);
  return diagnostics.some(({ severity }) => severity === "error")
    ? { diagnostics }
    : { value, diagnostics };
}