# Theme Customization Guide

Bucket supports multiple color themes to personalize your workspace. Choose from 13 built-in themes including light, dark, and specialty themes like Dracula, Tokyo Night, Catppuccin variants, Solarized Light, GitHub Light, Nord Light, and One Light.

## Available Themes

### System (Default)
- **Description**: Automatically follows your operating system's light/dark mode preference
- **Best For**: Users who want seamless integration with their OS settings

### Light Themes

#### Light
- **Description**: Clean light theme with high contrast
- **Colors**: White background, dark blue-gray text, blue accents
- **Best For**: Bright environments, daytime work

#### Catppuccin Latte
- **Description**: Warm light theme with soft pastel colors
- **Colors**: Soft gray background, muted text, lavender and blue accents
- **Best For**: Reduced eye strain in bright environments
- **Author**: Catppuccin

#### Solarized Light
- **Description**: Classic warm theme with cream tones and blue accents
- **Colors**: Cream background, dark teal text, blue and cyan accents
- **Best For**: Extended reading and editing sessions
- **Author**: Ethan Schoonover

#### GitHub Light
- **Description**: Clean minimal theme inspired by GitHub
- **Colors**: White background, dark gray text, blue and green accents
- **Best For**: Familiar GitHub-style coding environment
- **Author**: GitHub

#### Nord Light
- **Description**: Cool arctic-inspired theme with muted tones
- **Colors**: Light gray background, dark text, muted blue accents
- **Best For**: Calm, distraction-free working
- **Author**: Arctic Ice Studio

#### One Light
- **Description**: Atom editor's popular warm light theme
- **Colors**: Off-white background, dark gray text, blue and purple accents
- **Best For**: Atom editor fans
- **Author**: Atom

### Dark Themes

#### Dark
- **Description**: Default dark theme with blue tones
- **Colors**: Very dark blue background, light gray text
- **Best For**: Low-light environments, nighttime work

#### Dracula
- **Description**: Dark theme with vibrant purple and pink accents
- **Colors**: Dark gray background, purple primary, pink accents, cyan highlights
- **Best For**: High contrast lovers, vibrant color enthusiasts
- **Author**: Zeno Rocha

#### Tokyo Night
- **Description**: Deep blue dark theme inspired by Tokyo at night
- **Colors**: Deep blue background, soft blue-gray text, cyan and blue accents
- **Best For**: Fans of deep blue-toned dark themes
- **Author**: enkia

#### Catppuccin Frappé
- **Description**: Medium-dark theme with cool blue-gray tones
- **Colors**: Blue-gray background, soft blue and lavender accents
- **Best For**: Balanced contrast without pure black
- **Author**: Catppuccin

#### Catppuccin Macchiato
- **Description**: Medium-dark theme with warm purple undertones
- **Colors**: Warm dark background, purple-tinted accents
- **Best For**: Warm color preference in dark mode
- **Author**: Catppuccin

#### Catppuccin Mocha
- **Description**: Rich dark theme with deep blacks and vibrant accents
- **Colors**: Very dark background, vibrant blue and lavender
- **Best For**: Maximum contrast, OLED screens
- **Author**: Catppuccin

---

## How to Change Themes

### Method 1: Settings Page (Recommended)

1. Navigate to **Settings** → **General** (or click the sidebar icon)
2. Scroll to the **Appearance** section at the top
3. Click the **Theme** dropdown
4. **Hover** over theme names to see a live preview
5. Click a theme to apply it permanently

**Features:**
- Live preview on hover
- Color swatches for visual identification
- Theme descriptions to help you choose
- Changes saved automatically

### Method 2: Sidebar Quick Toggle

1. Locate the theme toggle in the sidebar footer
2. Click **Dark mode** / **Light mode** to quickly switch between light and dark
3. Click **Customize** to open Settings for more theme options

**Note:** The sidebar toggle switches between the default Light and Dark themes only. For specialty themes (Dracula, Catppuccin), use the Settings page.

---

## Theme Preview

All themes support live preview in the Settings page:

