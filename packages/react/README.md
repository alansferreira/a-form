# jsfl-react

**From normalized specification to responsive React form in one component.**

`jsfl-react` renders JSFL Forms through RJSF and AJV. It connects JSON Schema validation, UI Schema hints, controlled React state, and a responsive 12-column layout through `JSFLForm`.

## Install

```bash
npm install react react-dom jsfl-core jsfl-react
```

React and React DOM 18 or newer are peer dependencies.

## Render a Form

`JSFLForm` requires a `NormalizedFormSpec`, normally produced by `normalizeFormSpec` from `jsfl-parser`.

```tsx
import type { JsonObject, NormalizedFormSpec } from "jsfl-core";
import { JSFLForm } from "jsfl-react";
import { useState } from "react";

export function RegistrationForm({ spec }: { spec: NormalizedFormSpec }) {
  const [value, setValue] = useState<JsonObject>({});

  return (
    <JSFLForm
      spec={spec}
      viewport="desktop"
      value={value}
      onChange={setValue}
      onSubmit={(data) => console.log("Submitted", data)}
      submitLabel="Create account"
    />
  );
}
```

## Parse YAML and Render

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

  if (!parsed.value) return <p>Invalid YAML specification.</p>;

  const diagnostics = validateFormSpec(parsed.value);
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return <pre>{diagnostics.map(({ message }) => message).join("\n")}</pre>;
  }

  return (
    <JSFLForm
      spec={normalizeFormSpec(parsed.value)}
      value={value}
      onChange={setValue}
    />
  );
}
```

## Component API

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `spec` | `NormalizedFormSpec` | Required | Schema, UI Schema, and normalized layout |
| `viewport` | `"mobile" \| "tablet" \| "desktop"` | `"desktop"` | Chooses each column's active span |
| `value` | `JsonObject` | `{}` | Controlled form value |
| `onChange` | `(value: JsonObject) => void` | - | Receives the next complete form value |
| `onSubmit` | `(value, event) => void` | - | Receives validated data and the form event |
| `submitLabel` | `ReactNode` | `"Submit"` | Submit button content |
| `disabled` | `boolean` | `false` | Disables the complete form |
| `readOnly` | `boolean` | `false` | Makes the complete form read-only |
| `noHtml5Validate` | `boolean` | `false` | Disables native browser validation UI |
| `className` | `string` | `""` | Adds a class to the root form |
| `asyncValidation` | `JSFLAsyncValidationOptions` | - | Connects an async validation engine and optional result observer |

## Async Validation

Create the registry and engine in the host application, then pass the engine to `JSFLForm`. Adapter endpoints, credentials, and request mappings remain outside the form specification.

```tsx
import { FetchAsyncValidationAdapter } from "jsfl-adapter-fetch";
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "jsfl-async-validation";
import { JSFLForm } from "jsfl-react";
import { useState } from "react";

const registry = new AsyncValidationRegistry();

registry.register(new FetchAsyncValidationAdapter({
  id: "customer-api",
  endpoint: "/api/forms/validate",
  headers: async () => ({
    authorization: `Bearer ${await getAccessToken()}`,
  }),
}));

const engine = new AsyncValidationEngine(registry);

export function RegistrationForm({ spec }: { spec: NormalizedFormSpec }) {
  const [value, setValue] = useState<JsonObject>({});

  return (
    <JSFLForm
      spec={spec}
      value={value}
      onChange={setValue}
      asyncValidation={{
        engine,
        onResult: ({ fieldPath, trigger, result }) => {
          analytics.track("form-validation", {
            fieldPath,
            trigger,
            status: result.status,
            cached: result.cached,
          });
        },
      }}
      onSubmit={(data) => saveRegistration(data)}
    />
  );
}
```

The component reads rules from `spec.validations.async` and automatically:

- executes `change` rules, including dependency changes from `dependsOn`;
- applies `debounceMs` before change validation;
- executes `blur` rules for the field that lost focus;
- executes applicable rules before forwarding `onSubmit`;
- prevents the external `onSubmit` callback when a result is blocking;
- disables the submit button while validation is pending;
- displays blocking issues through the RJSF field error UI;
- displays non-blocking warning and info issues next to the field;
- cancels active requests when the component unmounts.

The engine should belong to one live form instance. Create separate engines when multiple forms are mounted concurrently.

### Result Observer

`onResult` receives every completed, non-cancelled validation:

```ts
interface JSFLAsyncValidationEvent {
  ruleId: string;
  fieldPath: string;
  trigger: "change" | "blur" | "submit" | "manual";
  result: AsyncValidationResult;
}
```

## Responsive Preview

```tsx
import type { JSFLViewport } from "jsfl-react";

const [viewport, setViewport] = useState<JSFLViewport>("mobile");

<JSFLForm spec={spec} viewport={viewport} />;
```

The component applies the selected normalized span through CSS Grid. It renders only field paths present in the JSFL layout and uses CSS ordering to match layout order.

## Styling Hooks

Use `className` to scope your design and target the stable `jsfl-*` hooks:

```css
.account-form .jsfl-object-root {
  gap: 1rem;
}

.account-form .jsfl-field {
  min-width: 0;
}

.account-form .jsfl-label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 700;
}

.account-form input,
.account-form select,
.account-form textarea {
  width: 100%;
  box-sizing: border-box;
}

.account-form .jsfl-submit {
  padding: 0.75rem 1rem;
}
```

Public hooks include `.jsfl-object-root`, `.jsfl-object-bridge`, `.jsfl-object-nested`, `.jsfl-field`, `.jsfl-layout-field`, `.jsfl-nested-field`, `.jsfl-label`, `.jsfl-required`, `.jsfl-property`, `.jsfl-hidden-field`, and `.jsfl-submit`.

Async state hooks include `.jsfl-async-status`, `.jsfl-async-issue`, `.jsfl-async-issue-error`, `.jsfl-async-issue-warning`, and `.jsfl-async-issue-info`.

Target one field through its dotted path:

```css
[data-jsfl-field="person.email"] {
  grid-column: span 12;
}
```

## Runtime Contract

- Pass a normalized spec, not a raw `FormSpec`.
- Keep controlled state synchronized in `onChange` when `value` is supplied.
- Local JSON Schema validation uses AJV through RJSF 6.
- Labels and widgets come from JSON Schema and UI Schema.
- Modern CSS Grid support is required.
- Async validation is enabled only when an engine is supplied through `asyncValidation`.
- `manual` rules remain host-controlled; automatic component triggers cover `change`, `blur`, and `submit`.
- The default RJSF theme provides the underlying widgets; use the public CSS hooks for visual customization.
