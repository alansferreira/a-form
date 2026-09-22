# Presentation adapters: quick start

Presentation adapters are selected by the React host at runtime. They are not
stored in the YAML specification. The specification keeps the semantic widget
choice in `uiSchema`, while the adapter supplies the framework markup, widgets
and visual states.

## Install the base renderer

```bash
npm install react react-dom a-form-core a-form-parser a-form-react
```

Choose one or more visual adapters:

```bash
# Material UI
npm install a-form-presentation-material @mui/material @mui/icons-material @emotion/react @emotion/styled

# Bootstrap 5
npm install a-form-presentation-bootstrap bootstrap react-bootstrap

# Tailwind-oriented preset
npm install a-form-presentation-tailwind

# Self-contained visual preset
npm install a-form-presentation-neobrutalism
```

The Material adapter uses `@rjsf/mui` and the Bootstrap adapter uses
`@rjsf/react-bootstrap`. Keep their RJSF versions aligned with `a-form-react`.

## Render a parsed specification

```tsx
import type { JsonObject } from "a-form-core";
import {
  normalizeFormSpec,
  parseYamlSpec,
  validateFormSpec,
} from "a-form-parser";
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { NeobrutalismAdapter } from "a-form-presentation-neobrutalism";
import { useState } from "react";
import "a-form-presentation-neobrutalism/styles.css";

const registry = new PresentationAdapterRegistry();
registry.register(NeobrutalismAdapter);

export function FormPreview({ source }: { source: string }) {
  const [value, setValue] = useState<JsonObject>({});
  const parsed = parseYamlSpec(source);

  if (!parsed.value) return <p>Invalid AForm specification.</p>;

  const diagnostics = validateFormSpec(parsed.value);
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return <pre>{diagnostics.map(({ message }) => message).join("\n")}</pre>;
  }

  return (
    <AForm
      spec={normalizeFormSpec(parsed.value)}
      value={value}
      onChange={setValue}
      presentation={{ registry, adapterId: "neobrutalism" }}
    />
  );
}
```

Changing the adapter does not change `source`, the parsed specification or the
submitted data. It changes only the runtime renderer.

## Select a framework adapter

Keep one registry stable for the lifetime of the host application and select an
adapter per form or per application shell:

```tsx
import { PresentationAdapterRegistry } from "a-form-react";
import { BootstrapAdapter } from "a-form-presentation-bootstrap";
import { MaterialAdapter } from "a-form-presentation-material";
import { NeobrutalismAdapter } from "a-form-presentation-neobrutalism";
import { TailwindAdapter } from "a-form-presentation-tailwind";
import "a-form-presentation-bootstrap/styles.css";
import "a-form-presentation-neobrutalism/styles.css";
import "a-form-presentation-tailwind/styles.css";

export const presentationRegistry = new PresentationAdapterRegistry();
[presentationRegistry.register(BootstrapAdapter),
 presentationRegistry.register(MaterialAdapter),
 presentationRegistry.register(NeobrutalismAdapter),
 presentationRegistry.register(TailwindAdapter)];

export function ThemedForm({ spec, adapterId }: Props) {
  return (
    <AForm
      spec={spec}
      presentation={{ registry: presentationRegistry, adapterId }}
    />
  );
}
```

For Material, install the MUI and Emotion peer dependencies listed above. For
Bootstrap, import Bootstrap CSS from the host or use the adapter's
`styles.css` export. Tailwind applications can replace the fallback CSS with
classes from their own Tailwind build.

## Implement a custom field template

A custom adapter can change field markup without changing `FormSpec`:

```tsx
import { getTemplate, getUiOptions } from "@rjsf/utils";
import type { FieldTemplateProps } from "@rjsf/utils";
import type { PresentationAdapter } from "a-form-react";

function CompactFieldTemplate(props: FieldTemplateProps) {
  const options = getUiOptions(props.uiSchema);
  const WrapIfAdditionalTemplate = getTemplate(
    "WrapIfAdditionalTemplate",
    props.registry,
    options,
  );

  return (
    <WrapIfAdditionalTemplate {...props}>
      {props.displayLabel && (
        <label htmlFor={props.id}>
          {props.label}{props.required ? " *" : ""}
        </label>
      )}
      {props.children}
      {!props.hideError && props.errors}
      {props.help}
    </WrapIfAdditionalTemplate>
  );
}

export const CompactAdapter: PresentationAdapter = {
  id: "compact",
  className: "form-compact",
  templates: { FieldTemplate: CompactFieldTemplate },
};
```

The AForm wrapper still owns layout spans, field ordering, hidden fields and
async validation status. The custom template owns the field's visual markup.

## Implement a custom widget

Use the RJSF `WidgetProps` contract for value, events and disabled/read-only
states. The widget name is selected by `ui:widget` in the specification:

```tsx
import type { WidgetProps } from "@rjsf/utils";
import type { PresentationAdapter } from "a-form-react";

function UppercaseTextWidget({ id, value, disabled, readonly, onChange }: WidgetProps) {
  return (
    <input
      id={id}
      value={String(value ?? "")}
      disabled={disabled}
      readOnly={readonly}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
    />
  );
}

export const UppercaseAdapter: PresentationAdapter = {
  id: "uppercase",
  widgets: { TextWidget: UppercaseTextWidget },
};
```

A host can register this adapter and use it with a specification containing:

```yaml
uiSchema:
  customerName:
    ui:widget: text
```

The YAML remains portable because it contains the semantic widget name, not the
React component implementation.

## Development workspace

Run the playground from the repository root:

```bash
npm install
npm run dev --workspace a-form-playground-v2
npm run build --workspace a-form-playground-v2
```

If port `5173` is occupied, Vite selects the next available port and prints the
local URL in the terminal.
