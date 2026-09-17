import type { Diagnostic, FormSpec, SourcePosition, SourceRange } from "a-form-core";
import { LineCounter, parseDocument } from "yaml";

const DEFAULT_MAX_SOURCE_LENGTH = 1_000_000;
const DEFAULT_MAX_DEPTH = 40;
const DEFAULT_MAX_NODES = 10_000;
const DEFAULT_MAX_ALIASES = 50;

export interface ParseYamlOptions {
  readonly maxSourceLength?: number;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxAliases?: number;
}

export interface ParseYamlResult {
  readonly value?: FormSpec;
  readonly diagnostics: readonly Diagnostic[];
}

function sourcePosition(lineCounter: LineCounter, offset: number): SourcePosition {
  const position = lineCounter.linePos(offset);
  return {
    line: position.line - 1,
    character: position.col - 1,
    offset,
  };
}

function sourceRange(lineCounter: LineCounter, start: number, end: number): SourceRange {
  return {
    start: sourcePosition(lineCounter, start),
    end: sourcePosition(lineCounter, end),
  };
}

function inspectTree(value: unknown, maxDepth: number, maxNodes: number): Diagnostic[] {
  let nodes = 0;
  const diagnostics: Diagnostic[] = [];

  const visit = (current: unknown, depth: number, path: readonly (number | string)[]): void => {
    nodes += 1;
    if (nodes > maxNodes) {
      return;
    }
    if (depth > maxDepth) {
      diagnostics.push({
        code: "YF_PARSE_MAX_DEPTH",
        message: `The document exceeds the maximum depth of ${maxDepth}.`,
        severity: "error",
        path,
      });
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, depth + 1, [...path, index]));
    } else if (current !== null && typeof current === "object") {
      Object.entries(current).forEach(([key, child]) => visit(child, depth + 1, [...path, key]));
    }
  };

  visit(value, 0, []);
  if (nodes > maxNodes) {
    diagnostics.push({
      code: "YF_PARSE_MAX_NODES",
      message: `The document exceeds the maximum node count of ${maxNodes}.`,
      severity: "error",
      path: [],
    });
  }
  return diagnostics;
}

export function parseYamlSpec(source: string, options: ParseYamlOptions = {}): ParseYamlResult {
  const maxSourceLength = options.maxSourceLength ?? DEFAULT_MAX_SOURCE_LENGTH;
  if (source.length > maxSourceLength) {
    return {
      diagnostics: [{
        code: "YF_PARSE_MAX_LENGTH",
        message: `The source exceeds the maximum length of ${maxSourceLength} characters.`,
        severity: "error",
        path: [],
      }],
    };
  }

  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  const diagnostics: Diagnostic[] = document.errors.map((error) => ({
    code: "YF_PARSE_YAML",
    message: error.message,
    severity: "error",
    path: [],
    range: sourceRange(lineCounter, error.pos[0], error.pos[1]),
  }));

  if (diagnostics.length > 0) {
    return { diagnostics };
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: options.maxAliases ?? DEFAULT_MAX_ALIASES });
  } catch (error) {
    return {
      diagnostics: [{
        code: "YF_PARSE_ALIAS_LIMIT",
        message: error instanceof Error ? error.message : "YAML alias expansion failed.",
        severity: "error",
        path: [],
      }],
    };
  }

  diagnostics.push(...inspectTree(
    value,
    options.maxDepth ?? DEFAULT_MAX_DEPTH,
    options.maxNodes ?? DEFAULT_MAX_NODES,
  ));
  if (diagnostics.length > 0) {
    return { diagnostics };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      diagnostics: [{
        code: "YF_SPEC_ROOT_OBJECT",
        message: "The form spec root must be an object.",
        severity: "error",
        path: [],
      }],
    };
  }

  return { value: value as FormSpec, diagnostics };
}