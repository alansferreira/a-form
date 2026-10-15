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
| `viewport` | `"auto" \| "mobile" \| "tablet" \| "desktop"` | `"desktop"` | Chooses each column's active span; auto follows form width |
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

Use `<AForm spec={spec} viewport="auto" />` for responsive layout based on the
form's available content width, not the browser window. A `ResizeObserver`
updates spans when the container resizes: mobile below 768px, tablet from
768px to below 1024px, and desktop from 1024px. Auto uses mobile spans during
server rendering and until the first measurement. Browsers must support
`ResizeObserver`. The default remains desktop; explicit modes stay fixed.

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

Separators are independent layout nodes (`{ "type": "separator", "title": ... }`) that render a titled divider between fields without grouping or changing field ownership. The renderer exposes `.a-form-separator`, `.a-form-separator-title`, and `.a-form-separator-description`; presentation adapters can provide a `SeparatorTemplate` to customize the divider. YAML specs using the legacy `panel` node are migrated on parse to a separator followed by its fields.

Use `ui:helpTemplate` instead of `ui:help` to render a Mustache template (via `a-form-template`) against the whole form's current data, e.g. `uiSchema: { phone: { "ui:helpTemplate": "Use the dialing code for {{person.country}}." } }`. The template is re-rendered on every change, so the help text can react to other fields' values.

Async state hooks include `.a-form-async-status`, `.a-form-async-issue`, `.a-form-async-issue-error`, `.a-form-async-issue-warning`, and `.a-form-async-issue-info`.

Target one field through its dotted path:

```css
[data-a-form-field="person.email"] {
  grid-column: span 12;
}
```

## Inline Editor

`AInlineForm` renders an HTML document where each `{{path}}` placeholder is a click-to-edit field. The template comes from `spec.inline.template` or the `template` prop (the prop wins).

```yaml
inline:
  template: |
    <p>Contract with <strong>{{customer.name}}</strong> on the {{plan}} plan.</p>
```

```tsx
import { AInlineForm } from "a-form-react";

<AInlineForm
  spec={normalizeFormSpec(spec)}
  value={value}
  onChange={setValue}
  commitMode="field"
  onCommit={({ path, value, formData }) => save(path, value)}
  asyncValidation={{ engine }}
  presentation={{ registry, adapterId: "tailwind" }}
/>;
```

- `commitMode="field"` (default): Enter, blur or the confirm button runs JSON Schema validation for the field plus its async rules; blocking results keep the editor open, otherwise `onChange` and `onCommit` fire. Escape cancels.
- `commitMode="form"`: confirmed edits update `onChange` only; submit validates the whole schema and async `submit` rules before `onSubmit`.
- Edit mode renders the field through RJSF with the presentation adapter's widgets/templates; read mode shows enum/oneOf titles, `Yes`/`No`, locale dates and selected `asyncOptions` labels. Override texts with `labels` and dates with `locale`.
- The template is parsed into React elements, never injected as HTML: only allow-listed tags (`p`, `span`, `div`, `strong`, `em`, headings, lists, tables…) and attributes (`class`, `title`, `role`, `lang`, `dir`, `aria-*`, `data-*`, `colspan`/`rowspan`) survive. Mustache sections, partials and triple mustaches are rejected. Problems are reported through `onDiagnostic` (or `console.warn`).

Styling hooks: `.a-form-inline` (root, plus the adapter class), `.a-form-inline-field`, `.a-form-inline-read`, `.a-form-inline-read-empty`, `.a-form-inline-edit`, `.a-form-inline-actions`, `.a-form-inline-confirm`, `.a-form-inline-cancel`, `.a-form-inline-status`, `.a-form-inline-issue-{error|warning|info}`, `.a-form-inline-errors` and `.a-form-inline-submit`. Each field exposes `data-a-form-inline-field="<path>"` and `data-state="read|edit|pending|invalid"`.

### Template Loader

`template` accepts either the HTML itself or a function that receives `spec.inline.template` (a relative path, an id or any other key) and returns the HTML, synchronously or as a `Promise`.

```yaml
inline:
  template: templates/contract.html
```

```tsx
const loadTemplate = async (reference: string) => (await fetch(`/forms/${reference}`)).text();

<AInlineForm spec={spec} template={loadTemplate} />;
```

While the promise is pending the root renders empty with `.a-form-inline-loading` and `aria-busy="true"`; a thrown or rejected loader renders `.a-form-inline-load-error` and reports `YF_INLINE_TEMPLATE_LOAD`. The loader runs again only when `spec.inline.template` changes, not when the function identity changes. The parser treats an `inline.template` without placeholders as a loader reference and skips its placeholder/required-field checks.

## Runtime Contract

- Pass a normalized spec, not a raw `FormSpec`.
- Keep controlled state synchronized in `onChange` when `value` is supplied.
- Local JSON Schema validation uses AJV through RJSF 6.
- Labels and widgets come from JSON Schema and UI Schema.
- Modern CSS Grid support is required.
- Async validation is enabled only when an engine is supplied through `asyncValidation`.
- `manual` rules remain host-controlled; automatic component triggers cover `change`, `blur`, and `submit`.
- The default RJSF theme provides the underlying widgets; use the public CSS hooks for visual customization.
