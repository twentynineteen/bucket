# Native macOS Window Styling Implementation Plan

## Executive Summary

Transform Bucket's window appearance to match native macOS applications with platform-specific styling, vibrancy effects, and custom title bar treatment. This multi-phase approach prioritizes incremental improvements with minimal risk, allowing development to stop at any phase while maintaining a stable application.

## Current State

**Existing Configuration** (`tauri.conf.json` lines 16-24):
```json
"windows": [
  {
    "title": "Bucket",
    "width": 1200,
    "height": 800,
    "resizable": true,
    "dragDropEnabled": true
  }
]
```

**Key Advantage:** Project already has `"macOSPrivateApi": true` enabled (line 14), which allows transparent windows on macOS.

**Limitation:** Current window has standard platform-generic appearance with no macOS-specific styling.

---

## Phase 1: Foundation - Transparent Title Bar

### Goal
Modernize the window with a transparent title bar while maintaining simplicity and native traffic light controls.

### Implementation

#### 1.1 Update `src-tauri/tauri.conf.json`

**Location:** `tauri.conf.json` lines 16-24

**Changes:**
```json
"windows": [
  {
    "title": "Bucket",
    "width": 1200,
    "height": 800,
    "resizable": true,
    "dragDropEnabled": true,
    "titleBarStyle": "Transparent",  // NEW: Transparent title bar
    "hiddenTitle": true,              // NEW: Hide default title text
    "decorations": true,              // NEW: Keep native window borders
    "transparent": true               // NEW: Enable window transparency
  }
]
```

**Why These Settings:**
- `titleBarStyle: "Transparent"` - Makes title bar transparent, showing window background
- `hiddenTitle: true` - Removes default "Bucket" text from title bar
- `decorations: true` - Keeps native window borders and traffic lights (red/yellow/green buttons)
- `transparent: true` - Enables window-level transparency (requires `macOSPrivateApi: true`)

#### 1.2 Testing Checklist

- [ ] Window appears with transparent title bar on macOS
- [ ] Traffic light buttons (red/yellow/green) remain visible and functional
- [ ] Traffic lights positioned at standard macOS location (top-left)
- [ ] Window dragging works correctly
- [ ] No visual glitches on light/dark theme switching
- [ ] App still launches correctly on non-macOS platforms (Windows/Linux)

#### 1.3 Documentation

Add comment block above window configuration in `tauri.conf.json`:

```json
// macOS-specific window styling
// Note: transparent windows require macOSPrivateApi: true
// This prevents App Store distribution but enables native macOS appearance
"windows": [...]
```

### Risk Assessment
**Risk Level:** Low

**Benefits:**
- Simple configuration change
- Immediate visual improvement
- No code changes required
- Graceful fallback on other platforms

**Risks:**
- App Store rejection (acceptable - not targeting App Store currently)
- Requires testing on multiple macOS versions

**Rollback:** Simply revert `tauri.conf.json` changes

---

## Phase 2: Sidebar Vibrancy Effects

### Goal
Add native macOS blur/vibrancy effects to the application sidebar for a modern, OS-integrated appearance.

### Implementation

#### 2.1 Create `src/hooks/useMacOSEffects.ts`

**New File:** `src/hooks/useMacOSEffects.ts`

**Purpose:** Apply platform-specific window effects on macOS

```typescript
import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type MacOSEffect =
  | 'Sidebar'
  | 'ContentBackground'
  | 'UnderWindowBackground'
  | 'WindowBackground'

interface UseMacOSEffectsOptions {
  effects?: MacOSEffect[]
  enabled?: boolean
}

export function useMacOSEffects({
  effects = ['Sidebar'],
  enabled = true
}: UseMacOSEffectsOptions = {}) {
  useEffect(() => {
    if (!enabled) return

    const applyEffects = async () => {
      // Only apply on macOS
      if (!navigator.platform.includes('Mac')) return

      try {
        const window = getCurrentWindow()

        await window.setEffects({
          effects,
          state: 'active',
          radius: 0
        })
      } catch (error) {
        console.warn('Failed to apply macOS effects:', error)
      }
    }

    applyEffects()

    // Cleanup function to remove effects
    return () => {
      const removeEffects = async () => {
        if (!navigator.platform.includes('Mac')) return

        try {
          const window = getCurrentWindow()
          await window.clearEffects()
        } catch (error) {
          console.warn('Failed to clear macOS effects:', error)
        }
      }
      removeEffects()
    }
  }, [effects, enabled])
}
```

