# a-form-react

**From normalized specification to responsive React form in one component.**

`a-form-react` renders AForm through RJSF and AJV. It connects JSON Schema validation, UI Schema hints, controlled React state, and a responsive 12-column layout through `AForm`.

[Open the AForm Playground](https://alansferreira.github.io/a-form/) to preview the React renderer at mobile, tablet, and desktop widths.

## Install

```bash
npm install react react-dom a-form-core a-form-react
```

React and React DOM 18 or newer are peer dependencies.

## Render a Form

`AForm` requires a `NormalizedFormSpec`, normally produced by `normalizeFormSpec` from `a-form-parser`.

```tsx
import type { JsonObject, NormalizedFormSpec } from "a-form-core";
import { AForm } from "a-form-react";
import { useState } from "react";

export function RegistrationForm({ spec }: { spec: NormalizedFormSpec }) {
  const [value, setValue] = useState<JsonObject>({});

  return (
    <AForm
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

  if (!parsed.value) return <p>Invalid YAML specification.</p>;

  const diagnostics = validateFormSpec(parsed.value);
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return <pre>{diagnostics.map(({ message }) => message).join("\n")}</pre>;
  }

  return (
    <AForm
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
| `asyncValidation` | `AFormAsyncValidationOptions` | - | Connects an async validation engine and optional result observer |
| `presentation` | `PresentationConfig` | - | Selects a runtime presentation adapter and its widgets |

## Presentation Adapters

Presentation adapters customize widgets and field templates without putting
framework code in the serializable form specification. The `ui:widget` value
continues to identify the semantic widget; the adapter supplies its runtime
implementation, markup, CSS classes, and states.

```tsx
import {
  AForm,
  PresentationAdapterRegistry,
} from "a-form-react";

const registry = new PresentationAdapterRegistry();
registry.register({
  id: "custom",
  widgets: {
    TextWidget: CustomTextWidget,
  },
});

<AForm
  spec={spec}
  presentation={{ registry, adapterId: "custom" }}
/>;
```

Adapters are runtime-only and are not exported with the YAML or JSON form
specification. The default renderer remains active when `presentation` is not
provided. CSS and provider setup, when required by a framework, belong to the
host application.

For complete installation commands and examples for the official Material and
Bootstrap adapters, the Tailwind-oriented preset, and custom widgets, see the
[presentation adapter quick start](../../docs/presentation-adapters-quick-start.md).

## Async Validation

Create the registry and engine in the host application, then pass the engine to `AForm`. Adapter endpoints, credentials, and request mappings remain outside the form specification.

```tsx
import { FetchAsyncValidationAdapter } from "a-form-adapter-fetch";
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "a-form-async-validation";
import { AForm } from "a-form-react";
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
    <AForm
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
interface AFormAsyncValidationEvent {
  ruleId: string;
  fieldPath: string;
  trigger: "change" | "blur" | "submit" | "manual";
  result: AsyncValidationResult;
}
```

## Responsive Preview

```tsx
import type { AFormViewport } from "a-form-react";

const [viewport, setViewport] = useState<AFormViewport>("mobile");

<AForm spec={spec} viewport={viewport} />;
```

The component applies the selected normalized span through CSS Grid. It renders only field paths present in the AForm layout and uses CSS ordering to match layout order.

## Styling Hooks

Use `className` to scope your design and target the stable `a-form-*` hooks:

```css
.account-form .a-form-object-root {
  gap: 1rem;
}

.account-form .a-form-field {
  min-width: 0;
}

.account-form .a-form-label {
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

.account-form .a-form-submit {
  padding: 0.75rem 1rem;
}
```

Public hooks include `.a-form-object-root`, `.a-form-object-bridge`, `.a-form-object-nested`, `.a-form-field`, `.a-form-layout-field`, `.a-form-nested-field`, `.a-form-label`, `.a-form-required`, `.a-form-property`, `.a-form-hidden-field`, and `.a-form-submit`.

Async state hooks include `.a-form-async-status`, `.a-form-async-issue`, `.a-form-async-issue-error`, `.a-form-async-issue-warning`, and `.a-form-async-issue-info`.

Target one field through its dotted path:

```css
[data-a-form-field="person.email"] {
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
