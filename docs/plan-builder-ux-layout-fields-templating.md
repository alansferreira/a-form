# Plan: Builder UX + Layout + New Field Types + Templating

TL;DR: Six related improvements to `apps/playground-v2` and its supporting packages:
(1) make "Absolute path" editable, (2) add left/right grid alignment for columns,
(3) add a new `panel` layout node for visual grouping, (4) add date/time/datetime/
range-slider/autocomplete/async-options field kinds using dedicated per-adapter UI
libraries, (5) add a lightweight templating package (Mustache) for help-text and
URL/param interpolation across fields, reused by the async-options/autocomplete
widgets. Scope is limited to `playground-v2` (not v1/original playground).

**Decisions**
- Target only `apps/playground-v2` builder (per user choice); v1/playground left untouched.
- Alignment is a **column-level, grid-slot** concept: a column with `align: "end"`
  consumes the last N slots of the 12-col row instead of the next N from the left.
  Not a text-align/CSS-only cosmetic change.
- Panels are a **new layout node type** (`panel`), not just a style flag on row/column.
- Date/time/datetime picker + range slider: use **dedicated UI libraries** per
  presentation adapter (not native `<input type=date>`).
- Autocomplete/async options: **no new engine package** — ad-hoc fetch configured
  directly via `ui:options` on the widget (simpler than reusing async-validation engine).
- Template engine: adopt an **existing lightweight library** (Mustache, logic-less,
  ~4-7KB) wrapped in a new tiny package, instead of hand-rolled interpolation.

---

## Phase 1 — Editable "Absolute path" field ✅ DONE
*Independent, can be done first/standalone.*

