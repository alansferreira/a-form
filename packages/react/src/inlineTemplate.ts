import { tokenizeInlineTemplate } from "a-form-template";

export type InlineTemplateNode =
  | {
      readonly kind: "element";
      readonly tag: string;
      readonly attributes: Readonly<Record<string, string | number>>;
      readonly children: readonly InlineTemplateNode[];
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "placeholder"; readonly expression: string; readonly raw: string };

export interface InlineTemplateDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface ParsedInlineTemplate {
  readonly nodes: readonly InlineTemplateNode[];
  /** Unique placeholder expressions in document order. */
  readonly expressions: readonly string[];
  readonly diagnostics: readonly InlineTemplateDiagnostic[];
}

const ALLOWED_TAGS = new Set([
  "p", "span", "div", "section", "article", "header", "footer", "aside",
  "strong", "em", "b", "i", "u", "s", "small", "mark", "sub", "sup", "code", "pre", "blockquote",
  "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td",
]);

// Removed together with their content; any other unknown tag is unwrapped and keeps its children.
const DROPPED_TAGS = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "template", "noscript",
  "svg", "math", "form", "input", "button", "textarea", "select", "option", "link", "meta", "base", "title",
  "img", "picture", "source", "audio", "video", "canvas",
]);

const VOID_TAGS = new Set(["br", "hr"]);

function sanitizeAttributes(element: Element, tag: string, diagnostics: InlineTemplateDiagnostic[]): Record<string, string | number> {
  const attributes: Record<string, string | number> = {};
  for (const { name, value } of Array.from(element.attributes)) {
    if (name === "class") {
      attributes.className = value;
    } else if (name === "title" || name === "role" || name === "lang" || name === "dir") {
      attributes[name] = value;
    } else if (/^(aria|data)-[\w-]+$/.test(name) && !name.startsWith("data-a-form")) {
      attributes[name] = value;
    } else if ((name === "colspan" || name === "rowspan") && /^\d{1,3}$/.test(value)) {
      attributes[name === "colspan" ? "colSpan" : "rowSpan"] = Number(value);
    } else {
      diagnostics.push({ code: "YF_INLINE_ATTRIBUTE", message: `Attribute '${name}' on <${tag}> is not allowed and was removed.` });
    }
  }
  return attributes;
}

/**
 * Parses an inline-editor HTML template into a sanitized node tree. Markup is never injected as HTML:
 * only allow-listed tags/attributes survive and `{{expression}}` placeholders in text become placeholder nodes.
 */
export function parseInlineTemplate(source: string): ParsedInlineTemplate {
  const diagnostics: InlineTemplateDiagnostic[] = [];
  const expressions: string[] = [];

  const textNodes = (text: string): InlineTemplateNode[] => tokenizeInlineTemplate(text).map((token) => {
    if (token.kind === "text") return { kind: "text", value: token.value };
    if (token.kind === "invalid") {
      diagnostics.push({ code: "YF_INLINE_PLACEHOLDER", message: `Placeholder '${token.raw}': ${token.reason}` });
      return { kind: "text", value: token.raw };
    }
    if (!expressions.includes(token.expression)) expressions.push(token.expression);
    return { kind: "placeholder", expression: token.expression, raw: token.raw };
  });

  const visit = (node: Node): InlineTemplateNode[] => {
    if (node.nodeType === 3) return textNodes(node.textContent ?? "");
    if (node.nodeType !== 1) return [];
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) {
      diagnostics.push({ code: "YF_INLINE_TAG", message: `Tag <${tag}> is not allowed and was removed with its content.` });
      return [];
    }
    const children = Array.from(element.childNodes).flatMap(visit);
    if (!ALLOWED_TAGS.has(tag)) {
      diagnostics.push({ code: "YF_INLINE_TAG", message: `Tag <${tag}> is not allowed; only its content was kept.` });
      return children;
    }
    return [{
      kind: "element",
      tag,
      attributes: sanitizeAttributes(element, tag, diagnostics),
      children: VOID_TAGS.has(tag) ? [] : children,
    }];
  };

  // Without a DOM (e.g. SSR) markup is stripped and only text + placeholders are rendered.
  const nodes = typeof DOMParser === "undefined"
    ? textNodes(source.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<[^>]*>/g, " "))
    : Array.from(new DOMParser().parseFromString(source, "text/html").body.childNodes).flatMap(visit);

  return { nodes, expressions, diagnostics };
}