1. Open the theme dropdown
2. Hover your mouse over any theme
3. The app instantly applies that theme (without saving)
4. Move your mouse away to restore your current theme
5. Click to permanently apply

---

## Theme Persistence

- Selected theme is saved automatically to your browser's localStorage
- Theme preference persists across:
  - App restarts
  - Window closes
  - System reboots
- No need to manually save

---

## System Theme Behavior

When **System** theme is selected:

- **macOS**: Follows System Preferences → Appearance → Light/Dark
- **Windows**: Follows Settings → Personalization → Colors → Choose your mode
- **Linux**: Follows desktop environment theme settings

The app automatically detects OS theme changes and updates instantly.

---

## Accessibility

All themes have been tested for WCAG AA color contrast compliance:

- Text contrast ratio: ≥4.5:1 (normal text)
- Large text contrast ratio: ≥3:1
- Interactive elements: ≥3:1

**High Contrast Recommendations:**
- **Light**: Best high-contrast light theme
- **Dracula**: Best high-contrast dark theme
- **Catppuccin Mocha**: Excellent for OLED screens

---

## Custom Themes (Coming Soon)

Future versions of Bucket will support custom theme imports:

- Import JSON theme files
- Define your own color palettes
- Share themes with other users
- Save custom themes locally

The architecture is already in place. Stay tuned for this feature!

---

## Troubleshooting

### Theme not applying
1. Refresh the page (Cmd+R / Ctrl+R)
2. Check if the theme is selected in Settings → Appearance
3. Try switching to a different theme, then back

### Live preview not working
1. Ensure you're hovering directly over theme names
2. Try closing and reopening the dropdown
3. Live preview is disabled during theme transitions (wait 0.3s)

### Theme resets on restart
1. Check browser localStorage is enabled
2. Ensure you're not in private/incognito mode
3. Clear browser cache and reselect theme

### Colors look wrong
1. Verify you're on the latest version of Bucket
2. Check if any browser extensions are modifying colors
3. Try a different theme to isolate the issue

---

## Developer Notes

### Theme Storage
- Location: `localStorage` key `"theme"`
- Format: String (theme ID)
- Values: `"system"`, `"light"`, `"dark"`, `"dracula"`, `"tokyo-night"`, `"catppuccin-latte"`, `"catppuccin-frappe"`, `"catppuccin-macchiato"`, `"catppuccin-mocha"`, `"solarized-light"`, `"github-light"`, `"nord-light"`, `"one-light"`

### CSS Variables
All themes use CSS custom properties (variables) defined in `src/index.css`:
- `--background`, `--foreground`
- `--primary`, `--secondary`, `--accent`
- `--destructive`, `--success`, `--warning`, `--info`
- `--border`, `--card`, `--popover`
- Sidebar and chart colors

### Theme Classes
Themes are applied via class names on the `<html>` element:
- `.light`, `.dark`, `.dracula`, `.tokyo-night`
- `.catppuccin-latte`, `.catppuccin-frappe`, `.catppuccin-macchiato`, `.catppuccin-mocha`
- `.solarized-light`, `.github-light`, `.nord-light`, `.one-light`

---

## Credits

- **Dracula**: Created by [Zeno Rocha](https://github.com/dracula/dracula-theme)
- **Tokyo Night**: Created by [enkia](https://github.com/enkia/tokyo-night-vscode-theme)
- **Catppuccin**: Created by the [Catppuccin team](https://github.com/catppuccin/catppuccin)
- **Solarized**: Created by [Ethan Schoonover](https://ethanschoonover.com/solarized/)
- **Nord**: Created by [Arctic Ice Studio](https://www.nordtheme.com/)
- **One Light**: Inspired by [Atom](https://github.com/atom/one-light-syntax)
- **GitHub Light**: Inspired by [GitHub](https://github.com)
- **Light/Dark**: Custom themes by the Bucket team

---

## Feedback

Have a theme suggestion or found an issue?
- Report bugs: [GitHub Issues](https://github.com/your-org/bucket/issues)
- Request themes: Open a feature request
- Share your custom themes: Coming soon!
