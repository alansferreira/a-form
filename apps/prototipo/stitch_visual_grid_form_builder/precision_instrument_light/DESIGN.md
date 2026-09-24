---
name: Precision Instrument Light
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#434656'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#0c48f5'
  primary: '#003bd7'
  on-primary: '#ffffff'
  primary-container: '#2454ff'
  on-primary-container: '#e5e7ff'
  inverse-primary: '#b9c3ff'
  secondary: '#4a3ee6'
  on-secondary: '#ffffff'
  secondary-container: '#645cff'
  on-secondary-container: '#fffbff'
  tertiary: '#005c3f'
  on-tertiary: '#ffffff'
  tertiary-container: '#007753'
  on-tertiary-container: '#84ffc9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001257'
  on-primary-fixed-variant: '#0034c0'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#321ed2'
  tertiary-fixed: '#54febd'
  tertiary-fixed-dim: '#28e1a2'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005138'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system projects clinical precision, hyper-efficiency, and focused energy. Built for engineers, technical product managers, and builders assembling complex schema-driven forms, the interface avoids decorative bloat in favor of instant visual parsing and high-contrast tactile feedback. 

The aesthetic synthesizes modern tool minimalism with vibrant utility accents:
- **Surface Philosophy:** Crisp, clinical off-white canvas with luminous, pure white floating planes.
- **Delineation:** Thin, whisper-soft neutral borders rather than muddy elevation drops.
- **Accents:** High-chroma electric cobalt and energetic indigo for primary vectors; surgical emerald, amber, and cyan signals for schema validation and data taxonomy.
- **Feel:** Feels like a high-end physical workspace or modern IDE (Linear, Raycast) translated to a luminous day mode—engineered, swift, and sharp.

## Colors

The palette balances clean, non-fatiguing neutral light tones with high-saturation functional accents.

### Core Roles
- **Primary (`#2454FF` - Electric Cobalt):** Powers the primary interactive axis—action buttons, active field selections, active drop-zones, and key command triggers.
- **Secondary (`#635BFF` - Hyper Indigo):** Represents logic connections, schema flows, branching pathways, and webhook node states.
- **Tertiary (`#00D598` - Vivid Emerald):** Signals valid syntax, successful API requests, published states, and live test triggers.
- **Warning & Highlight (`#FF7A00` - Signal Amber):** Applied to form dirty states, pending saves, unmapped variables, and breakpoint warnings.
- **Tag & Metadata (`#00B8D9` - Bright Cyan):** Denotes string inputs, primitive type definitions, and variable tokens.

### Surface System
- **App Canvas Base:** `#F8F9FA` (a clinical, low-chroma gray-white preventing optical glare).
- **Surface Card / Inspector Panel:** `#FFFFFF` (pristine white for component cards, form builders, and canvas nodes).
- **Subtle Surface Inset:** `#F1F3F5` (used for code blocks, nested property tables, and input wells).
- **Dividers & Hairlines:** `#E5E7EB` (neutral hairline rules) and `#D1D5DB` (interactive hover rules).
- **Text Hierarchies:**
  - `High Contrast (Headings, Active Values):` `#0B0F19`
  - `Default Body:` `#1F2937`
  - `Muted / Keybindings / Labels:` `#6B7280`
  - `Subtle / Deactivated:` `#9CA3AF`

## Typography

Typography prioritizes rapid scannability and structural alignment. **Plus Jakarta Sans** provides a geometric, razor-sharp presence for all editorial and workspace UI controls, with tightened tracking at display sizes to maintain compact authority. 

**JetBrains Mono** handles all developer metadata: property paths, JSON schemas, short-cuts, type annotations, and validation flags. Monospace weights are balanced to match the x-height of Plus Jakarta Sans for seamless inline mixed compositions (e.g., a label followed by `string` or `v-model`).

## Layout & Spacing

The layout is built around a dense 3-pane IDE topology:
1. **Left Component/Tree Palette:** Fixed width `280px`, collapsible to `48px` icon rail.
2. **Central Form Viewport / Stage:** Fluid viewport centered with a fixed preview canvas (`390px`, `768px`, or `100%`).
3. **Right Properties / Schema Inspector:** Fixed width `320px`, fluid vertical scroll.

### Responsive Behavior
- **Desktop (1280px+):** All 3 panels visible simultaneously. Canvas employs infinite dot-grid matrix with fluid pan/zoom.
- **Tablet (768px - 1279px):** Left navigation shrinks to an overlay drawer; Inspector defaults to a bottom sheet or a tabbed toggle alongside the canvas.
- **Mobile (< 768px):** Single-column stacked mode. The preview renders full-width within the safe viewport margins; panels convert to unified swipeable modals.

## Elevation & Depth

Visual hierarchy does not rely on heavy drop-shadows, ensuring the workspace remains airy and modern. The system utilizes **luminous layering** with crisp, low-opacity borders and ultra-diffused micro-ambience.

