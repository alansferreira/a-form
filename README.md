# JSFL Forms

**Write the form once. Shape it everywhere.**

JSFL Forms turns a portable YAML specification into a responsive React form. Keep data rules in JSON Schema, presentation hints in UI Schema, and layout decisions in a compact 12-column grid.

The result is one declarative form contract that can be parsed, validated, inspected by editor tooling, and rendered with `JSFLForm`.

## Why JSFL Forms?

- **Schema-first by design.** Use standard JSON Schema for data shape and validation.
- **Layout without component noise.** Reference schema paths from responsive rows and columns.
- **React-ready.** Render normalized specifications through one controlled component.
- **Portable contracts.** Specifications contain data, never executable code or secrets.
- **Tooling from the same source.** Parsing diagnostics, completions, hover information, and rendering share the same model.
- **Remote validation without lock-in.** Register transport adapters in the host application, outside the specification.

## The Big Picture

```text
                                    JSFL FORMS

  AUTHORING                         DOMAIN PIPELINE                    RUNTIME
  =============================     ==============================     =============================

  +---------------------------+     +----------------------------+     +---------------------------+
  | *.jsfl.yaml             |     | jsfl-parser                |     | React application         |
  |                           |     |                            |     |                           |
  | JSON Schema               |---->| parseYamlSpec()            |     | state / API / routing     |
  | UI Schema                 |     | validateFormSpec()         |     +-------------+-------------+
  | responsive layout        |     | normalizeFormSpec()        |                   |
  | async validation rules   |     +-------------+--------------+                   v
  +-------------+-------------+                   |                    +---------------------------+
                |                                 | NormalizedFormSpec | jsfl-react                |
                |                                 +------------------->|                           |
                |                                                      | <JSFLForm />            |
                v                                                      | RJSF + AJV                |
  +---------------------------+                                        | responsive 12-col layout  |
  | Language service          |                                        +-------------+-------------+
  |                           |                                                      |
  | diagnostics              |                                                      v
  | completion + hover       |                                        +---------------------------+
  +---------------------------+                                        | Accessible HTML form      |
                                                                       | controlled form values    |
  HOST-OWNED INTEGRATIONS                                               | schema validation         |
  =============================                                        +---------------------------+

  +---------------------------+     +----------------------------+
  | adapter registry          |---->| async validation engine    |
  | fetch / custom transport  |     | timeout / cache / cancel   |
  +---------------------------+     +----------------------------+
```

## Quick Start

Inside this monorepo, install dependencies and build the workspace packages:

```bash
npm install
npm run build --workspace jsfl-react
```

In a React consumer, add the packages used by the complete YAML-to-form pipeline:

```bash
npm install jsfl-core jsfl-parser jsfl-react
```

> The packages are currently private workspace packages and are not published to the public npm registry yet.

## Your First JSFLForm

`JSFLForm` accepts a normalized specification and works as a controlled React component.

```tsx
import type { JsonObject, NormalizedFormSpec } from "jsfl-core";
import { JSFLForm } from "jsfl-react";
import { useState } from "react";

const spec: NormalizedFormSpec = {
  version: "1",
  schema: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
    },
  },
  uiSchema: {
    email: { "ui:placeholder": "name@example.com" },
  },
  layout: [
    {
      type: "row",
      id: "contact-row",
      children: [
        {
          type: "column",
          id: "contact-column",
          span: { mobile: 12, tablet: 8, desktop: 6 },
          children: [{ type: "field", id: "email-field", path: "email" }],
        },
      ],
    },
  ],
};

export function ContactForm() {
  const [value, setValue] = useState<JsonObject>({});

  return (
    <JSFLForm
      spec={spec}
      value={value}
      onChange={setValue}
      onSubmit={(data) => console.log("Ready to send", data)}
      submitLabel="Create account"
    />
  );
}
```

## From YAML to React

**Author in YAML. Render with confidence.** Parse, validate, and normalize before passing a specification to React.

