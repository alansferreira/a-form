# Layout & fields cookbook

Copy-paste recipes for the layout and field features added on top of the base
[presentation adapters quick start](./presentation-adapters-quick-start.md):
right-aligned fields, visual panels, the `a-form-template` engine, templated
help text, and the new field kinds (date/time/datetime/range/autocomplete/async
options). A full combined example lives at
[examples/feature-showcase.a-form.yaml](../examples/feature-showcase.a-form.yaml).

## Render any of these snippets

Every recipe below is a `layout`/`schema`/`uiSchema` fragment. Drop it into a
full spec and render it with:

```bash
npm install react react-dom a-form-core a-form-parser a-form-react a-form-presentation-neobrutalism
```

```tsx
import { normalizeFormSpec, parseYamlSpec, validateFormSpec } from "a-form-parser";
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { NeobrutalismAdapter } from "a-form-presentation-neobrutalism";
import "a-form-presentation-neobrutalism/styles.css";

const registry = new PresentationAdapterRegistry();
registry.register(NeobrutalismAdapter);

export function Recipe({ yamlSource }: { yamlSource: string }) {
  const parsed = parseYamlSpec(yamlSource);
  if (!parsed.value) return <p>Invalid spec.</p>;

  const errors = validateFormSpec(parsed.value).filter((d) => d.severity === "error");
  if (errors.length > 0) return <pre>{errors.map((e) => e.message).join("\n")}</pre>;

  return (
    <AForm
      spec={normalizeFormSpec(parsed.value)}
      presentation={{ registry, adapterId: "neobrutalism" }}
      onSubmit={(value) => console.log(value)}
    />
  );
}
```

---

## Right-aligned fields

A field's `align: end` makes it hug the grid's right edge instead of packing
from the left — a span-4 `end` field always ends flush against column 12.

```yaml
layout:
  - type: field
    path: trip.budget
    span: { mobile: 12, tablet: 8 }
  - type: field
    path: trip.priority
    span: { mobile: 12, tablet: 4 }
    align: end
```

## Visual panels

A `panel` layout node groups one or more fields behind a titled, bordered frame.
Panels sit as siblings of plain fields at the top of `layout`.

```yaml
layout:
  - type: panel
    id: traveler-panel
    title: Traveler
    description: Who is this trip for?
    children:
      - type: field
        path: trip.travelerName
        span: { mobile: 12, tablet: 6 }
      - type: field
        path: trip.travelerEmail
        span: { mobile: 12, tablet: 6 }
```

The frame is decorative only (no real DOM nesting of the fields inside it).
Override it per presentation adapter:

```tsx
import type { PanelTemplateProps } from "a-form-react";

function CardPanel({ title, description, children }: PanelTemplateProps) {
  return (
    <div className="card">
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}

const CustomAdapter = {
  id: "custom",
  templates: { PanelTemplate: CardPanel },
};
```

## Date, time, datetime and range widgets

These map to the built-in default widgets shipped by `a-form-react` (native
`<input>` elements — override with `widgets` on a `PresentationAdapter` for a
richer picker library).

```yaml
schema:
  properties:
    trip:
      properties:
        departureDate: { type: string, format: date, title: Departure date }
        checkInTime: { type: string, title: Check-in time }
        budget: { type: number, title: Budget (USD), minimum: 0, maximum: 5000 }
uiSchema:
  trip:
    departureDate:
      ui:widget: date
    checkInTime:
      ui:widget: time
    budget:
      ui:widget: range
      ui:options:
        min: 0
        max: 5000
        step: 100
```

(`datetime` works the same way with `format: date-time` + `ui:widget: datetime`.)

## Autocomplete and async options

`autocomplete`/`asyncOptions` render a text input backed by a `<datalist>`.
`ui:options.source` is either a static array or a Mustache URL template
(rendered with `a-form-template` against the whole form's current data) that
gets `fetch`ed on each keystroke.

```yaml
schema:
  properties:
    trip:
      properties:
        country: { type: string, title: Country, enum: [BR, CR, PA] }
        city: { type: string, title: City }
uiSchema:
  trip:
    city:
      ui:widget: asyncOptions
      ui:options:
        source: "/api/cities?country={{trip.country}}"
        valueKey: id
        labelKey: name
        itemTemplate: "{{item.name}} ({{item.stateCode}})"
```

A static list (no network call) works the same way with an inline array:

```yaml
uiSchema:
  trip:
    country:
      ui:widget: autocomplete
      ui:options:
        source:
          - { id: BR, name: Brazil }
          - { id: CR, name: Costa Rica }
          - { id: PA, name: Panama }
```

## Templated help text (`ui:helpTemplate`)

`ui:helpTemplate` replaces the static `ui:help` with a Mustache template
rendered against the whole form's current data, so the help text reacts to
other fields as the user types.

```yaml
uiSchema:
  trip:
    city:
      ui:helpTemplate: "Showing cities for {{trip.country}}."
```

## Using `a-form-template` directly

The same engine that powers `ui:options.source` and `ui:helpTemplate` is a
standalone package you can call from your own code (e.g. to build request
URLs or labels outside of `AForm`):

```bash
npm install a-form-template
```

```ts
import { renderTemplate, renderUrlTemplate } from "a-form-template";

renderTemplate("Hello {{customer.firstName}}", { customer: { firstName: "Ana" } });
// => "Hello Ana"

renderUrlTemplate("/api/cities?country={{country}}", { country: "Costa Rica & Panamá" });
// => "/api/cities?country=Costa%20Rica%20%26%20Panam%C3%A1"
```

## Editing a field's absolute path in the visual builder

In `apps/playground-v2`, the inspector's "Absolute path" input is editable —
type a new dot-separated path (e.g. `trip.city`) to rename the selected field.
Renaming to a path already used by another field is rejected with a notice
instead of silently creating a duplicate.

---

## Full combined example

[examples/feature-showcase.a-form.yaml](../examples/feature-showcase.a-form.yaml)
combines all of the above in one runnable spec: two panels ("Traveler" and
"Trip details"), a right-aligned `priority` field, `date` widgets, a `range`
budget slider, an `asyncOptions` city field with a templated `source` and
`ui:helpTemplate`. Load it as `yamlSource` in the snippet at the top of this
page to see everything together.
