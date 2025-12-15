# Theme Architecture Documentation

This document explains the multi-theme system architecture in Bucket, designed for maintainability, extensibility, and future custom theme support.

---

## System Overview

### Technology Stack
- **Theme Provider**: `next-themes` v0.4.6
- **CSS Framework**: Tailwind CSS v4 with PostCSS
- **Storage**: Browser localStorage
- **State Management**: React hooks + next-themes context

### Key Design Principles
1. **CSS Variables First**: All themes use semantic CSS custom properties
2. **Class-Based Theming**: Themes applied via class on `<html>` element
3. **Backward Compatible**: Existing light/dark themes unchanged
4. **Extensible**: Easy to add new themes
5. **Future-Ready**: Architecture supports custom theme imports

---

## File Structure

```
src/
├── constants/
│   └── themes.ts                      # Theme metadata registry
├── components/
│   └── Settings/
│       ├── ThemeSelector.tsx          # Main theme selector UI
│       ├── ThemeColorSwatch.tsx       # Color preview component
│       └── ThemeImport.tsx            # Custom theme import (stub)
├── hooks/
│   └── useThemePreview.ts             # Live preview functionality
├── utils/
│   ├── themeMapper.ts                 # Legacy migration utilities
│   └── themeLoader.ts                 # Custom theme loader (future)
├── types/
│   └── customTheme.ts                 # Custom theme type definitions
├── index.css                           # Theme CSS variables
└── App.tsx                            # ThemeProvider configuration

docs/
├── theme-customization.md             # User documentation
└── theme-architecture.md              # This file

tests/
└── unit/
    ├── constants/themes.test.ts       # Theme registry tests
    ├── utils/themeMapper.test.ts      # Migration utility tests
    └── components/Settings/
        ├── ThemeSelector.test.tsx     # Component tests
        └── ThemeColorSwatch.test.tsx  # Swatch tests
```

---

## Core Components

### 1. Theme Registry ([themes.ts](../src/constants/themes.ts))

Central source of truth for all theme metadata.

**Key Exports:**
```typescript
export type ThemeId = 'system' | 'light' | 'dark' | 'dracula' | ...
export interface ThemeMetadata { id, name, description, category, colorSwatch, author, isDark }
export const THEMES: Record<ThemeId, ThemeMetadata>
export function getAllThemeIds(): ThemeId[]
export function getThemeById(id: string): ThemeMetadata | undefined
export function getThemesByCategory(category: ThemeCategory): ThemeMetadata[]
export function getGroupedThemes(): ThemeGroup[]
```

**Usage:**
```typescript
import { THEMES, getGroupedThemes } from '@/constants/themes'

// Get theme info
const dracula = THEMES.dracula
console.log(dracula.name) // "Dracula"

// Get grouped themes for UI
const groups = getGroupedThemes()
// [{ label: "System", themes: [...] }, { label: "Light Themes", ... }]
```

### 2. ThemeProvider Configuration ([App.tsx](../src/App.tsx))

```tsx
<ThemeProvider
  attribute="class"              // Apply theme via class name
  defaultTheme="system"          // Default to system preference
  themes={[                      // Explicitly list all themes
    'system', 'light', 'dark',
    'dracula',
    'catppuccin-latte', 'catppuccin-frappe',
    'catppuccin-macchiato', 'catppuccin-mocha'
  ]}
  enableSystem                   // Allow system theme detection
  storageKey="theme"             // LocalStorage key
>
```

**How it works:**
1. `next-themes` reads `storageKey` from localStorage
2. Applies corresponding class to `<html>` (e.g., `.dracula`)
3. CSS variables update based on class selector
4. All components inherit theme colors via semantic tokens

### 3. CSS Variable System ([index.css](../src/index.css))

**Structure:**
```css
@layer base {
  :root {
    /* Light theme (default) */
    --background: 0 0% 100%;
    --foreground: 224 71.4% 4.1%;
    /* ...40+ variables */
  }

  .dark { /* Dark theme overrides */ }
  .dracula { /* Dracula theme overrides */ }
  .catppuccin-latte { /* Latte theme overrides */ }
  /* ...5 more themes */
}
```

