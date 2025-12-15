# Semantic Design Tokens Guide

## Overview

Semantic design tokens are named CSS variables that represent the **purpose** of a color or value rather than its **appearance**. This approach enables consistent theming, dark mode support, and easier design system maintenance.

## Philosophy

### Semantic vs. Literal Naming

**Literal** (❌ Avoid):

```css
--blue-500: 59 130 246;
--red-600: 220 38 38;
--gray-100: 244 244 245;
```

Usage: `bg-blue-500`, `text-red-600`

**Semantic** (✅ Prefer):

```css
--color-primary: 59 130 246;
--color-destructive: 220 38 38;
--color-muted: 244 244 245;
```

Usage: `bg-primary`, `text-destructive`, `bg-muted`

### Benefits

1. **Theme switching**: Change `--color-primary` once, affects all primary elements
2. **Dark mode**: Same semantic name, different color value
3. **Intent clarity**: `bg-destructive` is clearer than `bg-red-600`
4. **Design consistency**: Forces unified approach across components
5. **Refactoring safety**: Rename visual appearance without changing meaning

## shadcn/ui Token Pattern

The shadcn/ui design system provides a comprehensive semantic token structure used by many modern React applications.

### Core Token Categories

#### 1. Base Colors

```css
@theme {
  /* Page background and primary text */
  --color-background: 0 0% 100%; /* White in light mode */
  --color-foreground: 222 47% 11%; /* Near-black text */
}
```

**Usage**:

- `bg-background`: Page/container backgrounds
- `text-foreground`: Primary text content

**When to use**:

- Root-level backgrounds
- Main content text
- Default text color

#### 2. Interactive Elements (Buttons, Links)

```css
@theme {
  /* Primary action (main CTAs, links) */
  --color-primary: 217 91% 60%;
  --color-primary-foreground: 210 40% 98%;

  /* Secondary action (less prominent buttons) */
  --color-secondary: 210 40% 96%;
  --color-secondary-foreground: 222 47% 11%;

  /* Destructive action (delete, remove, cancel) */
  --color-destructive: 0 84% 60%;
  --color-destructive-foreground: 210 40% 98%;
}
```

**Usage**:

```tsx
// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save Changes
</button>

// Secondary button
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
  Cancel
</button>

// Destructive action
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
  Delete Account
</button>
```

**When to use**:

- **Primary**: Main actions, important CTAs, active links
- **Secondary**: Supporting actions, less critical buttons, alternative paths
- **Destructive**: Delete, remove, irreversible actions, critical warnings

#### 3. UI Element Colors

```css
@theme {
  /* Muted/subdued elements */
  --color-muted: 210 40% 96%;
  --color-muted-foreground: 215 16% 47%;

  /* Accent highlights */
  --color-accent: 210 40% 96%;
  --color-accent-foreground: 222 47% 11%;

  /* Card containers */
  --color-card: 0 0% 100%;
  --color-card-foreground: 222 47% 11%;
}
```

**Usage**:

- `bg-muted`: Subtle backgrounds, disabled states, secondary info
- `text-muted-foreground`: Secondary text, metadata, timestamps
- `bg-accent`: Hover states, selected items, subtle highlights
- `bg-card`: Card components, elevated surfaces

**When to use**:

- **Muted**: Less important information, secondary UI elements, placeholders
- **Accent**: Hover effects, selection states, subtle emphasis
- **Card**: Content cards, panels, modal backgrounds

#### 4. Borders and Inputs

```css
@theme {
  /* Default borders */
  --color-border: 214 32% 91%;

  /* Input field borders */
  --color-input: 214 32% 91%;

  /* Focus rings */
  --color-ring: 217 91% 60%;
}
```

**Usage**:

```tsx
<input className="border-input focus:ring-ring" />
<div className="border border-border rounded-lg" />
```

**When to use**:

- **border**: Dividers, card outlines, section separators
- **input**: Form field borders, text inputs, selects
- **ring**: Focus indicators (accessibility)

### Extended Tokens (Common Additions)

#### 5. Status/Feedback Colors

Not included in base shadcn/ui but commonly added:

```css
@theme {
  /* Success states */
  --color-success: 142 71% 45%;
  --color-success-foreground: 144 61% 20%;

  /* Warning states */
  --color-warning: 38 92% 50%;
  --color-warning-foreground: 48 96% 89%;

  /* Info states */
  --color-info: 217 91% 60%;
  --color-info-foreground: 222 47% 11%;

  /* Error states (alternative to destructive) */
  --color-error: 0 84% 60%;
  --color-error-foreground: 210 40% 98%;
}
```

