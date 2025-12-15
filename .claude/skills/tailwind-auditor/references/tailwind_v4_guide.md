# Tailwind CSS v4 Configuration Guide

## Overview

Tailwind CSS v4 represents a fundamental shift in how the framework is configured. Unlike v3, which used a JavaScript configuration file (`tailwind.config.js`), v4 uses **CSS-based configuration** via the `@theme` directive.

## Key Differences from v3

### Configuration Location

**v3**: JavaScript file (`tailwind.config.js`)

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6'
      }
    }
  }
}
```

**v4**: CSS file (typically `src/index.css`)

```css
@theme {
  --color-primary: 59 130 246;
}
```

### No JavaScript Config Required

v4 projects typically have **no `tailwind.config.js` file** at all. Configuration is done entirely in CSS using:

- `@theme` directive for theme customization
- CSS custom properties (CSS variables)
- `@custom-variant` for custom variants

### PostCSS Integration

v4 uses a streamlined PostCSS plugin:

```javascript
// postcss.config.cjs
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}
  }
}
```

No additional plugins needed for basic functionality.

## CSS-Based Theme Configuration

### Color Definition

Colors in v4 use **space-separated HSL values** (no `hsl()` wrapper):

```css
@theme {
  /* HSL format: hue saturation lightness */
  --color-primary: 217 91% 60%;
  --color-secondary: 222 47% 11%;

  /* Opacity modifiers work automatically */
  /* Usage: bg-primary/50 = 50% opacity */
}
```

### Semantic Color Tokens

Common pattern for design systems (like shadcn/ui):

```css
@theme {
  /* Base colors */
  --color-background: 0 0% 100%;
  --color-foreground: 222 47% 11%;

  /* Interactive elements */
  --color-primary: 217 91% 60%;
  --color-primary-foreground: 210 40% 98%;

  --color-secondary: 210 40% 96%;
  --color-secondary-foreground: 222 47% 11%;

  --color-destructive: 0 84% 60%;
  --color-destructive-foreground: 210 40% 98%;

  /* UI elements */
  --color-muted: 210 40% 96%;
  --color-muted-foreground: 215 16% 47%;

  --color-accent: 210 40% 96%;
  --color-accent-foreground: 222 47% 11%;

  /* Borders and inputs */
  --color-border: 214 32% 91%;
  --color-input: 214 32% 91%;
  --color-ring: 217 91% 60%;

  /* Cards */
  --color-card: 0 0% 100%;
  --color-card-foreground: 222 47% 11%;
}
```

### Dark Mode Support

Use `@custom-variant` to define dark mode:

```css
@custom-variant dark (&:is(.dark *));

/* Then define dark theme colors */
.dark {
  @theme {
    --color-background: 222 47% 11%;
    --color-foreground: 210 40% 98%;

    --color-primary: 217 91% 60%;
    --color-primary-foreground: 222 47% 11%;

    /* ... other dark mode colors */
  }
}
```

### Radius Variables

Custom radius using CSS custom properties:

```css
@theme {
  /* Base radius */
  --radius: 0.5rem;

  /* Calculated variants */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
```

Usage: `rounded-lg` automatically uses `--radius-lg`.

### Spacing Customization

```css
@theme {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

### Font Configuration

```css
@theme {
  --font-family-sans: 'Inter', system-ui, sans-serif;
  --font-family-mono: 'Fira Code', monospace;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
}
```

## Custom Animations

Define keyframes and animations in regular CSS:

```css
@keyframes accordion-down {
  from {
    height: 0;
  }
  to {
    height: var(--radix-accordion-content-height);
  }
}

@keyframes accordion-up {
  from {
    height: var(--radix-accordion-content-height);
  }
  to {
    height: 0;
  }
}

.animate-accordion-down {
  animation: accordion-down 0.2s ease-out;
}

.animate-accordion-up {
  animation: accordion-up 0.2s ease-out;
}
```

## Using Theme Values

### In Tailwind Classes

```tsx
// Semantic tokens used as utility classes
<button className="bg-primary text-primary-foreground">
  Click me
</button>

// With opacity modifiers
<div className="bg-primary/10 text-foreground/60">
  Subtle background
</div>

// Hover and focus states
<button className="bg-primary hover:bg-primary/90 focus:ring-ring">
  Interactive
</button>
```

### In CSS

Access theme values via CSS custom properties:

```css
.custom-component {
  background-color: hsl(var(--color-background));
  color: hsl(var(--color-foreground));
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}
```

Note: Must wrap in `hsl()` when using in CSS.

## Migration from v3

### Colors

**v3**:

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#3b82f6'
    }
  }
}
```

**v4**:

```css
/* src/index.css */
@theme {
  --color-primary: 217 91% 60%; /* HSL equivalent */
}
```

### Plugins

**v3**: Required plugins for forms, typography, etc.

**v4**: Many features built-in, minimal plugin ecosystem needed.

### Content Configuration

**v3**: `content: ['./src/**/*.{js,jsx,ts,tsx}']` in config

**v4**: Auto-detection or minimal PostCSS config.

## Benefits of v4 Approach

1. **Type-safe CSS**: Configuration is in CSS, validated by CSS parsers
2. **Runtime access**: CSS custom properties accessible in JavaScript
3. **Browser DevTools**: Inspect and modify theme values in real-time
4. **CSS nesting**: Use native CSS features
5. **Simpler build**: Fewer build-time dependencies
6. **Better IDE support**: CSS autocompletion and validation

## Common Patterns

### Multi-theme Support

```css
[data-theme='ocean'] {
  @theme {
    --color-primary: 200 80% 50%;
    --color-secondary: 180 60% 40%;
  }
}

[data-theme='forest'] {
  @theme {
    --color-primary: 120 70% 45%;
    --color-secondary: 100 60% 35%;
  }
}
```

### Component-specific Tokens

```css
@theme {
  /* Sidebar specific colors */
  --color-sidebar-background: 0 0% 98%;
  --color-sidebar-foreground: 240 5% 26%;
  --color-sidebar-primary: 240 6% 10%;
  --color-sidebar-accent: 240 5% 96%;
}
```

### Chart Colors

```css
@theme {
  --color-chart-1: 12 76% 61%;
  --color-chart-2: 173 58% 39%;
  --color-chart-3: 197 37% 24%;
  --color-chart-4: 43 74% 66%;
  --color-chart-5: 27 87% 67%;
}
```

## Troubleshooting

### Colors Not Applying

Issue: `bg-primary` not working
Solution: Ensure `--color-primary` defined in `@theme` block

### Wrong Color Format

Issue: Color showing as raw numbers
Solution: Use HSL format without `hsl()` wrapper in `@theme`

### Dark Mode Not Working

Issue: Dark theme not applying
Solution: Verify `@custom-variant dark` is defined and `.dark` class applied to parent

### Opacity Modifiers Not Working

Issue: `bg-primary/50` not applying opacity
Solution: Ensure color defined with space-separated HSL (not comma-separated)

## Best Practices

1. **Use semantic names**: `primary`, `success`, `warning` instead of `blue`, `green`, `yellow`
2. **HSL format**: Always use HSL for colors (easier manipulation)
3. **Foreground pairs**: For each background color, define a foreground pair
4. **Consistent spacing**: Use calculated values from base tokens
5. **Document tokens**: Add CSS comments explaining token purpose
6. **Dark mode from start**: Define both themes simultaneously
7. **Limit custom colors**: Use standard Tailwind scale when possible

## Resources

- Tailwind CSS v4 Alpha Docs: https://tailwindcss.com/docs/v4-alpha
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- HSL Color Format: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