#### 2.2 Update Sidebar Component

**File:** `src/components/app-sidebar.tsx`

**Changes:**

1. Import the hook at the top:
```typescript
import { useMacOSEffects } from '@/hooks/useMacOSEffects'
```

2. Apply effects in the sidebar component (around line 80-90):
```typescript
export function AppSidebar() {
  // Apply macOS sidebar vibrancy effect
  useMacOSEffects({ effects: ['Sidebar'] })

  // ... rest of component
}
```

3. Adjust sidebar background for vibrancy compatibility:
```typescript
<Sidebar
  className="bg-background/95 backdrop-blur-sm"  // Semi-transparent background
  // ... other props
>
```

#### 2.3 CSS Adjustments

**File:** Update Tailwind CSS classes in sidebar components

**Changes:**
- Replace solid backgrounds with semi-transparent variants
- Use `backdrop-blur-sm` for enhanced effect
- Example: `bg-background` → `bg-background/95`

#### 2.4 Testing Checklist

- [ ] Sidebar shows native macOS blur effect
- [ ] Effect works in both light and dark mode
- [ ] Performance is acceptable (no lag when resizing)
- [ ] Effect only applies on macOS (no errors on Windows/Linux)
- [ ] Sidebar content remains readable over blurred background
- [ ] Effect respects system "Reduce transparency" accessibility setting (optional)

### Risk Assessment
**Risk Level:** Low

**Benefits:**
- Pure visual enhancement
- No functional changes
- Matches native macOS apps (Finder, Notes, etc.)
- Easy to disable if performance issues arise

**Risks:**
- Potential performance impact on older Macs
- May require color adjustments for readability

**Rollback:** Remove hook usage and revert CSS changes

---

## Phase 3: Custom Title Bar with Overlay Mode

### Goal
Gain full control over the title bar area for custom branding, controls, or layout while maintaining native traffic light buttons.

### Implementation

#### 3.1 Update `src-tauri/tauri.conf.json`

**Location:** `tauri.conf.json` lines 16-24

**Changes:**
```json
"windows": [
  {
    "title": "Bucket",
    "width": 1200,
    "height": 800,
    "resizable": true,
    "dragDropEnabled": true,
    "titleBarStyle": "Overlay",      // CHANGED: From "Transparent" to "Overlay"
    "hiddenTitle": true,
    "decorations": true,
    "transparent": true,
    "trafficLightPosition": {         // NEW: Position traffic lights
      "x": 20.0,
      "y": 20.0
    }
  }
]
```

#### 3.2 Create `src/components/TitleBar.tsx`

**New File:** `src/components/TitleBar.tsx`

**Purpose:** Custom title bar component with drag region and macOS styling

```typescript
import { useEffect, useState } from 'react'

export function TitleBar() {
  const [isMacOS, setIsMacOS] = useState(false)

  useEffect(() => {
    setIsMacOS(navigator.platform.includes('Mac'))
  }, [])

  // Only render on macOS with overlay titlebar
  if (!isMacOS) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4"
      style={{
        WebkitAppRegion: 'drag',  // Enable window dragging
        paddingLeft: '80px'       // Space for traffic lights
      }}
      data-tauri-drag-region
    >
      {/* Custom title bar content */}
      <div
        className="flex items-center gap-2 text-sm font-medium text-foreground/70"
        style={{ WebkitAppRegion: 'no-drag' }}  // Disable drag for interactive elements
      >
        <span>Bucket</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Optional: Custom controls (search, settings, etc.) */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Add custom controls here */}
      </div>
    </div>
  )
}
```