**Usage**:

```tsx
// Success message
<div className="bg-success/10 text-success border-success/20">
  ✓ Changes saved successfully
</div>

// Warning alert
<div className="bg-warning/10 text-warning border-warning/20">
  ⚠ Your session will expire soon
</div>

// Info notification
<div className="bg-info/10 text-info border-info/20">
  ℹ New features available
</div>

// Error message
<div className="bg-error/10 text-error border-error/20">
  ✗ Failed to save changes
</div>
```

**When to use**:

- **Success**: Confirmation messages, completed actions, positive feedback
- **Warning**: Cautionary messages, reversible issues, attention needed
- **Info**: Neutral information, tips, announcements
- **Error**: Error messages, failed operations, validation errors

#### 6. Component-Specific Tokens

For complex components like sidebars, charts, or specialized UI:

```css
@theme {
  /* Sidebar (if different from main UI) */
  --color-sidebar-background: 0 0% 98%;
  --color-sidebar-foreground: 240 5% 26%;
  --color-sidebar-primary: 240 6% 10%;
  --color-sidebar-primary-foreground: 0 0% 98%;
  --color-sidebar-accent: 240 5% 96%;
  --color-sidebar-border: 220 13% 91%;

  /* Chart colors */
  --color-chart-1: 12 76% 61%;
  --color-chart-2: 173 58% 39%;
  --color-chart-3: 197 37% 24%;
  --color-chart-4: 43 74% 66%;
  --color-chart-5: 27 87% 67%;
}
```

## Dark Mode Implementation

Each token requires a dark mode equivalent:

```css
@custom-variant dark (&:is(.dark *));

.dark {
  @theme {
    --color-background: 222 47% 11%; /* Dark gray */
    --color-foreground: 210 40% 98%; /* Off-white */

    --color-primary: 217 91% 60%; /* Lighter shade */
    --color-primary-foreground: 222 47% 11%; /* Dark text */

    --color-muted: 217 33% 17%;
    --color-muted-foreground: 215 20% 65%;

    --color-border: 217 33% 17%;
    --color-input: 217 33% 17%;

    /* Status colors adjusted for dark backgrounds */
    --color-success: 142 71% 55%; /* Slightly lighter */
    --color-warning: 38 92% 60%;
    --color-info: 217 91% 70%;
    --color-error: 0 84% 70%;
  }
}
```

**Dark mode principles**:

1. **Increase lightness** for colors on dark backgrounds
2. **Maintain contrast ratios** for accessibility (4.5:1 minimum)
3. **Reduce saturation** slightly to prevent eye strain
4. **Invert foreground pairs**: Light backgrounds get dark text, vice versa

## Token Naming Conventions

### Foreground Pairing

Every background token should have a foreground pair:

```css
--color-primary              /* Background */
--color-primary-foreground   /* Text on that background */

--color-muted
--color-muted-foreground

--color-success
--color-success-foreground
```

**Why**: Ensures text is always readable on its background in all themes.

### Token Hierarchy

```
--color-{category}
--color-{category}-foreground
--color-{category}-{modifier}
```

Examples:

- `--color-primary`
- `--color-primary-foreground`
- `--color-sidebar-primary`
- `--color-sidebar-primary-foreground`

### Avoid These Naming Patterns

❌ **Color + Shade**:

```css
--color-blue-500
--color-gray-200
```

❌ **Visual Description**:

```css
--color-light-gray
--color-dark-blue
```

❌ **Ambiguous Purpose**:

```css
--color-button
--color-text
```

✅ **Clear Semantic Intent**:

```css
--color-primary
--color-muted-foreground
--color-destructive
```

## Mapping Hardcoded Colors to Tokens

### Common Migrations

#### Blue Utilities

**Context matters!**

```tsx
// Interactive element (button, link)
❌ className="bg-blue-500 hover:bg-blue-600"
✅ className="bg-primary hover:bg-primary/90"

// Status indicator (info message)
❌ className="text-blue-600"
✅ className="text-info"

// Icon in primary context
❌ className="text-blue-500"
✅ className="text-primary"
```

#### Red Utilities

```tsx
// Destructive button
❌ className="bg-red-600 hover:bg-red-700"
✅ className="bg-destructive hover:bg-destructive/90"

// Error message
❌ className="text-red-600"
✅ className="text-error" or "text-destructive"

// Error icon
❌ className="text-red-500"
✅ className="text-error"
```

#### Green Utilities

