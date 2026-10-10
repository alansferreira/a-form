import { Theme } from "@rjsf/react-bootstrap";
import type { PresentationAdapter, SeparatorTemplateProps } from "a-form-react";
import { createElement } from "react";

function SeparatorTemplate({ id, title, description }: SeparatorTemplateProps) {
  return createElement(
    "div",
    { className: "a-form-bootstrap-separator", role: "separator", "aria-orientation": "horizontal", "aria-label": title },
    createElement("span", { className: "a-form-bootstrap-separator-line", "aria-hidden": true }),
    createElement(
      "span",
      { className: "a-form-bootstrap-separator-content" },
      createElement("span", { className: "a-form-bootstrap-separator-title", id: `a-form-separator-title-${id}` }, title),
      description ? createElement("span", { className: "a-form-bootstrap-separator-description" }, description) : null,
    ),
    createElement("span", { className: "a-form-bootstrap-separator-line", "aria-hidden": true }),
  );
}

export const BootstrapAdapter: PresentationAdapter = {
  id: "bootstrap",
  className: "a-form-bootstrap",
  ...(Theme.fields ? { fields: Theme.fields } : {}),
  ...(Theme.widgets ? { widgets: Theme.widgets } : {}),
  templates: { ...(Theme.templates ?? {}), SeparatorTemplate },
};

export { Theme as BootstrapTheme } from "@rjsf/react-bootstrap";
