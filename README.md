# AForm

**Write the form once. Shape it everywhere.**

AForm turns a portable YAML specification into a responsive React form. Keep data rules in JSON Schema, presentation hints in UI Schema, and layout decisions in a compact 12-column grid.

The result is one declarative form contract that can be parsed, validated, inspected by editor tooling, and rendered with `AForm`.

[Open the AForm Playground](https://alansferreira.github.io/a-form/) to build, edit, and preview a form in the browser.

[Source code on GitHub](https://github.com/alansferreira/a-form) · [Alan Ferreira on LinkedIn](https://www.linkedin.com/in/alansferreira/)

## Why AForm?

- **Schema-first by design.** Use standard JSON Schema for data shape and validation.
- **Layout without component noise.** Reference schema paths from responsive rows and columns.
- **React-ready.** Render normalized specifications through one controlled component.
- **Portable contracts.** Specifications contain data, never executable code or secrets.
- **Tooling from the same source.** Parsing diagnostics, completions, hover information, and rendering share the same model.
- **Remote validation without lock-in.** Register transport adapters in the host application, outside the specification.

## The Big Picture

```text
                                      AFORM

  AUTHORING                         DOMAIN PIPELINE                    RUNTIME
  =============================     ==============================     =============================

  +---------------------------+     +----------------------------+     +---------------------------+
  | *.a-form.yaml             |     | a-form-parser                |     | React application         |
  |                           |     |                            |     |                           |
  | JSON Schema               |---->| parseYamlSpec()            |     | state / API / routing     |
  | UI Schema                 |     | validateFormSpec()         |     +-------------+-------------+
  | responsive layout        |     | normalizeFormSpec()        |                   |
  | async validation rules   |     +-------------+--------------+                   v
  +-------------+-------------+                   |                    +---------------------------+
                |                                 | NormalizedFormSpec | a-form-react                |
                |                                 +------------------->|                           |
                |                                                      | <AForm />            |
                v                                                      | RJSF + AJV                |
  +---------------------------+                                        | responsive 12-col layout  |
  | Editor schema             |                                        +-------------+-------------+
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
npm run build --workspace a-form-react
```

In a React consumer, add the packages used by the complete YAML-to-form pipeline:

```bash
npm install a-form-core a-form-parser a-form-react
```

Presentation adapters are runtime-only packages. They let the same portable
specification render with Material UI, Bootstrap, Tailwind-oriented or
Neobrutalist presentation:

```bash
npm install a-form-presentation-material @mui/material @mui/icons-material @emotion/react @emotion/styled
```

```tsx
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { MaterialAdapter } from "a-form-presentation-material";

const registry = new PresentationAdapterRegistry();
registry.register(MaterialAdapter);

<AForm spec={spec} presentation={{ registry, adapterId: "material" }} />;
```

See the [presentation adapter quick start](docs/presentation-adapters-quick-start.md)
for Bootstrap, Tailwind, Neobrutalism and custom widget/template examples.

## Publishing

The `Publish packages` GitHub Actions workflow verifies, builds, and publishes all
packages when a tag matching their version is pushed. Calculate the next version
from Conventional Commits and synchronize every package with:

```bash
npm run version:bump
```

Lerna updates all workspace versions and internal dependencies, generates the
changelogs, creates the release commit and tag, and pushes both. Pass `major`,
`minor`, or `patch` to override the Conventional Commits recommendation:

```bash
npm run version:bump -- minor
```

Append `--yes` for non-interactive execution.

For the first publication, add an npm granular access token as the `NPM_TOKEN`
repository secret. Afterward, each package can use npm Trusted Publishing for
this repository and `.github/workflows/publish.yml`.

## Your First AForm

`AForm` accepts a normalized specification and works as a controlled React component.

```tsx
import type { JsonObject, NormalizedFormSpec } from "a-form-core";
import { AForm } from "a-form-react";
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
    <AForm
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
import type { JsonObject } from "a-form-core";
import {
  normalizeFormSpec,
  parseYamlSpec,
  validateFormSpec,
} from "a-form-parser";
import { AForm } from "a-form-react";
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
    <AForm
      spec={normalizeFormSpec(parsed.value)}
      value={value}
      onChange={setValue}
      onSubmit={(data) => console.log(data)}
    />
  );
}
```

See [examples/registration.a-form.yaml](examples/registration.a-form.yaml) for a complete source document.

## Editor Schema

The Draft 2020-12 schema at [schemas/a-form.schema.json](schemas/a-form.schema.json) provides completion, documentation, and structural validation for AForm YAML files in editors compatible with YAML Language Server.

Inside an AForm document, `schema` exposes the JSON Schema Draft-07 keywords supported by RJSF's default AJV validator. `uiSchema` exposes the serializable RJSF 6.x options in both `ui:option` and `ui:options` forms, including recursive object fields, array `items`, `oneOf`/`anyOf`, global options, and UI definitions. Field names remain open because they are defined dynamically by `schema.properties`.

Other editors using YAML Language Server can opt in from the first line of a document:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/alansferreira/a-form/main/schemas/a-form.schema.json
version: "1"
```

The editor schema validates the AForm document structure. Cross-references such as a layout field path existing under `schema.properties` remain semantic checks performed by `validateFormSpec`.

## Responsive by Specification

The layout uses a 12-column grid. Choose which normalized span should be rendered through the `viewport` prop:

```tsx
import type { NormalizedFormSpec } from "a-form-core";
import type { AFormViewport } from "a-form-react";
import { AForm } from "a-form-react";
import { useState } from "react";

export function ResponsivePreview({ spec }: { spec: NormalizedFormSpec }) {
  const [viewport, setViewport] = useState<AFormViewport>("desktop");

  return (
    <>
      <select
        value={viewport}
        onChange={(event) => setViewport(event.target.value as AFormViewport)}
      >
        <option value="mobile">Mobile</option>
        <option value="tablet">Tablet</option>
        <option value="desktop">Desktop</option>
      </select>

      <AForm spec={spec} viewport={viewport} />
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

Only fields referenced by the AForm layout are rendered. Nested object paths such as `person.name` remain connected to their parent JSON Schema structure.

## Own the Form State

**Your application stays in control.** Use `value` and `onChange` for drafts, persistence, state machines, or API synchronization.

```tsx
const [registration, setRegistration] = useState<JsonObject>({
  person: { name: "", email: "" },
});

<AForm
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
<AForm spec={spec} readOnly submitLabel="Confirm" />

<AForm spec={spec} disabled submitLabel="Unavailable" />

<AForm
  spec={spec}
  className="checkout-form"
  noHtml5Validate
  submitLabel={<span>Continue</span>}
/>
```

## Style Without Forking

`AForm` provides stable class hooks while RJSF continues to render native form controls:

```css
.checkout-form .a-form-object-root {
  gap: 1.25rem;
}

.checkout-form .a-form-field {
  min-width: 0;
}

.checkout-form .a-form-label {
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

.checkout-form .a-form-submit {
  padding: 0.75rem 1rem;
  cursor: pointer;
}
```

Available hooks include:

- `.a-form-object-root`, `.a-form-object-bridge`, `.a-form-object-nested`
- `.a-form-field`, `.a-form-layout-field`, `.a-form-nested-field`
- `.a-form-label`, `.a-form-required`, `.a-form-submit`
- `.a-form-property`, `.a-form-hidden-field`
- `[data-a-form-field="person.email"]` for path-specific styling

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
| `asyncValidation` | `AFormAsyncValidationOptions` | - | Connects remote validation to change, blur, and submit |

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
import { FetchAsyncValidationAdapter } from "a-form-adapter-fetch";
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "a-form-async-validation";

const registry = new AsyncValidationRegistry();
registry.register(new FetchAsyncValidationAdapter({
  id: "customer-api",
  endpoint: "/api/forms/validate",
}));

const engine = new AsyncValidationEngine(registry);

<AForm
  spec={spec}
  asyncValidation={{ engine }}
  onSubmit={(data) => saveRegistration(data)}
/>;
```

`AForm` binds `change`, `blur`, and `submit` rules automatically. It applies change debounce, observes `dependsOn`, renders remote issues beside their fields, disables submit while work is pending, and forwards `onSubmit` only when every applicable result is non-blocking. Adapter configuration and credentials remain owned by the host application.

## Workspace Map

| Package | Responsibility |
| --- | --- |
| [`a-form-core`](packages/core/README.md) | Serializable contracts and normalized AST types |
| [`a-form-parser`](packages/parser/README.md) | YAML and Emmet parsing, semantic validation, and normalization |
| [`a-form-react`](packages/react/README.md) | Controlled React renderer powered by RJSF and AJV |
| [`a-form-async-validation`](packages/async-validation/README.md) | Remote validation registry and orchestration |
| [`a-form-adapter-fetch`](packages/adapter-fetch/README.md) | Runtime-configured HTTP validation adapter |
| `a-form-playground` | Interactive YAML editor and responsive React preview |

## Development

Node.js 20.19 or newer is required.

```bash
npm install
npm run verify
```

Run the interactive playground:

```bash
npm run dev --workspace a-form-playground
```

Run only the React package checks:

```bash
npm run typecheck --workspace a-form-react
npm test -- --run packages/react/src/AForm.test.tsx
```