#### 3.3 Update Main Layout

**File:** `src/App.tsx` or main layout component

**Changes:**

1. Import TitleBar:
```typescript
import { TitleBar } from '@/components/TitleBar'
```

2. Add TitleBar above main content:
```typescript
function App() {
  return (
    <>
      <TitleBar />
      <SidebarProvider>
        {/* Existing layout */}
        <AppSidebar />
        <main className="flex-1 pt-14">  {/* Add pt-14 for titlebar height */}
          {/* ... */}
        </main>
      </SidebarProvider>
    </>
  )
}
```

#### 3.4 Add CSS for Drag Regions

**File:** `src/index.css` or component styles

**Add:**
```css
/* Custom title bar drag regions */
[data-tauri-drag-region] {
  -webkit-app-region: drag;
  user-select: none;
}

[data-tauri-drag-region] button,
[data-tauri-drag-region] a,
[data-tauri-drag-region] input {
  -webkit-app-region: no-drag;
}
```

#### 3.5 Handle Window Resize (Optional)

**File:** `src/hooks/useTrafficLightPosition.ts`

**Purpose:** Adjust traffic light position on window resize (if needed)

```typescript
import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function useTrafficLightPosition(x: number = 20, y: number = 20) {
  useEffect(() => {
    if (!navigator.platform.includes('Mac')) return

    const window = getCurrentWindow()

    const updatePosition = async () => {
      try {
        // Position can be adjusted based on window size if needed
        // For now, using fixed position
        // Note: setTrafficLightPosition not available in JS API
        // This would need to be handled in Rust if dynamic positioning needed
      } catch (error) {
        console.warn('Failed to update traffic light position:', error)
      }
    }

    // Listen for resize events
    const unlisten = window.onResized(() => {
      updatePosition()
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [x, y])
}
```

#### 3.6 Testing Checklist

- [ ] Custom title bar renders correctly on macOS
- [ ] Window dragging works in title bar area
- [ ] Traffic lights positioned at (20, 20) and functional
- [ ] Interactive elements in title bar don't trigger window drag
- [ ] Title bar respects system theme (light/dark)
- [ ] Title bar height consistent across macOS versions
- [ ] No title bar on Windows/Linux (graceful fallback)
- [ ] Dragging works when window is both focused and unfocused

### Risk Assessment
**Risk Level:** Medium

**Benefits:**
- Complete customization of title bar area
- Can add custom branding, search, or controls
- Modern appearance matching apps like VS Code, Figma

