# jsfl-core

**The stable language shared by every JSFL Forms package.**

`jsfl-core` contains the serializable TypeScript contracts for form specifications, responsive layouts, diagnostics, normalized trees, and async validation rules. It has no runtime dependencies and no framework coupling.

## Install

```bash
npm install jsfl-core
```

## Use This Package When

- You generate or store JSFL form specifications.
- You need shared types in an adapter, editor integration, or renderer.
- You exchange form definitions across browser, server, worker, or build-time boundaries.
- You want to create a normalized specification without importing React types.

For YAML parsing and normalization, use `jsfl-parser`. For rendering, use `jsfl-react`.

## Define a Form Contract

```ts
import type { FormSpec } from "jsfl-core";

const registration: FormSpec = {
  version: "1",
  schema: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", title: "Email", format: "email" },
    },
  },
  uiSchema: {
    email: { "ui:autocomplete": "email" },
  },
  layout: [
    {
      type: "row",
      children: [
        {
          type: "column",
          span: { mobile: 12, tablet: 8, desktop: 6 },
          children: [{ type: "field", path: "email" }],
        },
      ],
    },
  ],
};
```

## Main Types

| Type | Purpose |
| --- | --- |
| `FormSpec` | Complete versioned form contract |
| `NormalizedFormSpec` | Form contract with stable node IDs and complete responsive spans |
| `RowNode`, `ColumnNode`, `FieldNode` | Responsive layout tree |
| `ResponsiveSpan` | Mobile, tablet, and desktop values for the 12-column grid |
| `JsonValue`, `JsonObject` | Framework-neutral JSON values and form state |
| `Diagnostic`, `DiagnosticSeverity` | Structured parser and validation feedback |
| `SourcePosition`, `SourceRange` | Zero-based source coordinates with offsets |
| `AsyncValidationRuleSpec` | Declarative remote validation behavior |

## Responsive Layout

Columns accept either one span or breakpoint-specific spans:

```ts
const fullWidth = 12;

const responsive = {
  mobile: 12,
  tablet: 6,
  desktop: 4,
} as const;
```

Missing values cascade during normalization: `mobile` defaults to `12`, `tablet` defaults to `mobile`, and `desktop` defaults to `tablet`.

## Design Guarantees

- Specifications are immutable TypeScript data contracts.
- `FormSpec.version` is currently fixed to `"1"`.
- Field nodes reference JSON Schema properties through dotted paths such as `person.email`.
- Specifications must contain data only. Runtime functions, credentials, and transport configuration belong in the host application.
- This package defines contracts; it does not parse, validate, normalize, or render them.

## Package Relationships

```text
jsfl-core
  +-- jsfl-parser
  +-- jsfl-react
  +-- jsfl-async-validation
  +-- jsfl-language-service
```

## Requirements

- Node.js 20.19 or newer for the project toolchain
- TypeScript 5.9 or newer recommended for consumers
