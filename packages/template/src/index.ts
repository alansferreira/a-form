import Mustache from "mustache";
import type { JsonObject } from "a-form-core";

/** Escapes a rendered value before it's inlined into the template output. */
export type TemplateEscape = (value: string) => string;

const identityEscape: TemplateEscape = (value) => value;

/** Percent-encodes a value, suitable for interpolating into a URL. */
export function urlEncode(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Renders a logic-less Mustache template (`{{path.to.field}}`) against a
 * JSON context. No escaping is applied by default; pass `escape` to sanitize
 * values for the target output (e.g. `urlEncode` for URL templates).
 */
export function renderTemplate(template: string, context: JsonObject, escape: TemplateEscape = identityEscape): string {
  // Mustache's escape function is a module-level global; swap it for the
  // duration of this render so concurrent callers aren't affected long-term.
  const previousEscape = Mustache.escape;
  Mustache.escape = escape;
  try {
    return Mustache.render(template, context);
  } finally {
    Mustache.escape = previousEscape;
  }
}

/** Renders a template and percent-encodes each interpolated value, for building URLs/query params. */
export function renderUrlTemplate(template: string, context: JsonObject): string {
  return renderTemplate(template, context, urlEncode);
}

export type InlineTemplateToken =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "placeholder"; readonly expression: string; readonly raw: string }
  | { readonly kind: "invalid"; readonly raw: string; readonly reason: string };

const PLACEHOLDER = /\{\{(\{?)([\s\S]*?)\}\}(\}?)/g;
const FIELD_PATH = /^[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)*$/;

/** Whether a placeholder expression is a plain dotted field path such as `customer.name`. */
export function isFieldPathExpression(expression: string): boolean {
  return FIELD_PATH.test(expression);
}

/**
 * Splits inline-editor text into literal text and `{{expression}}` placeholders.
 * Comments (`{{! }}`) are dropped; sections, partials and triple mustaches are reported as invalid.
 */
export function tokenizeInlineTemplate(source: string): InlineTemplateToken[] {
  const tokens: InlineTemplateToken[] = [];
  let cursor = 0;
  for (const match of source.matchAll(PLACEHOLDER)) {
    const raw = match[0];
    const body = (match[2] ?? "").trim();
    if (match.index > cursor) tokens.push({ kind: "text", value: source.slice(cursor, match.index) });
    cursor = match.index + raw.length;
    if (match[1] || match[3]) {
      tokens.push({ kind: "invalid", raw, reason: "Triple mustaches are not supported." });
    } else if (body.startsWith("!")) {
      continue;
    } else if (/^[#^/>&=]/.test(body)) {
      tokens.push({ kind: "invalid", raw, reason: "Mustache sections, partials and delimiters are not supported." });
    } else if (body.length === 0) {
      tokens.push({ kind: "invalid", raw, reason: "Placeholder is empty." });
    } else {
      tokens.push({ kind: "placeholder", expression: body, raw });
    }
  }
  if (cursor < source.length) tokens.push({ kind: "text", value: source.slice(cursor) });
  return tokens;
}
