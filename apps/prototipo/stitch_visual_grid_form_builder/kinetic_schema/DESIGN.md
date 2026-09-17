---
name: Kinetic Schema
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.375rem
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 1rem
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is engineered for dense, technical UI orchestration tools—specifically visual form builders that map high-level canvas layouts directly to structured schemas (YAML/JSON). 

### Personality & Emotional Response
- **Surgical Precision:** The interface conveys absolute deterministic control. Every drag handle, slot target, and syntax node aligns to an unwavering rhythmic cadence.
- **Cognitive Clarity:** Dense structural trees and property inspectors remain legible under sustained deep work without causing eye strain.
- **Architectural Utility:** Balances modern high-end software craftsmanship with developer-tool pragmatism. Interactions feel snappy, tactile, and mathematically grounded.

### Design Direction
A refined synthesis of **Technical Minimalism** and **Instrumental Flat Design**:
- Surfaces rely on subtle slate boundaries (`1px` borders) rather than heavy drop shadows.
- Visual feedback utilizes electric cyan and emerald accents to signal operational readiness, valid drop zones, and dynamic data bindings without overwhelming standard editing flows.
- Visual density is optimized for high-resolution displays, offering tight baseline grids, explicit slot demarcations, and razor-sharp typographic hierarchy.

## Colors

The system uses a technical dark canvas foundation designed for prolonged layout design sessions, accented by vivid programmatic signals.

### Palette Architecture
- **Primary (`#6366F1` - Tech Indigo):** The core control color. Applied to active tool selections, primary schema validation actions, field selection outlines, and focused component wrappers.
- **Secondary (`#06B6D4` - Cyan Data Binding):** Reserved for live data linkages, active virtual dropzone crosshairs, JSONPath interpolation pills, and target slot projections.
- **Tertiary (`#10B981` - Emerald Syntax Status):** Indicates validated schema state, live preview sync, active drag inserts, and truthy conditional logic branches.
- **Neutral (`#0F172A` - Slate):** A cold slate gamut spanning from `#020617` (canvas backdrop) up to `#F8FAFC` (primary text), providing a neutral, non-distracting bedrock for multi-panel workstation screens.

### Functional Roles
- **Dropzone Active State:** Surface `rgba(6, 182, 212, 0.08)`, border `dashed 1.5px #06B6D4`.
- **Canvas Slot Grid:** Matrix dots/lines styled with `#1E293B` against base `#020617`.
- **Syntax Tokens:** Monospaced elements utilize contextual syntax highlights: keys in `#94A3B8`, values in `#38BDF8`, and expressions/JSONPath in `#A78BFA`.
- **Error / Invalidation:** `#F43F5E` reserved exclusively for broken field bindings, schema syntax errors, or unresolvable slot collisions.

## Typography

The typographic system utilizes a strict bi-font pairing: **Plus Jakarta Sans** for structural UI controls and **JetBrains Mono** for all machine-readable values, variables, and serialized code structures.

### Hierarchy & Role Distribution
- **Plus Jakarta Sans:** Drives toolbars, inspector tabs, section headers, field display labels, modal titles, and configuration panels. Its geometric build maintains legibility at micro-scales (`0.6875rem`).
- **JetBrains Mono:** Dedicated exclusively to technical payloads. This covers YAML syntax trees, JSONPath expressions (`$.user.profile.addresses[0]`), property keys in data-binding pickers, slot indices (`slot: [4, 12]`), and regex validation formulas.

### Compact Density Rules
- Code tokens across inspectors and canvas pills enforce tabular numbers (`tnum`) to maintain vertical alignment across multi-line schema readouts.
- All uppercase section headers employ `label-sm` with `letter-spacing: 0.04em` to delineate inspector panels cleanly without excessive border usage.

## Layout & Spacing

The viewport implements a dedicated **3-Panel Dock Architecture** designed for zero-scroll core workflows.

### Global Viewport Architecture
1. **Left Utility Panel (280px fixed):** Component Library tree, Schema Explorer (YAML/JSON tree), and Data Source nodes.
2. **Central Canvas (Fluid):** Infinite or bounded virtual grid viewport with fixed pan/zoom controls and floating action toolbars.
3. **Right Inspector Panel (320px fixed):** Deep property editor, JSONPath expression binder, validation rule engine, and slot layout properties.

### Virtual Canvas Grid
- The layout canvas uses an **isometric 12-column or 24-column virtual slot matrix**.
- Visual slots render a minimum target height of `48px`.
- Column gutter within the preview form layout conforms to `0.75rem` (`12px`), maintaining real-world form spatial relations.
- Component-level inner padding utilizes `space-sm` (`0.5rem`) for compact inputs and `space-md` (`0.75rem`) for standard cards.

### Responsive Breakpoints
- **Desktop (>= 1440px):** Full 3-panel persistent layout with side-by-side canvas and live-compiled YAML preview split.
- **Laptop (1024px - 1439px):** Inspector and Component Palette remain persistent; canvas scales dynamically.
- **Tablet / Small Screen (< 1024px):** Panels convert to slide-over drawers. Canvas transitions to single-column slot manipulation mode with visual alerts that complex drag-and-drop is optimized for pointer precision.

## Elevation & Depth

