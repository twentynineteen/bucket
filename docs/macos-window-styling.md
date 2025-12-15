# macOS Window Styling

## Overview

Bucket uses native macOS window styling features to provide a seamless, OS-integrated experience. This document covers implementation details, configuration, and troubleshooting.

## Features

### Transparent Title Bar
- Native macOS traffic light controls (red/yellow/green)
- Overlay mode with custom title bar content
- Hidden default title text for custom branding
- Positioned traffic lights at standard macOS location (20, 20)

### Sidebar Vibrancy
- Native blur effects matching Finder, Notes, etc.
- Automatic theme adaptation (light/dark)
- Performance-conscious implementation
- Uses macOS 'Sidebar' effect for authentic appearance

### Custom Title Bar
- Full control over title bar area
- Custom drag regions for window movement
- Interactive elements supported
- 56px height (14 in Tailwind units) with 80px left padding for traffic lights

### System Theme Integration
- Automatic detection of macOS light/dark mode
- Real-time response to system theme changes
- Smooth transitions between themes
- Integration with app's theme system

### Window State Persistence
- Saves window position across sessions
- Saves window size across sessions
- Automatic restoration on app launch
- Stored in localStorage

### Advanced macOS Integration
- Standard macOS click behavior (`acceptFirstMouse: false`)
- Window tabbing support (`tabbingIdentifier: "bucket-app"`)
- Native window management integration

## Configuration

### Tauri Configuration

**File:** `src-tauri/tauri.conf.json`

```json
{
  "app": {
    "macOSPrivateApi": true,  // Required for transparency
    "windows": [
      {
        "titleBarStyle": "Overlay",  // Custom title bar
        "hiddenTitle": true,         // Hide default title
        "decorations": true,         // Keep native controls
        "transparent": true,         // Enable transparency
        "trafficLightPosition": {
          "x": 20.0,                 // Standard macOS position
          "y": 20.0
        },
        "acceptFirstMouse": false,   // Standard macOS behavior
        "tabbingIdentifier": "bucket-app"  // Enable tabbing
      }
    ]
  }
}
```

### React Components

#### Apply Vibrancy to Sidebar

**File:** `src/components/app-sidebar.tsx`

```typescript
import { useMacOSEffects } from '@/hooks/useMacOSEffects'

export function AppSidebar() {
  // Apply macOS sidebar vibrancy effect
  useMacOSEffects({ effects: ['Sidebar'] })

  return (
    <Sidebar>
      {/* ... sidebar content ... */}
    </Sidebar>
  )
}
```

#### Add Title Bar to App

**File:** `src/App.tsx`

```typescript
import { TitleBar } from './components/TitleBar'
import { useWindowState } from './hooks/useWindowState'

const App: React.FC = () => {
  // Persist window position and size
  useWindowState()

  return (
    <Router>
      <TitleBar />
      <AppRouter />
    </Router>
  )
}
```

## Available Hooks

### useMacOSEffects

Apply native macOS vibrancy effects to windows.

**Location:** `src/hooks/useMacOSEffects.ts`

**Usage:**
```typescript
import { useMacOSEffects } from '@/hooks/useMacOSEffects'

function MyComponent() {
  useMacOSEffects({
    effects: ['Sidebar'],      // Effect type
    enabled: true,             // Enable/disable
    adjustForTheme: false      // Adjust based on system theme
  })

  return <div>...</div>
}
```

**Available Effects:**
- `Sidebar` - Sidebar blur (recommended for navigation)
- `ContentBackground` - Standard content background
- `UnderWindowBackground` - Content beneath windows
- `WindowBackground` - Standard window background
- `HeaderView` - Header view material
- `Menu` - Menu material
- `Popover` - Popover material
- `Tooltip` - Tooltip material
- `Sheet` - Sheet material
- `HudWindow` - Heads-up display window
- `FullScreenUI` - Full-screen interface

### useSystemTheme

Detect and respond to macOS system theme changes.

**Location:** `src/hooks/useSystemTheme.ts`

**Usage:**
```typescript
import { useSystemTheme } from '@/hooks/useSystemTheme'

function MyComponent() {
  const theme = useSystemTheme()  // 'light' | 'dark' | null

  useEffect(() => {
    if (theme) {
      console.log('System theme:', theme)
    }
  }, [theme])

  return <div>...</div>
}
```

### useWindowState

Persist window position and size across sessions.

**Location:** `src/hooks/useWindowState.ts`

**Usage:**
```typescript
import { useWindowState } from '@/hooks/useWindowState'

function App() {
  useWindowState()  // Automatically saves and restores window state

  return <div>...</div>
}
```

## Components

### TitleBar

Custom title bar component for macOS overlay mode.