**Risks:**
- More complex implementation
- Potential dragging issues (Tauri issue #4316)
- Title bar height varies across macOS versions
- Requires careful testing

**Rollback:** Revert to Phase 1 configuration (`titleBarStyle: "Transparent"`)

---

## Phase 4: System Theme Integration

### Goal
Dynamically respond to macOS system theme changes (light/dark mode) and adjust vibrancy effects accordingly.

### Implementation

#### 4.1 Create `src/hooks/useSystemTheme.ts`

**New File:** `src/hooks/useSystemTheme.ts`

**Purpose:** Listen for macOS system theme changes

```typescript
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type SystemTheme = 'light' | 'dark' | null

export function useSystemTheme() {
  const [theme, setTheme] = useState<SystemTheme>(null)

  useEffect(() => {
    const window = getCurrentWindow()

    // Get initial theme
    const getTheme = async () => {
      try {
        const currentTheme = await window.theme()
        setTheme(currentTheme)
      } catch (error) {
        console.warn('Failed to get window theme:', error)
      }
    }

    getTheme()

    // Listen for theme changes
    const unlisten = window.onThemeChanged((event) => {
      setTheme(event.payload as SystemTheme)
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  return theme
}
```

#### 4.2 Update `useMacOSEffects` Hook

**File:** `src/hooks/useMacOSEffects.ts`

**Changes:** Add theme-aware effect application

```typescript
import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSystemTheme } from './useSystemTheme'

export type MacOSEffect =
  | 'Sidebar'
  | 'ContentBackground'
  | 'UnderWindowBackground'
  | 'WindowBackground'

interface UseMacOSEffectsOptions {
  effects?: MacOSEffect[]
  enabled?: boolean
  adjustForTheme?: boolean  // NEW: Adjust effects based on theme
}

export function useMacOSEffects({
  effects = ['Sidebar'],
  enabled = true,
  adjustForTheme = false
}: UseMacOSEffectsOptions = {}) {
  const theme = useSystemTheme()

  useEffect(() => {
    if (!enabled) return

    const applyEffects = async () => {
      if (!navigator.platform.includes('Mac')) return

      try {
        const window = getCurrentWindow()

        // Optionally adjust effects based on theme
        let activeEffects = effects
        if (adjustForTheme && theme === 'dark') {
          // Could use different effects for dark mode if desired
          activeEffects = effects
        }

        await window.setEffects({
          effects: activeEffects,
          state: 'active',
          radius: 0
        })
      } catch (error) {
        console.warn('Failed to apply macOS effects:', error)
      }
    }

    applyEffects()

    return () => {
      const removeEffects = async () => {
        if (!navigator.platform.includes('Mac')) return

        try {
          const window = getCurrentWindow()
          await window.clearEffects()
        } catch (error) {
          console.warn('Failed to clear macOS effects:', error)
        }
      }
      removeEffects()
    }
  }, [effects, enabled, theme, adjustForTheme])
}
```

#### 4.3 Update Root App Component

**File:** `src/App.tsx`

**Changes:** Apply theme to document root

```typescript
import { useSystemTheme } from '@/hooks/useSystemTheme'

function App() {
  const theme = useSystemTheme()

  // Apply theme class to document root
  useEffect(() => {
    if (theme) {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(theme)
    }
  }, [theme])

  return (
    // ... existing layout
  )
}
```

#### 4.4 Add Theme Transition Animations

**File:** `src/index.css`

**Add:**
```css
/* Smooth theme transitions */
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}

.sidebar,
.titlebar {
  transition: background-color 0.3s ease, backdrop-filter 0.3s ease;
}
```

#### 4.5 Testing Checklist

- [ ] App responds to system theme changes (System Preferences > General > Appearance)
- [ ] Vibrancy effects update appropriately for light/dark mode
- [ ] Theme transitions are smooth (no flashing)
- [ ] All UI elements remain readable in both themes
- [ ] Theme preference persists across app restarts
- [ ] No errors on non-macOS platforms

### Risk Assessment
**Risk Level:** Low

**Benefits:**
- Seamless integration with macOS system preferences
- Professional user experience
- Automatic theme synchronization

**Risks:**
- Minimal - purely enhances existing functionality
- May require color palette adjustments

**Rollback:** Simply don't use the `useSystemTheme` hook

---

## Phase 5: Advanced Polish

### Goal
Professional refinements and performance optimizations for production-ready macOS integration.

### Implementation

#### 5.1 Update `src-tauri/tauri.conf.json`

**Location:** `tauri.conf.json` lines 16-24

**Add Additional macOS Options:**
```json
"windows": [
  {
    "title": "Bucket",
    "width": 1200,
    "height": 800,
    "resizable": true,
    "dragDropEnabled": true,
    "titleBarStyle": "Overlay",
    "hiddenTitle": true,
    "decorations": true,
    "transparent": true,
    "trafficLightPosition": {
      "x": 20.0,
      "y": 20.0
    },
    "acceptFirstMouse": false,        // NEW: Standard macOS click behavior
    "tabbingIdentifier": "bucket-app"  // NEW: Enable window tabbing
  }
]
```

**Why These Settings:**
- `acceptFirstMouse: false` - Clicking inactive window activates it without clicking through
- `tabbingIdentifier` - Allows users to group multiple Bucket windows as tabs (macOS 10.12+)

#### 5.2 Window State Persistence

**New File:** `src/hooks/useWindowState.ts`

**Purpose:** Remember window position and size across sessions

```typescript
import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface WindowState {
  x: number
  y: number
  width: number
  height: number
}

const STORAGE_KEY = 'bucket-window-state'

export function useWindowState() {
  useEffect(() => {
    const window = getCurrentWindow()

    // Restore saved position/size
    const restoreWindowState = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return

        const state: WindowState = JSON.parse(saved)
        await window.setPosition({ x: state.x, y: state.y })
        await window.setSize({ width: state.width, height: state.height })
      } catch (error) {
        console.warn('Failed to restore window state:', error)
      }
    }

    restoreWindowState()

    // Save position/size on changes
    const saveWindowState = async () => {
      try {
        const position = await window.outerPosition()
        const size = await window.outerSize()

        const state: WindowState = {
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        console.warn('Failed to save window state:', error)
      }
    }

    // Listen for changes
    const unlistenResize = window.onResized(() => saveWindowState())
    const unlistenMove = window.onMoved(() => saveWindowState())

    return () => {
      unlistenResize.then(fn => fn())
      unlistenMove.then(fn => fn())
    }
  }, [])
}
```

**Usage in App.tsx:**
```typescript
function App() {
  useWindowState()  // Remember window position/size
  // ... rest of component
}
```

#### 5.3 Performance Optimization - User Preference

**New File:** `src/hooks/useVibrancyPreference.ts`

**Purpose:** Allow users to disable vibrancy for better performance

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VibrancyStore {
  enabled: boolean
  toggleVibrancy: () => void
}

export const useVibrancyPreference = create<VibrancyStore>()(
  persist(
    (set) => ({
      enabled: true,
      toggleVibrancy: () => set((state) => ({ enabled: !state.enabled }))
    }),
    {
      name: 'vibrancy-preference'
    }
  )
)
```

**Update Settings Page:**

Add toggle in Settings page:
```typescript
import { useVibrancyPreference } from '@/hooks/useVibrancyPreference'

function SettingsPage() {
  const { enabled, toggleVibrancy } = useVibrancyPreference()

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleVibrancy}
        />
        Enable macOS vibrancy effects
      </label>
      <p className="text-sm text-muted-foreground">
        Disable for better performance on older Macs
      </p>
    </div>
  )
}
```

**Update useMacOSEffects:**
```typescript
export function useMacOSEffects(options) {
  const { enabled: userPreference } = useVibrancyPreference()

  // Only apply if both system and user preference enabled
  const shouldApply = options.enabled && userPreference

  // ... rest of implementation using shouldApply
}
```

#### 5.4 Custom Window Controls (Optional)

**New File:** `src/components/WindowControls.tsx`

**Purpose:** Custom minimize/maximize/close buttons for title bar

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minimize, Maximize, X } from 'lucide-react'

export function WindowControls() {
  const window = getCurrentWindow()

  const handleMinimize = () => window.minimize()
  const handleMaximize = () => window.toggleMaximize()
  const handleClose = () => window.close()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleMinimize}
        className="p-1 hover:bg-secondary rounded"
        aria-label="Minimize window"
      >
        <Minimize className="w-4 h-4" />
      </button>
      <button
        onClick={handleMaximize}
        className="p-1 hover:bg-secondary rounded"
        aria-label="Maximize window"
      >
        <Maximize className="w-4 h-4" />
      </button>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded"
        aria-label="Close window"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
```