This system avoids soft, organic blurs in favor of **structural, technical layering** using calibrated slate luminosity tiers and high-contrast bounding strokes.

### Elevation Hierarchy
- **Base Level (Canvas Plane - `#020617`):** Recessed ground plane showing faint slot guides (`border: 1px dashed #1E293B`).
- **Surface Level 1 (Panels & Shell - `#0F172A`):** The fixed docking panels and structural sidebars. Separated from the canvas with `border-right: 1px solid #1E293B` and `border-left: 1px solid #1E293B`.
- **Surface Level 2 (Placed Canvas Cards - `#1E293B`):** Form controls and interactive drop cards seated within slots. Outline: `1px solid #334155`.
- **Surface Level 3 (Floating Controls & Popovers - `#1E293B`):** Dropdown palettes, JSONPath auto-complete suggestions, and action menus. Elevated using `0 8px 24px -4px rgba(0, 0, 0, 0.45)` with `border: 1px solid #475569`.
- **Overlay Level 4 (Active Drag Ghost):** The active floating item carried by cursor during drag operations. Rendered at `opacity: 0.95`, elevated via `0 20px 32px -8px rgba(0, 0, 0, 0.65)`, scaled to `1.02`, and bound by an active Indigo ring (`0 0 0 2px #6366F1`).

### Drop Target Highlighting
- **Inactive Slot:** No shadow, border `1px dashed #1E293B`.
- **Targeted Valid Slot:** Interior illumination via inset tint `inset 0 0 0 1px #06B6D4`, background `rgba(6, 182, 212, 0.05)`.
- **Colliding / Invalid Slot:** Inset tint `inset 0 0 0 1px #F43F5E`, background `rgba(244, 63, 94, 0.05)`.

## Shapes

The interface implements **Soft Geometric (`0.25rem` / `4px`)** styling throughout all interactive and structural components.

### Implementation Rules
- **Base Components (`rounded` / `0.25rem`):** Buttons, inputs, drop-down list items, code chips, tab pills, and slot bounding cells.
- **Card Containers (`rounded-lg` / `0.5rem`):** Canvas component wrappers, modal panels, context sheets, and nested group fieldsets.
- **Pills / Status Dots (`9999px`):** Reserved strictly for schema execution badges (e.g., `dirty`, `valid`, `draft`), slot index counters, and connector endpoints on logical wires.
- **Slot Connectors:** Anchor points for conditional logic connections are styled as micro-squares (`8px x 8px`) rotated 45 degrees, offering precise snapping crosshairs.

## Components

### Buttons
- **Primary:** Background `#6366F1`, text `#FFFFFF`, hover `#4F46E5`. Compact height (`32px`), font `label-md`.
- **Ghost / Tool:** Transparent background, text `#94A3B8`, border `1px solid transparent`. On hover: border `#334155`, text `#F8FAFC`, background `#1E293B`.
- **Ghost Action (Data Binding):** Border `1px dashed #06B6D4`, text `#06B6D4`, background `rgba(6, 182, 212, 0.05)`.

### Interactive Form Fields (Canvas Instances)
- **Text Field:** Background `#090D16`, border `1px solid #334155`, text `#F8FAFC`. Placeholder `#475569`. Focused: border `#6366F1`, ring `1px #6366F1`. Includes absolute top-right slot tag displaying its bound JSON key (`JetBrains Mono`).
- **Checkbox & Radio:** Box border `1.5px solid #475569`, background `#0F172A`. Checked state triggers `#6366F1` with an inner white glyph/dot.
- **Dropdown / Select:** Styled identical to text inputs with a chevron icon indicator in `#64748B`. Menu options deploy on Level 3 surface with keyboard traversal highlights (`#334155`).

### Drag-and-Drop Slot Grid
- **Virtual Grid Slot:** Renders explicit spatial boundaries with subtle cross-marks at intersections.
- **Drag Target Indicator:** A horizontal/vertical beam highlighted in `#06B6D4` with `2px` thickness and circular anchor terminators displaying target insertion index (`[row, col]`).
- **Draggable Item Handle:** An off-center grab matrix (`6 dots`) appearing in `#475569`, transitioning to `#6366F1` on hover. Cursor shifts dynamically between `grab` and `grabbing`.

### JSONPath / YAML Chips & Pills
- **Expression Pill:** Encapsulated within `JetBrains Mono` at `code-sm`. Background `rgba(99, 102, 241, 0.1)`, text `#A5B4FC`, border `1px solid rgba(99, 102, 241, 0.3)`. Displays leading `$` glyph. Clicking opens the variable explorer popover.
- **Status Indicator:** Dual-state pill. Validated: `#10B981` text/border on `rgba(16, 185, 129, 0.1)`. Unbound/Error: `#F43F5E` text/border on `rgba(244, 63, 94, 0.1)`.

### Canvas Component Wrapper (Selected State)
- When a form field is selected on the canvas, it is wrapped in an active operational boundary: outline `1px solid #6366F1`, with corner transform handles (`6px x 6px` solid `#6366F1` blocks) enabling slot spanning across the virtual grid.
- A floating mini-action pill appears centered directly above the component housing fast-actions: Duplicate, Quick-Bind, Wrap in Group, and Remove.