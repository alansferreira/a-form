# a-form-parser

**Turn human-friendly form definitions into trusted AForm contracts.**

`a-form-parser` parses strict YAML and compact Emmet-like layouts, reports source-aware diagnostics, validates form semantics, and produces the normalized specification expected by renderers.

[Open the AForm Playground](https://alansferreira.github.io/a-form/) to edit YAML and inspect the parsed form interactively.

## Install

```bash
npm install a-form-core a-form-parser
```

## The Complete Pipeline

```ts
import {
  normalizeFormSpec,
  parseYamlSpec,
  validateFormSpec,
} from "a-form-parser";

const parsed = parseYamlSpec(yamlSource);

if (!parsed.value) {
  throw new Error(parsed.diagnostics.map(({ message }) => message).join("\n"));
}

const diagnostics = [
  ...parsed.diagnostics,
  ...validateFormSpec(parsed.value),
];

if (diagnostics.some(({ severity }) => severity === "error")) {
  console.error(diagnostics);
} else {
  const normalized = normalizeFormSpec(parsed.value);
  console.log(normalized);
}
```

## Public API

### `parseYamlSpec(source, options?)`

Parses a YAML document into a `FormSpec` without executing document content.

```ts
const result = parseYamlSpec(source, {
  maxSourceLength: 500_000,
  maxDepth: 30,
  maxNodes: 5_000,
  maxAliases: 20,
});
```

The result contains `value` when a specification could be produced and always contains `diagnostics`.

Default limits protect parser consumers from unexpectedly expensive documents:

| Option | Default |
| --- | ---: |
| `maxSourceLength` | `1_000_000` characters |
| `maxDepth` | `40` |
| `maxNodes` | `10_000` |
| `maxAliases` | `50` |

### `validateFormSpec(spec)`

Checks the semantic contract after parsing, including:

- supported specification version;
- row, column, field, and nested-row hierarchy;
- responsive spans from 1 through 12;
- field paths against nested JSON Schema properties;
- duplicate fields;
- async validation paths, triggers, and timing values.

### `normalizeFormSpec(spec)`

Returns a `NormalizedFormSpec` with deterministic fallback IDs and complete `mobile`, `tablet`, and `desktop` spans.

```ts
const normalized = normalizeFormSpec(spec);

// Ready for <AForm spec={normalized} />
```

### `parseEmmetLayout(source)`

Parses a compact layout expression into `RowNode[]`:

```ts
import { parseEmmetLayout } from "a-form-parser";

const result = parseEmmetLayout(
  "row>(col[mobile=12 tablet=6]>field[path=person.name])" +
  "+(col[mobile=12 tablet=6]>field[path=person.email])",
);
```

Supported building blocks are `row`, `col`, `field`, child nesting with `>`, siblings with `+`, and attributes inside `[]`.

## Diagnostics First

Parser functions do not throw for document errors. They return structured diagnostics with a code, severity, specification path, and source range when available.

```ts
for (const diagnostic of result.diagnostics) {
  console.log(
    diagnostic.code,
    diagnostic.severity,
    diagnostic.range?.start.line,
    diagnostic.message,
  );
}
```

Diagnostic code families include `YF_PARSE_*`, `YF_SPEC_*`, `YF_LAYOUT_*`, `YF_FIELD_*`, `YF_ASYNC_*`, and `YF_EMMET_*`.

## Important Boundaries

- Parsing is synchronous.
- YAML keys are strict and duplicate keys are rejected.
- Field path validation follows nested `schema.properties`.
- JSON Schema `$ref` resolution and composition traversal are not implemented yet.
- Parse diagnostics and semantic diagnostics are separate; run both parsing and `validateFormSpec` before rendering.

## Works With

- `a-form-react` for rendering normalized specs
- `a-form-core` for all public data contracts
