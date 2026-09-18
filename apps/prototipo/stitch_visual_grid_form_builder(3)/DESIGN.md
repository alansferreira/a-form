---
name: Kinetic Neo-Brutalist Studio
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0edec'
  surface-container-high: '#ebe7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#4b4731'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#7c775f'
  outline-variant: '#cdc7aa'
  surface-tint: '#6a5f00'
  primary: '#6a5f00'
  on-primary: '#ffffff'
  primary-container: '#ffe600'
  on-primary-container: '#726600'
  inverse-primary: '#dec800'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#b71945'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffdcdf'
  on-tertiary-container: '#c2234c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#fde400'
  primary-fixed-dim: '#dec800'
  on-primary-fixed: '#201c00'
  on-primary-fixed-variant: '#504700'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffd9dc'
  tertiary-fixed-dim: '#ffb2ba'
  on-tertiary-fixed: '#400011'
  on-tertiary-fixed-variant: '#910031'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 4rem
    fontWeight: '700'
    lineHeight: 4.25rem
    letterSpacing: -0.04em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 2.5rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 2.5rem
    fontWeight: '700'
    lineHeight: 2.85rem
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 1.875rem
    fontWeight: '700'
    lineHeight: 2.15rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.1rem
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.6rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.35rem
    letterSpacing: 0em
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: '700'
    lineHeight: 1.15rem
    letterSpacing: 0.05em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 0.75rem
    fontWeight: '700'
    lineHeight: 1rem
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-voltage, raw, and mechanically tactile aesthetic tailored for modern developer tooling and creative engineering studios. Rooted in Neobrutalism, the visual tone departs from sterile corporate SaaS by emphasizing deliberate architectural weight, raw geometric honesty, and playful precision.

- **Brand Personality**: Audacious, unapologetically technical, razor-sharp, and kinetic. It evokes the tactile satisfaction of vintage industrial machinery, physical punchcards, and mechanical click switches, married to contemporary developer workflows.
- **Target Audience**: Software engineers, technical founders, creative technologists, and UI architecture teams seeking a distinctive, expressive visual environment without compromising density or usability.
- **Design Style**: Neobrutalism characterized by stark ink-black contours, zero-blur directional offset drop shadows, an earthy off-white canvas, and saturated primary pigments. Structure is intentionally visible; interactive affordances mimic physical spring-loaded hardware buttons that depress flat into the canvas on interaction.

## Colors

The palette leverages pure saturation contrasted against an organic paper surface and stark solid black ink lines.

- **Primary (`#FFE600`)**: Industrial Caution Yellow. Applied to high-priority calls-to-action, primary focus badges, and accent hero headers.
- **Secondary (`#3B82F6`)**: Electric Blueprint Blue. Reserved for code environments, links, interactive highlights, and secondary controls.
- **Tertiary (`#FF5376`)**: Vivid Coral/Pink. Applied to destructive states, critical attention flags, live compilation alerts, and contrasting visual tags.
- **Accent Extended**: 
  - Emerald Terminal: `#22C55E` for valid compilation, deployment success, and toggle activation.
  - Saturated Orchid: `#A855F7` for studio tool badges, experimental flags, and secondary metrics.
- **Neutral Canvas & Surfaces**:
  - Base Studio Canvas: `#FBF8F2` (warm ivory/cream paper base).
  - Elevated Container Cards: `#FFFFFF` (pure stark white).
  - Outlines, Shadows, and Primary Typography: `#000000` (deepest pitch black).
  - Inactive / Subtle Fill: `#EFE9DC` for recessed panels, column gutters, or inactive controls.

## Typography

Typography pairs the structural, geometric presence of `Space Grotesk` with the high-legibility, humanist geometry of `Plus Jakarta Sans`.

- **Headlines & Section Anchors**: Set in `Space Grotesk` (weights 600 and 700). Tightly tracked (`-0.02em` to `-0.04em`) to establish high graphic density and punchy, editorial weight.
- **Body & Longform Copy**: Set in `Plus Jakarta Sans` (weights 400 and 500) to balance brutalist display elements with effortless reading mechanics.
- **Labels, Badges, and Metadata**: Set in uppercase `Space Grotesk` with wide letter-spacing (`0.05em` to `0.08em`) to echo punched-tape readouts, circuit boards, and industrial spec plates.

## Layout & Spacing

The layout model relies on a strict geometric grid reminiscent of architectural blueprints.