**Color Variables (Complete List):**
- Base: `--background`, `--foreground`
- Surfaces: `--card`, `--popover`, `--sidebar`
- Semantic: `--primary`, `--secondary`, `--accent`, `--muted`
- States: `--destructive`, `--success`, `--warning`, `--info`
- Interactive: `--border`, `--input`, `--ring`
- Charts: `--chart-1` through `--chart-5`

**Usage in Components:**
```tsx
<div className="bg-background text-foreground border-border">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
</div>
```

### 4. ThemeSelector Component ([ThemeSelector.tsx](../src/components/Settings/ThemeSelector.tsx))

**Features:**
- Radix UI Select dropdown
- Grouped theme options (System / Light / Dark)
- Color swatches for visual identification
- Live preview on hover
- Auto-save on selection
- Loading state (hydration-safe)

**Props:**
```typescript
interface ThemeSelectorProps {
  label?: string
  className?: string
}
```

**Integration:**
```tsx
import { ThemeSelector } from '@/components/Settings/ThemeSelector'

<ThemeSelector label="Theme" />
```

### 5. Live Preview Hook ([useThemePreview.ts](../src/hooks/useThemePreview.ts))

**Purpose:** Temporarily apply a theme on hover without persisting it.

**API:**
```typescript
const { startPreview, stopPreview } = useThemePreview({
  activeTheme: 'dark',
  debounceMs: 150
})

// On hover
startPreview('dracula') // Instantly applies Dracula theme

// On mouse leave
stopPreview() // Restores 'dark' theme
```

**How it works:**
1. User hovers over theme option
2. Hook waits 150ms (debounce)
3. Removes all theme classes from `<html>`
4. Adds preview theme class (e.g., `.dracula`)
5. On mouse leave, restores original theme class

### 6. Theme Color Swatch ([ThemeColorSwatch.tsx](../src/components/Settings/ThemeColorSwatch.tsx))

**Purpose:** Visual preview of theme colors (4-color bar).

**Props:**
```typescript
interface ThemeColorSwatchProps {
  colors: {
    background: string  // HSL format: "220 13% 91%"
    foreground: string
    primary: string
    accent: string
  }
  className?: string
}
```

**Renders:**
```
┌──────────────────────┐
│ ▮ ▮ ▮ ▮  │  (4 colors: bg, fg, primary, accent)
└──────────────────────┘
```

---

## Adding a New Built-In Theme

### Step 1: Define CSS Variables

In `src/index.css`, add a new class selector:

```css
.my-new-theme {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --success: 142 71% 45%;
  --success-foreground: 0 0% 98%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 98%;
  --info: 217 91% 60%;
  --info-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --sidebar-background: var(--card);
  --sidebar-foreground: var(--card-foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--accent-foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);
}
```

### Step 2: Add to Theme Registry

In `src/constants/themes.ts`:

```typescript
export type ThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'dracula'
  | 'catppuccin-latte'
  | 'catppuccin-frappe'
  | 'catppuccin-macchiato'
  | 'catppuccin-mocha'
  | 'my-new-theme' // Add here

export const THEMES: Record<ThemeId, ThemeMetadata> = {
  // ...existing themes
  'my-new-theme': {
    id: 'my-new-theme',
    name: 'My New Theme',
    description: 'A beautiful custom theme',
    category: 'dark', // or 'light'
    colorSwatch: {
      background: '240 10% 3.9%',
      foreground: '0 0% 98%',
      primary: '0 0% 98%',
      accent: '240 3.7% 15.9%',
    },
    author: 'Your Name',
    isDark: true,
  },
}
```

### Step 3: Update ThemeProvider

In `src/App.tsx`:

```tsx
<ThemeProvider
  themes={[
    'system', 'light', 'dark', 'dracula',
    'catppuccin-latte', 'catppuccin-frappe',
    'catppuccin-macchiato', 'catppuccin-mocha',
    'my-new-theme' // Add here
  ]}
  ...
>
```

