# AForm Studio

Second-generation visual playground based on the Kinetic Schema prototype.

## Features

- Three-panel schema, canvas, and property inspector workspace
- Drag-and-drop and touch-friendly field placement on a 12-column grid
- Editable AForm YAML with apply and download actions
- Local autosave, recovery after reload, and project-wide undo/redo
- Live auto, mobile, tablet, and desktop preview using `a-form-react`
- Adapter-aware bold emphasis for edited fields in normal and inline forms
- Array/object fields with preserved nested schemas and array add/remove/reorder controls
- JSON or YAML import with optional generation of matching data or a specification
- Self-contained production build for static hosting

## Development

```bash
npm run dev --workspace a-form-playground
```

The preview includes runtime selectors for Material, Bootstrap and Tailwind.
The selected presentation is preview state only and is not added to the
exported AForm specification.
Auto fills the available preview width and updates field spans as the form resizes:
mobile below 768px, tablet from 768px, and desktop from 1024px.

Arrays from imported data can be dragged onto the canvas. Item types are inferred
from the samples, including properties across object entries. Empty arrays start
with string items; use the code editor to define more specific item schemas.
Imported `items`, references, validation constraints, and nested UI schemas are
preserved. The array inspector can enable or disable adding, removing, and
reordering items; the live preview respects those options and `minItems`/`maxItems`.

## Generate a spec or example data during import

Both import dialogs have an optional checkbox, **unchecked by default**:

- In **Code > Import**, **Create example data from this spec** applies the
  imported spec and replaces the data source and preview values with a generated
  example. The data source keeps its current JSON/YAML format. Without the
  checkbox, the imported text remains a code draft and existing data is untouched.
- In **Data Source > Import**, **Create a spec from these data** replaces the
  specification, layout, and any pending code draft with an inferred form.
  The imported data and format are retained exactly, and the preview uses those
  values. Without the checkbox, the current spec is left unchanged.

Each paired import is one project-history step: Undo restores both sides, Redo
reapplies them, and autosave preserves the result. Cancel changes neither
document. The checkbox resets when the dialog is reopened.

Spec-to-data generation runs locally using `json-schema-faker`. It prefers
schema defaults/examples and respects constants, enums, nested objects, arrays,
local references, and supported JSON Schema constraints. Arrays normally include
an example item unless their schema/default requires an empty array. Generated
candidates are checked with the same AJV validator used by the renderer before
anything is replaced. Generation is deterministic and bounded to 32 attempts
and a depth of 32. Remote references are not fetched. Unsupported constraints,
invalid defaults, or schemas for which no valid sample is found produce an
error inside the import dialog without replacing either document; the draft
remains available to edit or import with generation unchecked.

Data-to-spec inference reuses the Studio's type inference, preserving nested
objects, null values, and arrays, including mixed item types and properties
observed across object entries. Empty arrays start with string items. It cannot
infer requiredness, business rules, or validation constraints from a single
sample; add these in Code. Nested objects with dotted property names are kept
as grouped object fields. Dotted or empty root property names cannot be expressed
as layout paths and produce an explicit generation error.

Generated values match the schema, not necessarily domain semantics (such as a
deployable cron schedule or existing Kubernetes Secret). Defaults and examples
are copied as supplied, so keep real credentials out of specs as well as data.

## Changes and local storage

The Studio keeps one project in this browser's `localStorage`, under
`a-form-studio.project.v1`. The versioned saved copy includes fields, separators,
the imported base specification, data source text and format, unapplied code
drafts, preview values, and up to 100 undo/redo steps. It is restored automatically
when the page is reopened. Theme, viewport, and selection are temporary UI
preferences and are not part of the saved project.

Changes are saved after 300 ms of inactivity, and pending changes are flushed
when the page is hidden or closed. The header shows whether work is saving,
saved locally, or not saved. Undo/redo buttons operate on the whole project;
continuous typing in the code/data editors and field label inspector is grouped
into one step until a 750 ms pause. Array add/remove/reorder operations remain
individual steps. Outside text controls and Monaco, `Ctrl/Cmd+Z` undoes and
`Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redoes. Editors retain their native text shortcuts.

The preview starts from the example data. Valid edits to the data source replace
the preview values; invalid data drafts are retained without changing the last
valid preview values. Editing the preview does not rewrite the example data.
Preview values survive changing views, themes, or reloading the page.

Code drafts are not overwritten when reselecting Code. Leaving Code with an
unapplied draft validates and applies it atomically; invalid drafts stay open
with an error. Field properties remain disabled until the code draft is applied
or undone, so visual edits cannot conflict with pending code. Downloads use the
current draft or the latest generated specification, not a stale editor buffer.

Blocked storage, quota errors, corrupt/unsupported saved data, and changes from
another tab are shown explicitly. A corrupt saved copy is never automatically
replaced. When another tab changes storage, autosave pauses and lets you load
the saved copy (discarding this tab's work) or explicitly replace it with this
tab's project. Recovery actions also allow downloading the saved copy, current
specification, data source, and preview values before making that decision.

**Local storage is not a backup or a secret store.** Data and history are stored
unencrypted on this browser profile and are not uploaded or synced to a server.
Do not enter real credentials or sensitive production values. Clearing site data,
private browsing, browser eviction, or a crash before autosave can remove unsaved
work; keep important specifications and values in downloaded files or version
control. To remove the saved project and its history, close other Studio tabs
and clear this site's storage in the browser settings.

## Build

```bash
npm run build --workspace a-form-playground
```


The production output is written to `apps/playground/dist`. The current GitHub Pages workflow still deploys `apps/playground/dist`.