**Note:** Only needed if you want custom controls. macOS traffic lights handle this by default.

#### 5.5 Multi-Version Testing

**Test on Multiple macOS Versions:**
- macOS 10.13 High Sierra (minimum supported by Tauri)
- macOS 11 Big Sur (UI redesign)
- macOS 12 Monterey
- macOS 13 Ventura
- macOS 14 Sonoma
- macOS 15 Sequoia (latest)

**Key Differences to Check:**
- Title bar height variations
- Traffic light button spacing
- Vibrancy effect rendering
- System theme detection

#### 5.6 Accessibility Considerations

**Respect System Preferences:**
- "Reduce transparency" - Disable vibrancy effects
- "Increase contrast" - Adjust color schemes
- "Reduce motion" - Disable theme transition animations

**Implementation in `useMacOSEffects`:**
```typescript
export function useMacOSEffects(options) {
  const prefersReducedTransparency = window.matchMedia(
    '(prefers-reduced-transparency: reduce)'
  ).matches

  const shouldApply = options.enabled && !prefersReducedTransparency

  // ... rest of implementation
}
```

#### 5.7 Testing Checklist

- [ ] `acceptFirstMouse` behavior matches native apps
- [ ] Window tabbing works (Window menu > Merge All Windows)
- [ ] Window position/size persists across restarts
- [ ] Vibrancy preference toggle works in Settings
- [ ] Performance acceptable with effects disabled
- [ ] Accessibility settings respected (reduce transparency, etc.)
- [ ] All features work across macOS 10.13 - 15+
- [ ] No errors in console related to window operations