- **Grid Architecture**: 12-column layout on desktop (`1024px+`) with `1.5rem` gutters and `2.5rem` exterior margins. Collapses to 6 columns on tablet (`768px-1023px`) and 2 or 4 columns on mobile (`<768px`) with `1rem` gutters and margins.
- **Horizontal & Vertical Rhythm**: Spacing is calculated on an absolute 8px module (with half-step 4px micro-tokens). Layout blocks must be divided by visible 2px or 3px solid black containment borders rather than arbitrary white space alone.
- **Reflow Rules**: Cards and tool panels maintain equal-height structures within rows. Elements should not float disconnected from their grid bounds; every major section is bound by a structural frame.

## Elevation & Depth

This design system rejects ambient blurred shadows, soft gradients, and atmospheric lighting. Elevation is strictly physical, mechanical, and binary.

- **Hard Directional Offset Shadows**:
  - **Standard Card / Container**: `box-shadow: 4px 4px 0px #000000`.
  - **Interactive Button / Interactive Tag**: `box-shadow: 3px 3px 0px #000000`.
  - **Floating Modal / Docked Utility**: `box-shadow: 8px 8px 0px #000000`.
- **Mechanical Depress State**:
  - Interactive elements shift down and to the right on `:hover` (`translate(1px, 1px)`, `box-shadow: 2px 2px 0px #000000`) and fully collapse on `:active` (`translate(3px, 3px)`, `box-shadow: 0px 0px 0px #000000`). This simulates pressing a physical keycap or mechanical switch.
- **Linework Contrast**: Every elevated layer is encased in a solid `2px` or `3px` solid `#000000` stroke. Zero blur is permitted across all components.

## Shapes

The shape vocabulary emphasizes micro-rounded sharpness (`roundedness: 1`). Elements are fundamentally rectangular, softened only by micro-radii (4px base) to evoke punchy die-cut card stock, physical sheet metal enclosures, and molded polymer keys.

- Base elements (buttons, inputs, cards): `border-radius: 4px`.
- Large containers and visual panels: `border-radius: 6px` maximum.
- Pills and circular shapes are restricted strictly to status indicator dots, circular icon tags, or status pips. Never use pill-shaped input fields or buttons.

## Components

### Buttons
- **Primary**: Background `#FFE600`, text `#000000`, 2px solid `#000000` border, `3px 3px 0px #000000` hard shadow. Font: `Space Grotesk` bold.
- **Secondary**: Background `#FFFFFF`, text `#000000`, 2px solid `#000000` border, `3px 3px 0px #000000` shadow.
- **Accent / Destructive**: Background `#FF5376` (danger) or `#3B82F6` (developer action), text `#FFFFFF` or `#000000`, 2px black border, 3px hard drop shadow.
- **Kinetic States**: On `:hover`, translate `+1px, +1px` with shadow reduced to `2px 2px 0px #000`. On `:active`, translate `+3px, +3px` with shadow reduced to `0px 0px 0px #000`.

### Cards & Panels
- **Base Card**: Crisp `#FFFFFF` surface with a `2px` or `3px` solid black stroke, `4px 4px 0px #000000` shadow, and `1.5rem` internal padding.
- **Header Bar Card**: Cards may feature a designated solid-accent title bar (e.g., `#FFE600` or `#3B82F6`) separated from the white body by a 2px black rule, referencing classical terminal windows.

### Form Inputs & Textareas
- **Surface**: Pure `#FFFFFF` background, `2px` solid `#000000` border, `3px 3px 0px #000000` shadow at rest.
- **Focus**: Hard outline remains `2px` black, shadow expands to `5px 5px 0px #000000`, or changes shadow color to `#3B82F6`.
- **Placeholder**: Crisp `#71717A` with a mono feel.

### Checkboxes & Radios
- **Checkboxes**: 20x20px square with 2px black border and `2px 2px 0px #000000` shadow. Checked state fills with `#22C55E` or `#FFE600` featuring a heavy 3px black checkmark vector.
- **Radio Buttons**: Rigid circular frame with 2px black border. Checked state displays a solid black inner circle surrounded by high-contrast primary yellow.

### Chips & Technical Badges
- **Style**: Uppercase, tracked out labels (`Space Grotesk` bold), 2px solid black border, no shadow or micro `2px 2px 0px #000` shadow.
- **Variants**:
  - Alpha / Testing: Fill `#A855F7` with white text.
  - Success / Live: Fill `#22C55E` with black text.
  - Warning / Deprecated: Fill `#FFE600` with black text.
  - Error / Breaking: Fill `#FF5376` with white text.

### Code Blocks & Console Drawers
- **Terminal Panes**: Background `#121212`, text `#FBF8F2`, encased in 3px black border with a top utility bar containing tactile minimize/close square buttons and monochrome status telemetry.