1. In [apps/playground-v2/src/builder/BuilderApp.tsx](../apps/playground-v2/src/builder/BuilderApp.tsx#L581), replace the `readOnly` "Absolute path" `<input>` with a controlled editable input.
2. On change: strip a leading `$.` prefix, validate the remainder is a non-empty dot-safe identifier (reuse/extract the duplicate-path check already in `placeField()` around [BuilderApp.tsx#L192-L197](../apps/playground-v2/src/builder/BuilderApp.tsx)), and reject/notice on duplicates against other fields' `path` (excluding the field being edited).
3. Update `updateSelected()` ([BuilderApp.tsx#L251-L257](../apps/playground-v2/src/builder/BuilderApp.tsx)) call site to set both `path` and recomputed `jsonPath: "$." + path` atomically.
4. Also allow typing a **brand-new** path (not just editing existing) — no special-casing needed since it's a plain text input; only the validation in step 2 applies.
5. Verify `buildFormSpec()` / `schemaForField()` in [model.ts](../apps/playground-v2/src/builder/model.ts) key everything off the current `field.path` at build time (they do, per Discovery) so renaming needs no extra migration step.

**Relevant files**
- `apps/playground-v2/src/builder/BuilderApp.tsx` — input field, `updateSelected`, duplicate check
- `apps/playground-v2/src/builder/model.ts` — `createField`, `BuilderField` type (no changes expected, just confirms `path`/`jsonPath` relationship)

**Verification**
- Manual: rename a field's path in the inspector to an existing path → see duplicate notice, no state change. Rename to a fresh path → canvas/schema updates, exported YAML reflects new path.

---

## Phase 2 — Left/Right grid alignment for columns ✅ DONE

1. **Core type**: add `align?: "start" | "end"` to `ColumnNode` in [packages/core/src/index.ts](../packages/core/src/index.ts#L44-L49) (default `"start"`), propagate to `NormalizedColumnNode`.
2. **Schema**: add `"align": { "enum": ["start","end"] }` property to the `column` `$def` in [schemas/a-form.schema.json](../schemas/a-form.schema.json#L520-L545).
3. **Layout algorithm** (packages/react/src/AForm.tsx):
   - Rework `collectLayout()` ([AForm.tsx#L108-L124](../packages/react/src/AForm.tsx#L108)) to compute **explicit** `gridColumnStart`/`gridColumnEnd` per field instead of relying on browser auto-placement + `order` alone. Per row: iterate columns in declared order; for `align !== "end"` columns accumulate a running start line from `1`; for `align === "end"` columns accumulate a running end line backward from `13`. Store computed `{start, end}` (or a ready `gridColumn` string) per field path in the context (replacing the current plain `spans: Record<string, number>` map, or adding alongside it).
   - Update `createFieldTemplate()`'s style calc ([AForm.tsx#L138-L161](../packages/react/src/AForm.tsx#L138)) to use the explicit `gridColumn: "${start} / ${end}"` instead of `span ${spans[path]}`.
   - Note: this requires each row's fields to render within a **row-scoped** placement (not just a flat global order), since alignment resets per row — the explicit start/end values already encode this per row, so the flat single grid still works as long as computed lines are correct per row-group.
4. **Builder UI** ([apps/playground-v2/src/builder/BuilderApp.tsx](../apps/playground-v2/src/builder/BuilderApp.tsx) inspector panel): add an alignment toggle (Left/Right) for the selected column/field, wired through `updateSelected`/column-level update helper (currently only fields are directly selectable — check whether column-level selection/edit exists; if not, add minimal column selection or expose align as a per-field property that's translated to the parent column on export).
5. **Canvas preview**: mirror the same start/end computation in the builder's live canvas rendering so what you see while editing matches the exported form.

**Relevant files**
- `packages/core/src/index.ts` — `ColumnNode`, `NormalizedColumnNode`
- `packages/parser/src/normalize.ts` — carry `align` through normalization (default `"start"`)
- `packages/react/src/AForm.tsx` — `collectLayout`, `createFieldTemplate`, `LayoutFormContext`
- `schemas/a-form.schema.json` — `column` `$def`
- `apps/playground-v2/src/builder/BuilderApp.tsx` / `model.ts` — inspector control + canvas preview

**Verification**
- Unit test (vitest, repo already has `vitest.config.ts`) for the start/end computation: a row with a left span-6 and a right-aligned span-3 column places them at grid lines `1/7` and `10/13` respectively, leaving a gap between.
- Manual: build a row with 2 columns, mark one "align right", confirm it hugs the row's right edge in both builder canvas and rendered `AForm`.

---

## Phase 3 — `panel` layout node (visual grouping container) ✅ DONE (visual-only, no per-adapter chrome yet)

1. **Core type**: add `PanelNode` to [packages/core/src/index.ts](../packages/core/src/index.ts#L56):
   `{ type: "panel"; id?: string; title?: string; description?: string; collapsible?: boolean; defaultCollapsed?: boolean; children: readonly RowNode[] }`.
   Extend `LayoutNode` union and `FormSpec.layout` to `readonly (RowNode | PanelNode)[]`. Add `NormalizedPanelNode`.
2. **Schema**: add a `panel` `$def` to [schemas/a-form.schema.json](../schemas/a-form.schema.json#L506) (title/description/collapsible + `children: [row]*`), and update the top-level `layout` array items to `oneOf [row, panel]`.
3. **Parser**:
   - [packages/parser/src/validate.ts](../packages/parser/src/validate.ts#L42) — path-existence/duplicate traversal must recurse into `panel.children` the same way it does rows.
   - [packages/parser/src/normalize.ts](../packages/parser/src/normalize.ts#L28) — normalize panels (assign ids, normalize nested rows).
   - [packages/parser/src/emmet.ts](../packages/parser/src/emmet.ts#L225) — extend compact syntax to support a panel marker (e.g. `panel:Title > row > ...`) if the emmet-like shorthand should support panels; otherwise document that panels require full YAML/JSON form.
4. **React renderer** ([packages/react/src/AForm.tsx](../packages/react/src/AForm.tsx)): panels introduce a **nested grid boundary** — a panel wraps its own `repeat(12,...)` grid instance (bordered container with title), distinct from the flat root grid. Update root rendering to iterate top-level `spec.layout` items: rows contribute to the root grid as today; panels render as a bordered/titled wrapper containing their own sub-grid built from the same `collectLayout`/field-template logic scoped to `panel.children`.
5. **Presentation adapters**: add optional `PanelTemplate` to `PresentationAdapter.templates` ([packages/react/src/presentation.ts](../packages/react/src/presentation.ts#L13)) so bootstrap/material/neobrutalism/tailwind can each render panel chrome consistently with their design system (e.g. Bootstrap `Card`, MUI `Paper`/`Accordion`, custom bordered `div` for neobrutalism/tailwind). Provide a sane default (plain `<fieldset><legend>`) when an adapter doesn't supply one.
6. **Builder UI** (`apps/playground-v2/src/builder`): add "Panel" to the drag palette as a container; allow dropping rows inside a panel in the canvas; inspector fields for panel `title`/`description`/`collapsible`.

**Relevant files**
- `packages/core/src/index.ts` — `PanelNode`, `LayoutNode`, `FormSpec.layout`, `NormalizedPanelNode`
- `schemas/a-form.schema.json` — new `panel` `$def`, layout array `oneOf`
- `packages/parser/src/validate.ts`, `normalize.ts`, `emmet.ts`
- `packages/react/src/AForm.tsx` — root layout iteration, nested-grid rendering
- `packages/react/src/presentation.ts` — `PanelTemplate` addition to adapter interface
- `packages/presentation-bootstrap|material|neobrutalism|tailwind/src/*` — panel chrome
- `apps/playground-v2/src/builder/*` — palette entry, canvas drop target, inspector

**Verification**
- Parser unit tests: duplicate-path detection still fires across panel boundaries; normalize produces stable ids for panels/nested rows.
- Manual: build a form with two panels, each with its own rows/fields; confirm rendered output shows bordered/titled groups with correct internal grids, and exported YAML round-trips through the parser.

---

## Phase 4 — Templating package (Mustache-based) ✅ DONE

1. Add a new package `packages/template` (mirrors existing single-purpose packages like `adapter-fetch`) with dependency on `mustache` (lightest well-known logic-less templating lib).
2. Export `renderTemplate(template: string, context: JsonObject, options?: { escape?: (value: string) => string }): string` wrapping `Mustache.render`, defaulting to **no HTML escaping** (since primary uses are URL params and plain help text, not HTML injection) — expose an explicit `urlEncode` escape helper for URL-building call sites.
3. Document supported syntax: `{{path.to.field}}` resolves via the same dotted-path convention already used for `path`/`jsonPath` elsewhere (reuse `valueAtPath` logic pattern from [AForm.tsx#L86-L92](../packages/react/src/AForm.tsx#L86) — factor it into `packages/core` if useful for sharing).
4. No engine/caching/abort-signal machinery — this is pure string rendering, consumed synchronously wherever a template string + context object are available.

**Relevant files**
- `packages/template/package.json`, `packages/template/src/index.ts` (new)
- `packages/core/src/index.ts` — optionally export a shared `valueAtPath` helper if reused across `react`/`template`

**Verification**
- Unit tests: `renderTemplate("{{a.b}}", { a: { b: "x" } })` → `"x"`; missing path renders empty string (Mustache default); URL-encode helper escapes special characters.

---

## Phase 5 — New field kinds (date, time, datetime, range slider, autocomplete, async options) ✅ DONE (default widgets; per-adapter rich pickers are a follow-up)
*Depends on Phase 4 for autocomplete/async item-label templating; independent of Phases 2-3.*

**Update:** `ui:helpTemplate` (Mustache help text interpolated against the whole form's data, via `a-form-template`) is done ✅ — implemented directly in `packages/react/src/AForm.tsx`'s `FieldTemplate`, documented in `packages/react/README.md`.

**Revised widget strategy:** instead of implementing date/time/datetime/range/autocomplete/asyncOptions widgets separately in all 4 presentation packages up front, ship **default widgets once in `packages/react`** (native HTML5 inputs for pickers/range; a small headless combobox for autocomplete/asyncOptions using `a-form-template` for the `source` URL). `AForm` merges `{ ...defaultWidgets, ...presentationAdapter?.widgets }` so any adapter can still override with a richer library (MUI pickers/Slider/Autocomplete, react-datepicker, rc-slider, etc.) later without changing the contract. This avoids a large multi-package rollout while keeping every new field kind usable immediately across all adapters.

1. **Builder model** ([apps/playground-v2/src/builder/model.ts](../apps/playground-v2/src/builder/model.ts#L4-L46)): extend `FieldKind` union with `'date' | 'time' | 'datetime' | 'range' | 'autocomplete' | 'asyncOptions'`, add entries to `FIELD_KINDS` palette, extend `fieldKindFromSpec()` (detection: `format: date/time/date-time` → picker kinds; `ui:widget: range` → range; `ui:widget: autocomplete` + no source → autocomplete; `+ ui:options.source` → asyncOptions), and `schemaForField()` to emit the right JSON Schema (`format`, `type: number` + min/max for range) + `uiSchema` (`ui:widget`, `ui:options`).
2. **Inspector UI**: add fields for range `min`/`max`/`step`; autocomplete/async `source` URL (template string, rendered via Phase 4 at request time with current form values as context), `valueKey`/`labelKey` for mapping response items, and an item-label template string (Mustache) for custom rendering.
3. **Schema**: no structural schema.json change needed (uses existing generic `uiOptions`/`ui:widget` free-form slots), but document the new `ui:widget` values and `ui:options` shape in `docs/`.
4. **Default widgets in `packages/react`** (registered once, overridable per adapter):
   - `date` / `time` / `datetime` → native `<input type="date">` / `type="time"` / `type="datetime-local">`.
   - `range` → native `<input type="range">` reading `min`/`max`/`step` from `ui:options`.
   - `autocomplete` / `asyncOptions` → a small combobox widget: static `ui:options.source` array or `{ url, valueKey, labelKey, itemTemplate }`; for URL sources, renders the URL with `renderUrlTemplate` (from `a-form-template`) against the current `formContext.rootFormData`, `fetch`es on input (debounced), maps the response via `valueKey`/`labelKey` or `itemTemplate`.
   - Per-adapter rich pickers (MUI `@mui/x-date-pickers`/`Slider`/`Autocomplete`, `react-datepicker`, `rc-slider`) remain a documented **follow-up**, not required for the feature to work.
5. **Dependencies**: none required for the default widgets (native inputs + `fetch`); adapter-specific rich widgets (follow-up) would add `@mui/x-date-pickers`, `react-datepicker`, `rc-slider` as needed.

**Relevant files**
- `apps/playground-v2/src/builder/model.ts` — `FieldKind`, `FIELD_KINDS`, `fieldKindFromSpec`, `schemaForField`
- `apps/playground-v2/src/builder/BuilderApp.tsx` — inspector controls for new kinds
- `packages/react/src/AForm.tsx` / new `packages/react/src/widgets.tsx` — default widgets, merged into the RJSF registry
- `packages/template/src/index.ts` — consumed by the autocomplete/asyncOptions widget
- `docs/presentation-adapters.md` — document new `ui:widget` ids and `ui:options` shape

**Verification**
- Manual: place each new field kind in the builder, confirm live preview renders correctly; for autocomplete/asyncOptions, point `source` at a test/mock endpoint and confirm options populate and the template-built URL includes interpolated field values.
- Unit tests: `fieldKindFromSpec`/`schemaForField` mapping for new kinds in the builder model test suite; default widget rendering/behavior in `packages/react`.

---

## Suggested execution order
Phase 1 (quick win) → Phase 4 (small, unblocks Phase 5) → Phase 2 and Phase 3 (independent of each other, can interleave) → Phase 5 (widgets, largest surface area, touches all 4 presentation packages).

## Further Considerations
1. **Panel nesting inside columns**: current design only allows panels as top-level `layout` siblings of rows (not nested inside a column alongside fields). If nested panels-in-columns are needed later, the schema/renderer would need another pass — flagged as out of scope for now unless you say otherwise.
2. **Template escaping default**: Mustache HTML-escapes `{{ }}` by default; plan uses **no escaping** by default with an explicit `urlEncode` helper for URL contexts. Confirm this fits both "help text" (plain text, no HTML risk) and "URL params" (needs percent-encoding) use cases before implementation.
3. **Per-package UI libraries**: MUI already ships pickers/slider/autocomplete (no extra dependency choice needed there); for bootstrap/neobrutalism/tailwind the plan defaults to `react-datepicker` + `rc-slider` + a hand-built combobox. Say if you'd rather standardize on a single cross-framework headless lib (e.g. `react-aria`) instead for visual/behavioral consistency across all four adapters.
