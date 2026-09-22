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
