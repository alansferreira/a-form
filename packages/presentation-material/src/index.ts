import { Theme } from "@rjsf/mui";
import type { PresentationAdapter, SeparatorTemplateProps } from "a-form-react";
import { Divider, Typography } from "@mui/material";
import { createElement } from "react";

function SeparatorTemplate({ id, title, description }: SeparatorTemplateProps) {
  return createElement(
    "div",
    { className: "a-form-material-separator" },
    createElement(
      Divider,
      { textAlign: "left", role: "separator", "aria-orientation": "horizontal", "aria-label": title },
      createElement("span", { id: `a-form-separator-title-${id}` }, title),
    ),
    description
      ? createElement(Typography, { className: "a-form-material-separator-description", variant: "caption", color: "text.secondary" }, description)
      : null,
  );
}

export const MaterialAdapter: PresentationAdapter = {
  id: "material",
  className: "a-form-material",
  ...(Theme.fields ? { fields: Theme.fields } : {}),
  ...(Theme.widgets ? { widgets: Theme.widgets } : {}),
  templates: { ...(Theme.templates ?? {}), SeparatorTemplate },
};

export { Theme as MaterialTheme } from "@rjsf/mui";