```tsx
import type { JsonObject } from "jsfl-core";
import {
  normalizeFormSpec,
  parseYamlSpec,
  validateFormSpec,
} from "jsfl-parser";
import { JSFLForm } from "jsfl-react";
import { useState } from "react";

export function FormFromYaml({ source }: { source: string }) {
  const [value, setValue] = useState<JsonObject>({});
  const parsed = parseYamlSpec(source);

  if (!parsed.value) {
    return <p>The specification could not be parsed.</p>;
  }

  const diagnostics = [
    ...parsed.diagnostics,
    ...validateFormSpec(parsed.value),
  ];
  const errors = diagnostics.filter(({ severity }) => severity === "error");

  if (errors.length > 0) {
    return <pre>{errors.map(({ message }) => message).join("\n")}</pre>;
  }

  return (
    <JSFLForm
      spec={normalizeFormSpec(parsed.value)}
      value={value}
      onChange={setValue}
      onSubmit={(data) => console.log(data)}
    />
  );
}
```

See [examples/registration.jsfl.yaml](examples/registration.jsfl.yaml) for a complete source document.

## Editor Schema

The Draft 2020-12 schema at [schemas/jsfl.schema.json](schemas/jsfl.schema.json) provides completion, documentation, and structural validation for JSFL YAML files in editors compatible with YAML Language Server.

Inside a JSFL document, `schema` exposes the JSON Schema Draft-07 keywords supported by RJSF's default AJV validator. `uiSchema` exposes the serializable RJSF 6.x options in both `ui:option` and `ui:options` forms, including recursive object fields, array `items`, `oneOf`/`anyOf`, global options, and UI definitions. Field names remain open because they are defined dynamically by `schema.properties`.

Other editors using YAML Language Server can opt in from the first line of a document:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/alansferreira/jsfl/main/schemas/jsfl.schema.json
version: "1"
```

The editor schema validates the JSFL document structure. Cross-references such as a layout field path existing under `schema.properties` remain semantic checks performed by `validateFormSpec` or `jsfl-language-service`.

## Responsive by Specification

The layout uses a 12-column grid. Choose which normalized span should be rendered through the `viewport` prop:

```tsx
import type { NormalizedFormSpec } from "jsfl-core";
import type { JSFLViewport } from "jsfl-react";
import { JSFLForm } from "jsfl-react";
import { useState } from "react";

export function ResponsivePreview({ spec }: { spec: NormalizedFormSpec }) {
  const [viewport, setViewport] = useState<JSFLViewport>("desktop");

  return (
    <>
      <select
        value={viewport}
        onChange={(event) => setViewport(event.target.value as JSFLViewport)}
      >
        <option value="mobile">Mobile</option>
        <option value="tablet">Tablet</option>
        <option value="desktop">Desktop</option>
      </select>

      <JSFLForm spec={spec} viewport={viewport} />
    </>
  );
}
```

```yaml
layout:
  - type: row
    children:
      - type: column
        span: { mobile: 12, tablet: 6, desktop: 4 }
        children:
          - { type: field, path: person.name }
```

Only fields referenced by the JSFL layout are rendered. Nested object paths such as `person.name` remain connected to their parent JSON Schema structure.

## Own the Form State

**Your application stays in control.** Use `value` and `onChange` for drafts, persistence, state machines, or API synchronization.

```tsx
const [registration, setRegistration] = useState<JsonObject>({
  person: { name: "", email: "" },
});