### Risk Assessment
**Risk Level:** Low

**Benefits:**
- Production-ready polish
- Better performance on older hardware
- Accessibility compliance
- Professional user experience

**Risks:**
- Minimal - mostly optional enhancements
- Additional testing required across macOS versions

**Rollback:** Individual features can be removed without affecting core functionality

---

## Documentation Updates

### Create `docs/macos-window-styling.md`

**New File:** `docs/macos-window-styling.md`

**Content:**
```markdown
# macOS Window Styling

## Overview

Bucket uses native macOS window styling features to provide a seamless, OS-integrated experience. This document covers implementation details, configuration, and troubleshooting.

## Features

### Transparent Title Bar
- Native macOS traffic light controls (red/yellow/green)
- Transparent background showing app content
- Hidden default title text for custom branding

### Sidebar Vibrancy
- Native blur effects matching Finder, Notes, etc.
- Automatic theme adaptation (light/dark)
- Performance-conscious implementation

### Custom Title Bar (Optional)
- Full control over title bar area
- Custom drag regions
- Interactive elements (search, controls, etc.)

## Configuration

### Basic Setup (Phase 1-2)

Minimal configuration in `tauri.conf.json`:
```json
{
  "titleBarStyle": "Transparent",
  "hiddenTitle": true,
  "decorations": true,
  "transparent": true
}
```

Apply vibrancy in components:
```typescript
import { useMacOSEffects } from '@/hooks/useMacOSEffects'

function Sidebar() {
  useMacOSEffects({ effects: ['Sidebar'] })
  return <div>...</div>
}
```

### Advanced Setup (Phase 3-5)

Full customization with overlay title bar:
```json
{
  "titleBarStyle": "Overlay",
  "trafficLightPosition": { "x": 20.0, "y": 20.0 }
}
```

## Troubleshooting

### Traffic Lights Not Visible
- Ensure `decorations: true` in `tauri.conf.json`
- Check `titleBarStyle` is set to "Overlay" or "Transparent"
- Verify `trafficLightPosition` coordinates are positive

### Vibrancy Not Appearing
- Confirm `macOSPrivateApi: true` in config
- Check system "Reduce transparency" setting
- Verify effects are applied on macOS platform only

### Window Dragging Not Working
- Ensure drag region has `WebkitAppRegion: 'drag'`
- Check interactive elements have `WebkitAppRegion: 'no-drag'`
- Test in both focused and unfocused window states

### Performance Issues
- Disable vibrancy in Settings page
- Use fewer simultaneous effects
- Check macOS version compatibility

## App Store Compatibility

**Important:** Current implementation uses `macOSPrivateApi: true`, which prevents App Store distribution.

**To enable App Store distribution:**
1. Set `macOSPrivateApi: false` in `tauri.conf.json`
2. Remove `transparent: true` from window config
3. Use `titleBarStyle: "Visible"` instead of "Transparent" or "Overlay"
4. Remove vibrancy effects

## Platform Support

- **macOS:** Full feature set (10.13+)
- **Windows:** Graceful fallback to standard window
- **Linux:** Graceful fallback to standard window

## Testing Checklist

- [ ] Window appearance on macOS 11, 12, 13, 14, 15
- [ ] Light and dark theme switching
- [ ] Traffic light positioning and functionality
- [ ] Window dragging (focused and unfocused)
- [ ] Vibrancy rendering quality
- [ ] Performance with effects enabled/disabled
- [ ] Accessibility settings respected
- [ ] No errors on Windows/Linux

## References

- [Tauri Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)
- [macOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [Project CLAUDE.md](../CLAUDE.md)
```

