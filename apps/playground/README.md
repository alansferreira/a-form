# AForm Studio

Second-generation visual playground based on the Kinetic Schema prototype.

## Features

- Three-panel schema, canvas, and property inspector workspace
- Drag-and-drop and touch-friendly field placement on a 12-column grid
- Editable AForm YAML with apply and download actions
- Live mobile, tablet, and desktop preview using `a-form-react`
- JSON or YAML data import with replace and merge modes
- Self-contained production build for static hosting

## Development

```bash
npm run dev --workspace a-form-playground
```

The preview includes runtime selectors for Material, Bootstrap, Tailwind and
Neobrutalism. The selected presentation is preview state only and is not added
to the exported AForm specification.

## Build

```bash
npm run build --workspace a-form-playground
```


## Publish

```bash
npm login 
npm run version:bump
npm run build

npm pack --workspaces
npm publish --workspaces
```

The production output is written to `apps/playground/dist`. The current GitHub Pages workflow still deploys `apps/playground/dist`.