**Location:** `src/components/TitleBar.tsx`

**Features:**
- Only renders on macOS
- Draggable window area
- 80px left padding for traffic lights
- Fixed positioning at top of window
- Semi-transparent background with backdrop blur

**Customization:**
```typescript
// Edit src/components/TitleBar.tsx to add custom elements
<div style={{ WebkitAppRegion: 'no-drag' }}>
  {/* Add custom controls, search, etc. */}
</div>
```

## Troubleshooting

### Traffic Lights Not Visible

**Symptoms:** Red/yellow/green buttons missing

**Solutions:**
- Ensure `decorations: true` in `tauri.conf.json`
- Check `titleBarStyle` is set to "Overlay" or "Transparent"
- Verify `trafficLightPosition` coordinates are positive numbers (20.0, 20.0)
- Restart the app after config changes

### Vibrancy Not Appearing

**Symptoms:** No blur effect on sidebar

**Solutions:**
- Confirm `macOSPrivateApi: true` in `tauri.conf.json`
- Check macOS System Settings > Accessibility > Display > "Reduce transparency" is OFF
- Verify effects are only applied on macOS platform
- Check browser console for error messages
- Try different effect types (e.g., 'WindowBackground' instead of 'Sidebar')

### Window Dragging Not Working

**Symptoms:** Cannot drag window from title bar

**Solutions:**
- Ensure drag region has `WebkitAppRegion: 'drag'` style
- Check interactive elements (buttons, links) have `WebkitAppRegion: 'no-drag'`
- Verify `data-tauri-drag-region` attribute is present
- Test in both focused and unfocused window states
- Check CSS in `src/index.css` for drag region styles

### Window Position Not Persisting

**Symptoms:** Window position resets on restart

**Solutions:**
- Verify `useWindowState()` is called in App component
- Check browser localStorage for 'bucket-window-state' key
- Look for console warnings about save/restore failures
- Ensure window move/resize events are firing

### Performance Issues

**Symptoms:** Slow rendering, high CPU usage

**Solutions:**
- Disable vibrancy effects temporarily to test
- Check macOS Activity Monitor for CPU usage
- Test on different macOS versions
- Consider using fewer simultaneous effects
- Verify hardware acceleration is enabled
- Check for other resource-intensive processes

### Theme Not Switching

**Symptoms:** App doesn't respond to macOS theme changes

**Solutions:**
- Verify `useSystemTheme()` hook is imported and used
- Check theme listener is properly attached
- Look for console errors related to window.theme()
- Test by manually changing macOS theme in System Settings
- Ensure ThemeProvider is properly configured

## App Store Compatibility

**⚠️ Important:** Current implementation uses `macOSPrivateApi: true`, which **prevents App Store distribution**.

### To Enable App Store Distribution:

1. Set `macOSPrivateApi: false` in `tauri.conf.json`
2. Remove `transparent: true` from window config
3. Change `titleBarStyle` to `"Visible"` (standard macOS title bar)
4. Remove vibrancy effects (or accept they won't work)
5. Remove custom TitleBar component
6. Test thoroughly with new configuration

### Alternative Approach (App Store Compatible):

```json
{
  "app": {
    "macOSPrivateApi": false,
    "windows": [
      {
        "titleBarStyle": "Visible",
        "hiddenTitle": false,
        "decorations": true,
        "transparent": false
      }
    ]
  }
}
```

This provides a standard macOS window without custom styling but is App Store compliant.

## Platform Support

### macOS
- **Full feature set:** ✅ All features available
- **Minimum version:** 10.13 (High Sierra)
- **Recommended:** 11+ (Big Sur) for best vibrancy support
- **Optimal:** 12+ (Monterey) for stable window APIs

### Windows
- **Graceful fallback:** Standard window appearance
- **Title bar:** Not rendered (returns null)
- **Effects:** Skipped (platform check)
- **No errors:** Platform detection prevents issues

### Linux
- **Graceful fallback:** Standard window appearance
- **Title bar:** Not rendered (returns null)
- **Effects:** Skipped (platform check)
- **No errors:** Platform detection prevents issues

## Testing Checklist

### Visual Testing
- [ ] Window has transparent title bar on macOS
- [ ] Traffic lights visible at (20, 20) position
- [ ] Sidebar shows vibrancy/blur effect
- [ ] Custom title bar renders correctly
- [ ] Title bar is draggable
- [ ] Interactive elements in title bar work (no-drag)

### Theme Testing
- [ ] App responds to System Settings > Appearance changes
- [ ] Light to dark transition is smooth (300ms)
- [ ] Dark to light transition is smooth (300ms)
- [ ] Vibrancy adapts to theme
- [ ] No visual glitches during transition

### Window State Testing
- [ ] Window position persists after restart
- [ ] Window size persists after restart
- [ ] Window state saved in localStorage
- [ ] Restore works on first launch

### Platform Testing
- [ ] macOS: All features work
- [ ] Windows: No errors, standard window
- [ ] Linux: No errors, standard window
- [ ] Cross-platform build succeeds

### Performance Testing
- [ ] Window launch time < 500ms
- [ ] Effect application < 100ms
- [ ] Theme transition < 300ms
- [ ] Memory overhead < 10MB
- [ ] CPU idle < 1% with effects

### Accessibility Testing
- [ ] Respects "Reduce transparency" setting
- [ ] Respects "Increase contrast" setting
- [ ] Respects "Reduce motion" setting
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

### macOS Version Testing
- [ ] macOS 10.13 (High Sierra)
- [ ] macOS 11 (Big Sur)
- [ ] macOS 12 (Monterey)
- [ ] macOS 13 (Ventura)
- [ ] macOS 14 (Sonoma)
- [ ] macOS 15 (Sequoia)

## Implementation Files

### Configuration
- `src-tauri/tauri.conf.json` - Window configuration

### Components
- `src/components/TitleBar.tsx` - Custom title bar
- `src/components/app-sidebar.tsx` - Sidebar with vibrancy

### Hooks
- `src/hooks/useMacOSEffects.ts` - Vibrancy effects
- `src/hooks/useSystemTheme.ts` - Theme detection
- `src/hooks/useWindowState.ts` - Window persistence

### Styles
- `src/index.css` - Drag regions and transitions

### Root
- `src/App.tsx` - Main app with hooks integration

## Best Practices

### Do's
✅ Use platform detection before applying macOS features
✅ Provide fallback for non-macOS platforms
✅ Test on multiple macOS versions
✅ Respect user accessibility preferences
✅ Use semantic effect names (Sidebar, ContentBackground)
✅ Clean up effect listeners on unmount
✅ Handle errors gracefully (try/catch with warnings)

### Don'ts
❌ Don't apply effects without platform check
❌ Don't ignore accessibility settings
❌ Don't use deprecated effect types
❌ Don't forget to set WebkitAppRegion for drag areas
❌ Don't apply too many simultaneous effects
❌ Don't assume traffic light positioning works everywhere
❌ Don't forget App Store restrictions if planning distribution

## Performance Optimization

### Reduce Effect Overhead
- Use single effect per area (avoid multiple simultaneous effects)
- Apply effects only where needed (sidebar, not entire window)
- Consider disabling on older hardware (2015 and earlier)

### Optimize Theme Transitions
- Use CSS transitions for smooth changes (300ms)
- Debounce rapid theme switches if needed
- Minimize re-renders during theme changes

### Window State Efficiency
- Debounce save operations if needed (currently saves on every move/resize)
- Consider throttling window state updates
- Clear old states if storage gets large

## Future Enhancements

### Potential Improvements
- User preference toggle for vibrancy (Settings page)
- Dynamic traffic light positioning on resize
- Multiple window support with independent states
- Adaptive effect intensity based on performance
- Custom window controls (minimize, maximize, close)
- Full-screen mode optimizations

### Known Limitations
1. **App Store Distribution:** Requires private APIs
2. **Dragging Unfocused:** Known Tauri issue #4316
3. **Title Bar Height:** Varies across macOS versions
4. **Performance:** Impact on older Macs (pre-2015)
5. **Testing:** Requires physical Mac hardware

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

### Project Documentation
- [CLAUDE.md](../CLAUDE.md) - Project overview and conventions
- [macos-window-styling-plan.md](../macos-window-styling-plan.md) - Implementation plan

## Maintenance

### Regular Checks
- Test on new macOS releases (beta and stable)
- Update effects enum for new vibrancy options
- Monitor Tauri changelogs for window API updates
- Track performance metrics over time
- Review user feedback and bug reports

### Version Compatibility
- **Minimum macOS:** 10.13 (Tauri requirement)
- **Recommended:** 11+ (best vibrancy support)
- **Optimal:** 12+ (stable window APIs)
- **Latest tested:** 15 (Sequoia)

## Support

### Getting Help
- Check this documentation first
- Review the implementation plan: [macos-window-styling-plan.md](../macos-window-styling-plan.md)
- Search Tauri GitHub issues
- Ask in Tauri Discord #help channel
- Review browser console for error messages

### Reporting Issues
When reporting issues, include:
- macOS version
- Steps to reproduce
- Expected vs actual behavior
- Console error messages
- Screenshots if applicable
- Relevant configuration (tauri.conf.json)

---

**Last Updated:** 2025-12-10
**Implementation Version:** 1.0.0
**Tauri Version:** 2.0+