### Update `CLAUDE.md`

**File:** `CLAUDE.md`

**Add Section After "Recent Features":**

```markdown
#### Phase 008: Native macOS Window Styling (Branch: 008-macos-window-styling)

- **Status**: Implementation in progress
- **Summary**: Transform window appearance to match native macOS applications
- **Key Features**:
  - Transparent title bar with native traffic light controls
  - Sidebar vibrancy effects (blur/translucency)
  - Custom title bar with overlay mode (optional)
  - System theme integration (automatic light/dark mode switching)
  - Window state persistence (position/size)
  - User preference for vibrancy (performance optimization)
  - Accessibility support (reduced transparency, increased contrast)
- **Components**: See `src/components/TitleBar.tsx`, `src/hooks/useMacOSEffects.ts`
- **Configuration**: See `src-tauri/tauri.conf.json` window settings
- **Documentation**: See `docs/macos-window-styling.md`
- **Platform**: macOS only (graceful fallback on Windows/Linux)
- **App Store**: Not compatible (uses private APIs for transparency)
```

---

## Testing Strategy

### Automated Testing

**Unit Tests:**
- Hook functionality (`useMacOSEffects`, `useSystemTheme`, `useWindowState`)
- Component rendering (`TitleBar`, `WindowControls`)
- Platform detection logic

**Integration Tests:**
- Window configuration applied correctly
- Effects applied/removed properly
- Theme changes propagate to UI

### Manual Testing

**macOS Version Matrix:**
| Version | Title Bar | Vibrancy | Theme | Tabbing |
|---------|-----------|----------|-------|---------|
| 10.13   | ✓         | ✓        | ✓     | ✓       |
| 11.x    | ✓         | ✓        | ✓     | ✓       |
| 12.x    | ✓         | ✓        | ✓     | ✓       |
| 13.x    | ✓         | ✓        | ✓     | ✓       |
| 14.x    | ✓         | ✓        | ✓     | ✓       |
| 15.x    | ✓         | ✓        | ✓     | ✓       |

**User Scenarios:**
1. **First Launch:** Window appears with transparent title bar and vibrancy
2. **Theme Switch:** User changes system theme, app updates immediately
3. **Performance Mode:** User disables vibrancy in Settings, effects removed
4. **Window Management:** User moves/resizes window, state persists on restart
5. **Tabbing:** User merges windows, tabs work correctly
6. **Accessibility:** User enables "Reduce transparency", effects disabled

### Performance Testing

**Metrics to Track:**
- Window initialization time
- Effect application latency
- Theme transition smoothness
- Memory usage with effects enabled/disabled
- CPU usage during window operations

**Target Performance:**
- Window launch: < 500ms
- Effect application: < 100ms
- Theme transition: < 300ms
- Memory overhead: < 10MB
- CPU idle: < 1% with effects

### Cross-Platform Testing

**Windows:**
- No errors in console
- Standard window appearance
- No macOS-specific code executing

**Linux:**
- No errors in console
- Standard window appearance
- No macOS-specific code executing

---

## Rollback Strategy

Each phase is independent and can be rolled back individually:

### Phase 1 Rollback
**Revert:** Remove window styling properties from `tauri.conf.json`
```json
{
  "title": "Bucket",
  "width": 1200,
  "height": 800,
  "resizable": true,
  "dragDropEnabled": true
}
```

### Phase 2 Rollback
**Revert:** Remove `useMacOSEffects` hook usage from components
**Remove:** `src/hooks/useMacOSEffects.ts`

### Phase 3 Rollback
**Revert:** Change `titleBarStyle` back to "Transparent" or "Visible"
**Remove:** `src/components/TitleBar.tsx`
**Remove:** TitleBar usage from layout

