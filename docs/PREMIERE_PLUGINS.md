# Premiere Pro Plugin Management

## Overview

Bucket includes an integrated plugin manager for Premiere Pro CEP (Common Extensibility Platform) extensions. Install and update plugins directly from the app without manual file operations.

**Target audience:** Video editors, content creators, developers

**Last updated:** 2025-12-10

**Version:** 1.0.0

---

## Table of Contents

1. [What Are CEP Extensions](#what-are-cep-extensions)
2. [Bundled Plugins](#bundled-plugins)
3. [Installation Process](#installation-process)
4. [Platform Support](#platform-support)
5. [Troubleshooting](#troubleshooting)
6. [Developer Guide](#developer-guide)
7. [Technical Details](#technical-details)

---

## What Are CEP Extensions

CEP (Common Extensibility Platform) extensions are HTML/JavaScript-based plugins that integrate with Adobe Creative Cloud applications. They appear in Premiere Pro's **Window > Extensions** menu and provide custom panels and workflows.

### Key Benefits

- **Native Integration**: Extensions run directly in Premiere Pro's interface
- **Cross-Platform**: Work on both macOS and Windows
- **Auto-Updates**: Bucket can deploy updated versions automatically
- **No Manual Installation**: One-click installation from within Bucket

---

## Bundled Plugins

### BreadcrumbsPremiere v0.6.6

**Purpose**: Metadata management panel for Premiere Pro

**Features**:

- View and edit `breadcrumbs.json` metadata directly in timeline
- Sync with Trello cards and Sprout Video
- Quick access to project resources
- Integrates with Bucket's project management system

**Size**: 605 KB

**Compatibility**: Premiere Pro CC 2020+

---

### Boring v0.5.2

**Purpose**: Premiere Pro extension for streamlined workflows

**Features**:

- Feature 1 (user to specify)
- Feature 2 (user to specify)
- Feature 3 (user to specify)

**Size**: 67 KB

**Compatibility**: Premiere Pro CC 2020+

---

## Installation Process

### Using Bucket's Plugin Manager

1. Open Bucket and navigate to **Upload Content > Premiere Plugin Manager**

2. Browse available plugins - each card shows:
   - Plugin name and version
   - Description and features
   - Installation status
   - File size

3. Click **Install Plugin** button

4. Wait for installation to complete (typically 5-10 seconds)

5. **Restart Premiere Pro** to see the new extension

6. In Premiere Pro, go to **Window > Extensions > [Plugin Name]**

### Verification

After installation, verify the plugin appears:

- **macOS**: `~/Library/Application Support/Adobe/CEP/extensions/[PluginName]/`
- **Windows**: `%AppData%\Roaming\Adobe\CEP\extensions\[PluginName]\`

---

## Platform Support

### macOS

**Requirements**:

- macOS 10.15 (Catalina) or later
- Premiere Pro CC 2020 or later
- CEP debug mode enabled (automatic)

**Installation Path**:

```
~/Library/Application Support/Adobe/CEP/extensions/
```

**Notes**:

- Bucket automatically removes macOS quarantine attributes
- Debug mode is enabled automatically for self-signed extensions
- No additional permissions required

---

### Windows

**Requirements**:

- Windows 10 or later
- Premiere Pro CC 2020 or later

**Installation Path**:

```
C:\Users\<username>\AppData\Roaming\Adobe\CEP\extensions\
```

**Notes**:

- No special permissions required
- Extensions install silently

---

## Troubleshooting

### Plugin Doesn't Appear in Premiere Pro

**Solution 1**: Restart Premiere Pro completely

- Extensions only load at startup
- Use **Premiere Pro > Quit** (not just close windows)

**Solution 2**: Check debug mode (macOS only)

1. In Bucket, go to Plugin Manager
2. Click "Enable Debug Mode"
3. Restart Premiere Pro

**Solution 3**: Verify installation

1. Click "Open Extensions Folder" in Plugin Manager
2. Confirm plugin directory exists
3. Check for `CSXS/manifest.xml` file

---

### Installation Failed Error

**Possible Causes**:

- Premiere Pro is running (close it first)
- Insufficient disk space
- Permissions issues (rare)

**Solution**:

1. Close Premiere Pro completely
2. Free up disk space if needed
3. Try installation again

---

### Self-Signed Extension Warning

**Context**: Bundled plugins use self-signed certificates

**Solution**: Debug mode (enabled automatically) bypasses this warning

---

### Plugin Shows Old Version

**Solution**: Bucket automatically backs up old versions

1. Uninstall old version (manually delete from extensions folder)
2. Reinstall from Bucket
3. Restart Premiere Pro

---

## Developer Guide

### Adding New Plugins to Bucket

#### 1. Export Your Plugin as ZXP

Use the build script from your plugin project:

```bash
npm run package:zxp
```

This creates a signed `.zxp` file (e.g., `MyPlugin_v1.0.0.zxp`)

#### 2. Add to Bucket Assets

Copy the `.zxp` file to:

```
src-tauri/assets/plugins/MyPlugin_v1.0.0.zxp
```

#### 3. Update Plugin Registry

Edit `src-tauri/src/commands/plugins.rs`:

```rust
PluginInfo {
    name: "MyPlugin".to_string(),
    display_name: "My Plugin".to_string(),
    version: "1.0.0".to_string(),
    filename: "MyPlugin_v1.0.0.zxp".to_string(),
    size: 123456, // File size in bytes
    installed: check_plugin_installed_internal("MyPlugin")
        .unwrap_or(false),
    description: "Brief description of your plugin".to_string(),
    features: vec![
        "Feature 1".to_string(),
        "Feature 2".to_string(),
    ],
}
```

#### 4. Rebuild Bucket

```bash
npm run build:tauri
```

---

## Technical Details

### ZXP File Format

ZXP files are **signed ZIP archives** containing:

```
PluginName.zxp
├── CSXS/
│   └── manifest.xml      # Extension metadata, version, compatibility
├── client/               # HTML/CSS/JavaScript panel UI
│   ├── index.html
│   ├── js/
│   └── css/
├── host/ or jsx/         # ExtendScript host scripts
├── assets/               # Images, resources
└── icons/                # Panel icons for Premiere UI
```

### Installation Algorithm

1. Locate CEP extensions directory (platform-specific)
2. Create plugin subdirectory (named after plugin)
3. Backup existing version with timestamp
4. Extract ZXP contents (standard ZIP extraction)
5. Set correct file permissions
6. Remove macOS quarantine attribute (if applicable)
7. Verify `CSXS/manifest.xml` exists
8. Enable debug mode for self-signed extensions (macOS)

### Dependencies

**Rust Crates**:

- `zip` - ZXP extraction (ZXP files are ZIP archives)
- `dirs` - Cross-platform directory paths
- `chrono` - Timestamp generation for backups

**System Requirements**:

- No external tools required (pure Rust implementation)
- No Adobe SDK dependencies
- Works offline

### Security Considerations

- **Signed Extensions**: Plugins use self-signed certificates
- **Debug Mode**: Required for self-signed extensions (safe for local use)
- **Sandboxing**: CEP extensions run in isolated environment
- **No Elevated Permissions**: Installation requires no admin rights

---

## Additional Resources

- [Adobe CEP Documentation](https://github.com/Adobe-CEP/CEP-Resources)
- [Premiere Pro Scripting Guide](https://ppro-scripting.docsforadobe.dev/)
- [ZXP Signing Documentation](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_11.x/Documentation/CEP%2011.1%20HTML%20Extension%20Cookbook.md#signing-extensions)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-10
**Applies to:** Bucket v0.9.7+
