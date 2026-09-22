import { Theme } from "@rjsf/mui";
import type { PresentationAdapter } from "a-form-react";

export const MaterialAdapter: PresentationAdapter = {
  id: "material",
  className: "a-form-material",
  ...(Theme.fields ? { fields: Theme.fields } : {}),
  ...(Theme.widgets ? { widgets: Theme.widgets } : {}),
  ...(Theme.templates ? { templates: Theme.templates } : {}),
};

export { Theme as MaterialTheme } from "@rjsf/mui";