### Phase 4 Rollback
**Remove:** `src/hooks/useSystemTheme.ts`
**Remove:** Theme detection logic from components

### Phase 5 Rollback
**Revert:** Remove advanced config options
**Remove:** Performance preference hooks
**Remove:** Window state persistence

---

## Success Criteria

### Phase 1
- [x] Window has transparent title bar on macOS
- [x] Traffic lights visible and functional
- [x] No errors on non-macOS platforms

### Phase 2
- [x] Sidebar shows native blur effect
- [x] Effect works in light and dark mode
- [x] Performance acceptable

### Phase 3
- [x] Custom title bar renders correctly
- [x] Window dragging works
- [x] Traffic lights positioned correctly

### Phase 4
- [x] App responds to system theme changes
- [x] Smooth theme transitions
- [x] No visual glitches

### Phase 5
- [x] Window state persists across sessions
- [x] User can disable vibrancy for performance
- [x] Accessibility settings respected
- [x] Works across macOS 10.13 - 15+

---

## Timeline Estimate

**Note:** No specific timelines - focus on incremental delivery

**Suggested Order:**
1. **Phase 1:** Foundation (simple config change)
2. **Phase 2:** Vibrancy (visual enhancement)
3. **Phase 4:** Theme integration (better UX)
4. **Phase 3:** Custom title bar (optional, more complex)
5. **Phase 5:** Polish (optional refinements)

**Dependencies:**
- Phase 3 requires Phase 1 as foundation
- Phase 4 can be done independently
- Phase 5 builds on all previous phases

**Decision Points:**
- After Phase 1: Evaluate visual improvement
- After Phase 2: Assess performance impact
- Before Phase 3: Decide if custom title bar needed
- After Phase 4: Determine if Phase 5 polish is worth effort

---

## Known Limitations

1. **App Store Distribution:** Cannot distribute via App Store with current approach (requires `macOSPrivateApi: true`)

2. **Dragging in Unfocused State:** Known Tauri issue #4316 - dragging may have limitations when window is unfocused with overlay title bar

3. **Title Bar Height:** Varies across macOS versions - may need version-specific adjustments

4. **Performance:** Vibrancy effects can impact performance on older Macs (2015 and earlier)

5. **Windows/Linux:** Features are macOS-only; other platforms get standard window appearance

6. **Testing:** Requires physical Mac hardware for accurate testing (VMs may not render vibrancy correctly)

---

## Resources

### Documentation
- [Tauri v2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)
- [macOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [WebKit CSS Properties](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariCSSRef/Articles/StandardCSSProperties.html)

### Code Examples
- VS Code: Custom title bar implementation
- Figma: Transparent window styling
- Notion: Native macOS integration

### Tauri Resources
- [Tauri GitHub Issues](https://github.com/tauri-apps/tauri/issues)
- [Tauri Discord Community](https://discord.gg/tauri)
- [tauri-plugin-decorum](https://github.com/elicharlese/tauri-plugin-decorum) - Alternative window decoration library

---

## Maintenance

### Regular Checks
- Test on new macOS releases
- Update effects enum for new vibrancy options
- Monitor Tauri changelogs for window API updates
- Track performance metrics over time

### Deprecation Plan
If features become problematic:
1. Add feature flag in Settings
2. Default to disabled for affected users
3. Document workarounds
4. Plan removal timeline

### Version Compatibility
- Minimum macOS: 10.13 (Tauri requirement)
- Recommended: 11+ (best vibrancy support)
- Optimal: 12+ (stable window APIs)

---

## Conclusion

This multi-phase plan provides a structured approach to adding native macOS window styling to Bucket. Each phase delivers incremental value and can stand alone, allowing flexibility in implementation scope and timeline.

**Key Principles:**
- Incremental delivery
- Low-risk changes
- Platform-appropriate fallbacks
- User control over features
- Performance-conscious implementation

**Next Steps:**
1. Review and approve plan
2. Begin Phase 1 implementation
3. Test and validate
4. Gather user feedback
5. Proceed to subsequent phases as needed