```tsx
// Success message
❌ className="bg-green-100 text-green-800"
✅ className="bg-success/10 text-success"

// Success icon
❌ className="text-green-600"
✅ className="text-success"
```

#### Gray Utilities

**Most complex - depends heavily on context!**

```tsx
// Primary text
❌ className="text-gray-900"
✅ className="text-foreground"

// Secondary text (labels, metadata)
❌ className="text-gray-600"
✅ className="text-muted-foreground"

// Disabled text
❌ className="text-gray-400"
✅ className="text-muted-foreground/50"

// Light background
❌ className="bg-gray-100"
✅ className="bg-muted" or "bg-secondary"

// Lighter background
❌ className="bg-gray-50"
✅ className="bg-background" or "bg-card"

// Borders
❌ className="border-gray-300"
✅ className="border-border"

// Input borders
❌ className="border-gray-200"
✅ className="border-input"
```

#### Amber/Orange/Yellow Utilities

```tsx
// Warning message
❌ className="text-amber-600 bg-yellow-100"
✅ className="text-warning bg-warning/10"

// Alert icon
❌ className="text-orange-600"
✅ className="text-warning"
```

### Opacity Modifiers

Use `/value` syntax for transparency:

```tsx
// Subtle backgrounds
bg - primary / 10 /* 10% opacity */
bg - success / 20 /* 20% opacity */
bg - muted / 50 /* 50% opacity */

// Subdued text
text - foreground / 60
text - muted - foreground / 70

// Hover states
hover: bg - primary / 90
hover: bg - accent / 80
```

## Context-Dependent Mapping

Same color, different contexts need different tokens:

### Example: Blue

```tsx
// Context 1: Primary action
<button className="bg-primary">Submit</button>

// Context 2: Info status
<div className="text-info">Account verified</div>

// Context 3: Link
<a className="text-primary hover:text-primary/80">Learn more</a>

// Context 4: Chart data
<div className="bg-chart-1">Dataset 1</div>
```

### Example: Red

```tsx
// Context 1: Delete button
<button className="bg-destructive">Delete</button>

// Context 2: Error message
<span className="text-error">Invalid input</span>

// Context 3: Badge
<span className="bg-destructive/10 text-destructive">Critical</span>
```

## Creating New Tokens

When hardcoded colors reveal a missing semantic token:

1. **Identify the pattern**: Why is this color used?
2. **Name semantically**: What is its purpose?
3. **Define foreground pair**: Ensure contrast
4. **Add dark mode variant**: Test readability
5. **Document usage**: Add comment explaining intent

Example:

```css
@theme {
  /* Used for in-progress status indicators and loading states */
  --color-pending: 217 70% 55%;
  --color-pending-foreground: 210 40% 98%;
}

.dark {
  @theme {
    --color-pending: 217 70% 65%;
    --color-pending-foreground: 222 47% 11%;
  }
}
```

## Testing Token Coverage

Questions to ask:

1. **Can I delete all hardcoded colors?** If no, you're missing tokens
2. **Does every background have a foreground?** Ensures text contrast
3. **Do tokens work in dark mode?** Test visual appearance
4. **Are names clear to others?** Team should understand intent
5. **Can I change the theme easily?** Swap primary color and check propagation

## Anti-Patterns

### Too Many Specific Tokens

❌ **Over-specific**:

```css
--color-login-button
--color-signup-button
--color-submit-button
--color-cancel-button
```

✅ **Semantic categories**:

```css
--color-primary
--color-secondary
--color-destructive
```

### Using Both Systems

❌ **Mixing approaches**:

```tsx
<button className="bg-primary">Submit</button>
<button className="bg-blue-500">Cancel</button>
```

✅ **Consistent tokens**:

```tsx
<button className="bg-primary">Submit</button>
<button className="bg-secondary">Cancel</button>
```

### Token Sprawl

Limit to ~15-20 core tokens. More than that suggests over-engineering.

**Core set**:

- background, foreground
- primary, secondary, destructive
- muted, accent, card
- border, input, ring
- success, warning, info, error

**Extended** (if needed):

- Component-specific tokens (sidebar, chart, etc.)
- Brand-specific tokens (for multi-brand apps)

## Resources

- shadcn/ui Theming: https://ui.shadcn.com/docs/theming
- Radix Colors: https://www.radix-ui.com/colors
- Material Design Tokens: https://m3.material.io/foundations/design-tokens
- Tailwind CSS Variables: https://tailwindcss.com/docs/customizing-colors#using-css-variables
