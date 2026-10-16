# AForm Studio

Second-generation visual playground based on the Kinetic Schema prototype.

## Features

- Three-panel schema, canvas, and property inspector workspace
- Drag-and-drop and touch-friendly field placement on a 12-column grid
- Editable AForm YAML with apply and download actions
- Live auto, mobile, tablet, and desktop preview using `a-form-react`
- Adapter-aware bold emphasis for edited fields in normal and inline forms
- JSON or YAML data import with replace and merge modes
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

## Build

```bash
npm run build --workspace a-form-playground
```


The production output is written to `apps/playground/dist`. The current GitHub Pages workflow still deploys `apps/playground/dist`.
