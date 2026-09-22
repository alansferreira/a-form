import { Theme } from "@rjsf/react-bootstrap";
import type { PresentationAdapter } from "a-form-react";

export const BootstrapAdapter: PresentationAdapter = {
  id: "bootstrap",
  className: "a-form-bootstrap",
  ...(Theme.fields ? { fields: Theme.fields } : {}),
  ...(Theme.widgets ? { widgets: Theme.widgets } : {}),
  ...(Theme.templates ? { templates: Theme.templates } : {}),
};

export { Theme as BootstrapTheme } from "@rjsf/react-bootstrap";