- **Level 0 (App Canvas):** Flat tone `#F8F9FA`. Inset dot pattern `#E5E7EB` with 16px repeat interval for the workspace canvas.
- **Level 1 (Docked Panels & Structural Bars):** Pure white `#FFFFFF` surface with a right or bottom 1px stroke of `#E5E7EB`. Zero shadow.
- **Level 2 (Cards & Form Canvas Blocks):** `#FFFFFF` background, a 1px perimeter border `#E5E7EB`, and a feathered micro-shadow: `0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)`.
- **Level 3 (Hovering Nodes & Floating Toolbars):** `#FFFFFF` surface, 1px perimeter border of `#D1D5DB`, plus a crisp floating shadow: `0 8px 24px -4px rgba(11, 15, 25, 0.08), 0 2px 6px -1px rgba(11, 15, 25, 0.04)`.
- **Level 4 (Command Palette & Global Modals):** Translucent backdrop blur (`backdrop-filter: blur(12px)` over `rgba(248, 249, 250, 0.8)`), central modal clad in `#FFFFFF` with 1px border `#D1D5DB`, and high-impact dispersion shadow: `0 24px 48px -12px rgba(11, 15, 25, 0.16)`.
- **Focus Rings & Drag Overlays:** Crisp offset focus ring using `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #2454FF`.

## Shapes

The design uses tight, controlled curvature (`roundedness: 1` / Soft). This keeps data rows, form components, and complex node configurations feeling structural and disciplined, avoiding the toy-like feel of heavy bubble-radius designs while steering clear of abrasive sharp rectangles.

- **Micro Controls & Inputs (`0.25rem` / 4px):** Checkboxes, tags, dropdown triggers, mono schema pills.
- **Component Blocks & Panels (`0.5rem` / 8px):** Form question cards, modal popups, inspector sections, toast notices.
- **Containers & Canvas Outer Bounds (`0.75rem` / 12px):** Workspace preview frame, code export card, command prompt container.

## Components

### Buttons
- **Primary:** High-chroma `#2454FF` background, `#FFFFFF` text, subtle inner-top highlight `inset 0 1px 0 rgba(255, 255, 255, 0.2)`. On hover: `#1B45DB`. Active: scale 0.98.
- **Secondary:** `#FFFFFF` background, `#1F2937` text, 1px `#E5E7EB` border. On hover: `#F8F9FA` background, `#D1D5DB` border.
- **Ghost / Tool Item:** Transparent fill, `#6B7280` text. On hover: `#F1F3F5` background, `#0B0F19` text.
- **Command / Shortcut Integration:** Monospace shortcut badges (e.g., `⌘K`) placed inside buttons have `#F1F3F5` fill, `#6B7280` text, and a 2px radius.

### Input Fields & Schema Selectors
- **Default State:** Pristine white background, 1px `#E5E7EB` border, `13px` typography, `8px 12px` padding.
- **Focus State:** 1px `#2454FF` border accompanied by the high-contrast dual ring: `0 0 0 1px #2454FF`.
- **Error / Invalid State:** 1px `#EF4444` border, soft red wash `rgba(239, 68, 68, 0.04)`.
- **Monospace Code Input:** `#F8F9FA` background, `#0B0F19` JetBrains Mono text, left border indicator strip (2px primary).

### Badges & Chips
- **Type Tags (String, Number, Boolean):** Height `20px`, padding `0 6px`, `label-mono` size. Subtle cyan tint `rgba(0, 184, 217, 0.1)` with `#007B99` text.
- **Status Pills:** Live (`rgba(0, 213, 152, 0.1)` with `#008760` text + solid pulsing dot), Draft (`#F1F3F5` background with `#6B7280` text).

### Checkboxes, Toggles & Radios
- **Checkboxes:** 16x16px, `0.25rem` radius. Unchecked: `#FFFFFF` with 1.5px `#D1D5DB` border. Checked: `#2454FF` fill with pure white tick icon.
- **Switch Toggles:** 36x20px capsule track. Unchecked: `#E5E7EB`. Checked: `#2454FF`. 16px pure white disc with `0 1px 2px rgba(0,0,0,0.15)` shadow.

### Cards & Form Question Nodes
- **Form Canvas Item (Resting):** `#FFFFFF` fill, 1px `#E5E7EB` border, `0.5rem` radius, `space-lg` inner padding. 
- **Form Canvas Item (Selected):** 1px `#2454FF` border with an elevated shadow and a floating indicator handle on the left edge (`#2454FF`).
- **Drag Target State:** Dashed 2px `#635BFF` outline over a very faint tinted surface `rgba(99, 91, 255, 0.02)`.

### Specialized Developer Tooling Components
- **Tree Node Row:** Minimalist collapsible item displaying drag handles on hover, item type icon, title, and inline mono validation pill.
- **Logic Connector Line:** 1.5px stroke with `#635BFF` representing conditionals (`IF`, `THEN`), paired with geometric diamond step indicators.
- **Live Output Drawer:** Collapsible bottom panel with tabbed JSON schema validation and curl request preview.