### Step 4: Update Tests

In `tests/unit/constants/themes.test.ts`:

```typescript
it('contains all 9 themes', () => { // Update count
  const themeIds = Object.keys(THEMES)
  expect(themeIds).toHaveLength(9)
  expect(themeIds).toContain('my-new-theme')
})
```

### Step 5: Update Documentation

Update `docs/theme-customization.md` with theme details.

---

## Custom Theme Import (Future Feature)

### Architecture (Already in Place)

**Type Definition** (`src/types/customTheme.ts`):
```typescript
export interface CustomThemeDefinition {
  id: string
  name: string
  description?: string
  author?: string
  isDark: boolean
  colors: Partial<Record<CSSVariableName, HSLValue>>
}
```

**Theme Loader** (`src/utils/themeLoader.ts`):
```typescript
export function loadCustomTheme(theme: CustomThemeDefinition): { success: boolean, error?: string }
export function saveCustomThemesToStorage(themes: CustomThemeDefinition[]): void
export function loadCustomThemesFromStorage(): CustomThemeDefinition[]
```

**Validation** (Zod schema):
```typescript
export const CustomThemeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  colors: z.record(z.string(), z.string().regex(/^\d+\s+\d+%\s+\d+%$/)),
  ...
})
```

### Implementation Plan (When Ready)

1. **UI Component**: Complete `ThemeImport.tsx` with file picker
2. **Validation**: Use Zod schema to validate JSON imports
3. **Dynamic CSS Injection**: Use `themeLoader.loadCustomTheme()`
4. **Persistence**: Save to localStorage under `bucket-custom-themes`
5. **ThemeProvider Integration**: Dynamically add custom theme IDs

---

## Migration & Backward Compatibility

### Legacy Theme Migration

Users upgrading from old versions have their themes automatically migrated:

**themeMapper.ts:**
```typescript
export function migrateLegacyTheme(legacyThemeId: string): ThemeId {
  const migrations: Record<string, ThemeId> = {
    light: 'light',
    dark: 'dark',
    system: 'system',
  }
  return migrations[legacyThemeId] || 'system'
}
```

**Handles:**
- Old `"light"` → New `"light"` ✓
- Old `"dark"` → New `"dark"` ✓
- Old `"system"` → New `"system"` ✓
- Unknown → Defaults to `"system"` ✓

### Breaking Changes: None

- All existing theme values still work
- No user action required on upgrade
- localStorage key unchanged (`"theme"`)

---

## Testing Strategy

### Unit Tests

**What's Tested:**
- Theme metadata completeness
- Helper function correctness
- Component rendering
- Color swatch display
- Migration utilities

**Coverage:**
- `themes.ts`: 21 tests, 100% coverage
- `themeMapper.ts`: 8 tests, 100% coverage
- `ThemeColorSwatch.tsx`: 7 tests
- `ThemeSelector.tsx`: 10 tests

**Run Tests:**
```bash
bun test themes
bun test themeMapper
bun test ThemeSelector
bun test ThemeColorSwatch
```

### Manual Testing Checklist

- [ ] Theme selector appears in Settings → Appearance
- [ ] All 8 themes listed with correct names
- [ ] Color swatches display for each theme
- [ ] Live preview works on hover
- [ ] Theme persists after page refresh
- [ ] System theme follows OS preference
- [ ] Sidebar quick toggle works
- [ ] "Customize" link navigates to Settings
- [ ] No console errors

---

## Performance Considerations

### Theme Switching
- **Transition Time**: 0.3s CSS transition
- **Class Toggle**: Instant (single DOM operation)
- **Re-renders**: Minimal (next-themes handles efficiently)

### Live Preview
- **Debounce**: 150ms prevents flicker
- **DOM Operations**: 2 per preview (remove old class, add new)
- **Cleanup**: Automatic on unmount

### Storage
- **localStorage**: ~50 bytes per theme preference
- **No Network Requests**: All themes bundled
- **Custom Themes**: Future feature, stored in localStorage