<JSFLForm
  spec={registrationSpec}
  value={registration}
  onChange={setRegistration}
  onSubmit={async (data) => {
    await fetch("/api/registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  }}
/>
```

## Shape Every State

Use the same component for editing, review screens, and temporarily unavailable workflows:

```tsx
<JSFLForm spec={spec} readOnly submitLabel="Confirm" />

<JSFLForm spec={spec} disabled submitLabel="Unavailable" />

<JSFLForm
  spec={spec}
  className="checkout-form"
  noHtml5Validate
  submitLabel={<span>Continue</span>}
/>
```

## Style Without Forking

`JSFLForm` provides stable class hooks while RJSF continues to render native form controls:

```css
.checkout-form .jsfl-object-root {
  gap: 1.25rem;
}

.checkout-form .jsfl-field {
  min-width: 0;
}

.checkout-form .jsfl-label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 700;
}

.checkout-form input,
.checkout-form select,
.checkout-form textarea {
  width: 100%;
  box-sizing: border-box;
}

.checkout-form .jsfl-submit {
  padding: 0.75rem 1rem;
  cursor: pointer;
}
```

Available hooks include:

- `.jsfl-object-root`, `.jsfl-object-bridge`, `.jsfl-object-nested`
- `.jsfl-field`, `.jsfl-layout-field`, `.jsfl-nested-field`
- `.jsfl-label`, `.jsfl-required`, `.jsfl-submit`
- `.jsfl-property`, `.jsfl-hidden-field`
- `[data-jsfl-field="person.email"]` for path-specific styling

## Component API

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `spec` | `NormalizedFormSpec` | Required | Normalized schema, UI schema, and layout contract |
| `viewport` | `"mobile" \| "tablet" \| "desktop"` | `"desktop"` | Selects the responsive span for every column |
| `value` | `JsonObject` | `{}` | Controlled form data |
| `onChange` | `(value: JsonObject) => void` | - | Receives the next complete form value |
| `onSubmit` | `(value, event) => void` | - | Receives validated form data and the form event |
| `submitLabel` | `ReactNode` | `"Submit"` | Replaces the submit button content |
| `disabled` | `boolean` | `false` | Disables all controls |
| `readOnly` | `boolean` | `false` | Makes all controls read-only |
| `noHtml5Validate` | `boolean` | `false` | Disables native browser validation UI |
| `className` | `string` | `""` | Adds a class to the root form element |
| `asyncValidation` | `JSFLAsyncValidationOptions` | - | Connects remote validation to change, blur, and submit |

## Async Validation

**Keep credentials in the host, not in YAML.** A specification declares adapter IDs and behavior only:

```yaml
validations:
  async:
    - id: email-available
      adapter: customer-api
      paths: [person.email]
      triggers: [blur, submit]
      debounceMs: 350
      timeoutMs: 5000
      cacheTtlMs: 300000
```

The host application registers `customer-api` and passes its engine to the component:

```tsx
import { FetchAsyncValidationAdapter } from "jsfl-adapter-fetch";
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "jsfl-async-validation";

const registry = new AsyncValidationRegistry();
registry.register(new FetchAsyncValidationAdapter({
  id: "customer-api",
  endpoint: "/api/forms/validate",
}));

const engine = new AsyncValidationEngine(registry);

<JSFLForm
  spec={spec}
  asyncValidation={{ engine }}
  onSubmit={(data) => saveRegistration(data)}
/>;
```

`JSFLForm` binds `change`, `blur`, and `submit` rules automatically. It applies change debounce, observes `dependsOn`, renders remote issues beside their fields, disables submit while work is pending, and forwards `onSubmit` only when every applicable result is non-blocking. Adapter configuration and credentials remain owned by the host application.

## Workspace Map

| Package | Responsibility |
| --- | --- |
| [`jsfl-core`](packages/core/README.md) | Serializable contracts and normalized AST types |
| [`jsfl-parser`](packages/parser/README.md) | YAML and Emmet parsing, semantic validation, and normalization |
| [`jsfl-react`](packages/react/README.md) | Controlled React renderer powered by RJSF and AJV |
| [`jsfl-language-service`](packages/language-service/README.md) | Editor-independent diagnostics, completion, and hover |
| [`jsfl-async-validation`](packages/async-validation/README.md) | Remote validation registry and orchestration |
| [`jsfl-adapter-fetch`](packages/adapter-fetch/README.md) | Runtime-configured HTTP validation adapter |
| `jsfl-playground` | Interactive YAML editor and responsive React preview |

## Development

Node.js 20.19 or newer is required.

```bash
npm install
npm run verify
```

Run the interactive playground:

```bash
npm run dev --workspace jsfl-playground
```

Run only the React package checks:

```bash
npm run typecheck --workspace jsfl-react
npm test -- --run packages/react/src/JSFLForm.test.tsx
```