---

## Troubleshooting

### Theme Not Applying

**Symptom:** Selected theme doesn't show visually

**Debug Steps:**
1. Check `<html>` class: Should have theme class (e.g., `.dracula`)
2. Inspect CSS variables: `getComputedStyle(document.documentElement).getPropertyValue('--background')`
3. Verify localStorage: `localStorage.getItem('theme')`
4. Check next-themes context: Use React DevTools

**Common Causes:**
- Hydration mismatch (SSR/SSG)
- Conflicting CSS overrides
- ThemeProvider not wrapping app

### Live Preview Stuck

**Symptom:** Preview theme stays after mouse leave

**Debug Steps:**
1. Check `useThemePreview` cleanup
2. Verify `stopPreview()` is called
3. Look for uncaught errors in preview logic

**Fix:** Refresh page to reset

---

## Future Enhancements

### Planned Features
1. **Custom Theme Import**: JSON file upload
2. **Theme Editor**: Visual theme builder
3. **Theme Export**: Share themes with others
4. **Theme Marketplace**: Community themes
5. **Accent Color Customization**: Override specific colors
6. **Font Size Themes**: Accessibility presets

### Extension Points
- `ThemeImport.tsx`: Stubbed for future implementation
- `themeLoader.ts`: Fully functional custom theme loader
- `customTheme.ts`: Type definitions ready
- localStorage: Architecture supports unlimited custom themes

---

## API Reference

### hooks/useThemePreview

```typescript
function useThemePreview(options: {
  activeTheme: string
  debounceMs?: number
}): {
  startPreview: (themeId: string) => void
  stopPreview: () => void
}
```

### constants/themes

```typescript
const THEMES: Record<ThemeId, ThemeMetadata>
function getAllThemeIds(): ThemeId[]
function getThemeById(id: string): ThemeMetadata | undefined
function getThemesByCategory(category: ThemeCategory): ThemeMetadata[]
function isCustomTheme(themeId: string): boolean
function getGroupedThemes(): ThemeGroup[]
```

### utils/themeMapper

```typescript
function migrateLegacyTheme(legacyThemeId: string): ThemeId
function isValidThemeId(themeId: string): themeId is ThemeId
```

### utils/themeLoader (Future)

```typescript
function loadCustomTheme(theme: CustomThemeDefinition): { success: boolean, error?: string }
function unloadCustomTheme(themeId: string): void
function saveCustomThemesToStorage(themes: CustomThemeDefinition[]): void
function loadCustomThemesFromStorage(): CustomThemeDefinition[]
function initializeCustomThemes(): void
```

---

## Credits

### Libraries
- [next-themes](https://github.com/pacocoursey/next-themes) by @pacocoursey
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

### Theme Inspiration
- [Dracula Theme](https://draculatheme.com/) by Zeno Rocha
- [Catppuccin](https://github.com/catppuccin/catppuccin) by the Catppuccin team

---

## Changelog

### v0.11.0 (Current)
- ✨ Added 8-theme system (System, Light, Dark, Dracula, 4x Catppuccin)
- ✨ Live preview on hover
- ✨ Color swatches in theme selector
- ✨ Settings → Appearance section
- ✨ Sidebar "Customize" link
- ✨ Custom theme architecture (foundation)
- ✅ Backward compatible with existing themes
- ✅ Comprehensive test coverage
- 📚 Full documentation

### Previous Versions
- v0.10.0 and earlier: Binary light/dark toggle only

---

## Contributing

### Adding a New Theme

1. Fork the repository
2. Follow "Adding a New Built-In Theme" guide above
3. Ensure WCAG AA contrast compliance
4. Add comprehensive tests
5. Update documentation
6. Submit pull request with theme preview screenshots

### Reporting Issues

- Theme not displaying: Include browser, OS, theme ID
- Color contrast issues: Specify which elements
- Performance issues: Include theme switching count

---

## License

Theme system code: MIT License (see LICENSE file)

Third-party theme licenses:
- Dracula: MIT License
- Catppuccin: MIT License
