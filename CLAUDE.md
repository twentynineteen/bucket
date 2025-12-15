# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bucket** is a desktop video editing workflow application built with Tauri (Rust + React/TypeScript). It streamlines video ingest, project creation, and integrates with external tools like Adobe Premiere, Trello, and Sprout Video for professional video production workflows.

## Essential Commands

### Development

```bash
bun run dev:tauri          # Start Tauri dev mode with devtools (primary dev command)
bun run dev                # Start Vite dev server only
bun run preview            # Preview production build
```

### Building

```bash
bun run build:tauri        # Build complete desktop app (creates DMG in /target/build/dmg)
bun run build              # Build frontend only
```

### Code Quality (Run Before Committing)

```bash
bun run eslint:fix         # Fix linting issues automatically
bun run prettier:fix       # Format code automatically
bun run test               # Run Vitest test suite
```

### Dependency Management

```bash
bun install                # Install dependencies (standard package manager)
bun update                 # Update dependencies to latest versions
bun audit                  # Security vulnerability scanning
bunx depcheck              # Detect unused dependencies
```

### Package Updates

```bash
# Basic package update commands
npx npm-check-updates                 # Check for available updates
npx npm-check-updates -u             # Update all dependencies to latest
```

## Architecture

### Tech Stack

- **Frontend**: React 18.3 + TypeScript 5.7 + Vite 6.1
- **Backend**: Tauri 2.0 (Rust) with extensive plugin ecosystem
- **UI**: TailwindCSS + Radix UI components + Lucide icons
- **State**: Zustand stores + TanStack React Query (preferred over useEffect)
- **Testing**: Vitest + Testing Library (migrating from Jest)

### Project Structure

```
src/
├── pages/BuildProject/    # Main workflow: file selection, camera assignment, project creation
├── pages/auth/            # Login/registration system
├── pages/                 # Other features: UploadSprout, UploadTrello, Posterframe, Settings
├── components/            # Reusable UI components
├── hooks/                 # Custom hooks (useBreadcrumb, useCameraAutoRemap, etc.)
├── store/                 # Zustand state management (useBreadcrumbStore)
└── utils/                 # Utility functions

src-tauri/
├── src/                   # Rust backend with file operations, API integrations
├── Cargo.toml             # Rust dependencies (tokio, reqwest, serde, argon2, etc.)
└── tauri.conf.json        # Tauri app configuration
```

## Code Conventions

### TypeScript/React

- **Components**: Functional with React.FC typing, PascalCase files
- **Hooks**: Prefix with `use`, custom hooks in `/hooks`
- **State**: Zustand stores (suffix with `Store`) over Context API
- **Data Fetching**: TanStack React Query over useEffect (see migration guide in specs/002-update-legacy-code/)
- **Path Aliases**: `@components/*` → `src/components/*`

### Formatting (Auto-configured)

- **Prettier**: 90 char width, single quotes, no semicolons, no trailing commas
- **Import Sorting**: Automatic with @ianvs/prettier-plugin-sort-imports
- **Tailwind Classes**: Auto-sorted with prettier-plugin-tailwindcss

### File Operations

All file operations go through Tauri backend with progress tracking. Key patterns:

- Progress bars for long-running operations
- Camera assignment validation (1 to numCameras range)
- Secure storage using Tauri's stronghold plugin

## Key Business Logic

### BuildProject Workflow

1. **File Selection**: Multi-select files via Tauri dialog
2. **Camera Assignment**: Validate and assign camera numbers to footage
3. **Project Creation**: Generate folder structure + Adobe Premiere integration
4. **Progress Tracking**: Real-time progress during file operations

### Baker Workflow (NEW - Branch: 003-a-new-feature)

1. **Drive Selection**: Choose root directory for scanning
2. **Structure Validation**: Identify BuildProject-compatible folders (Footage/, Graphics/, Renders/, Projects/, Scripts/)
3. **Breadcrumbs Management**: Update existing or create missing breadcrumbs.json files
4. **Batch Operations**: Apply changes to multiple project folders with progress tracking

### External Integrations

- **Adobe Premiere**: Project template generation
- **Trello**: Project management card updates via REST API (GET /1/cards/{id})
- **Sprout Video**: Video hosting + posterframe generation, thumbnails cached in breadcrumbs

### Recent Features

#### Phase 009: Multi-Theme System (Current - Branch: update/performance)

- **Status**: Implementation Complete
- **Summary**: Comprehensive theme customization system with 8 themes, live preview, and extensible architecture
- **Key Features**:
  - **8 Themes Available**: System, Light, Dark, Dracula, Catppuccin Latte, Frappé, Macchiato, Mocha
  - **Settings Integration**: Dedicated Appearance section in Settings → General
  - **Live Preview**: Hover over themes to preview instantly without applying
  - **Color Swatches**: Visual 4-color preview for each theme
  - **Auto-Save**: Theme selection persists automatically to localStorage
  - **Sidebar Quick Toggle**: Fast light/dark switching with "Customize" link to Settings
  - **Custom Theme Architecture**: Foundation for user-imported JSON themes (future)
  - **Fully Tested**: 29 unit tests covering components, utilities, and constants
- **Components**:
  - [ThemeSelector.tsx](src/components/Settings/ThemeSelector.tsx) - Main theme dropdown with live preview
  - [ThemeColorSwatch.tsx](src/components/Settings/ThemeColorSwatch.tsx) - 4-color preview component
  - [ThemeImport.tsx](src/components/Settings/ThemeImport.tsx) - Custom theme import stub
  - [theme-toggle.tsx](src/components/theme-toggle.tsx) - Enhanced sidebar toggle
- **Hooks**: [useThemePreview.ts](src/hooks/useThemePreview.ts) - Live preview with debouncing
- **Constants**: [themes.ts](src/constants/themes.ts) - Complete theme registry and metadata
- **Utilities**:
  - [themeMapper.ts](src/utils/themeMapper.ts) - Legacy migration (backward compatible)
  - [themeLoader.ts](src/utils/themeLoader.ts) - Dynamic custom theme loading (future)
- **Types**: [customTheme.ts](src/types/customTheme.ts) - Custom theme definitions with Zod validation
- **Styling**: [index.css](src/index.css) - CSS variables for all 8 themes (~200 lines added)
- **Configuration**: [App.tsx](src/App.tsx) - ThemeProvider with all theme IDs registered
- **Documentation**:
  - [theme-customization.md](docs/theme-customization.md) - User guide
  - [theme-architecture.md](docs/theme-architecture.md) - Developer documentation
- **Tests**: 29 passing tests across themes.test.ts, themeMapper.test.ts, ThemeSelector.test.tsx, ThemeColorSwatch.test.tsx
- **Backward Compatibility**: Fully compatible with existing light/dark theme preferences

#### Phase 008: Native macOS Window Styling (Branch: 008-macos-window-styling)

- **Status**: Implementation Complete
- **Summary**: Transform window appearance to match native macOS applications with platform-specific styling
- **Key Features**:
  - Transparent title bar with overlay mode
  - Native macOS traffic light controls positioned at (20, 20)
  - Sidebar vibrancy effects (blur/translucency) using native 'Sidebar' material
  - Custom title bar component with draggable regions
  - System theme integration (automatic light/dark mode switching)
  - Window state persistence (position and size across sessions)
  - Advanced macOS integration (window tabbing, standard click behavior)
  - Graceful fallback on Windows/Linux platforms
- **Components**: [TitleBar.tsx](src/components/TitleBar.tsx)
- **Hooks**: [useMacOSEffects.ts](src/hooks/useMacOSEffects.ts), [useSystemTheme.ts](src/hooks/useSystemTheme.ts), [useWindowState.ts](src/hooks/useWindowState.ts)
- **Configuration**: [tauri.conf.json](src-tauri/tauri.conf.json) with `titleBarStyle: "Overlay"`, `transparent: true`, `trafficLightPosition`
- **Documentation**: [macos-window-styling.md](docs/macos-window-styling.md), [macos-window-styling-plan.md](macos-window-styling-plan.md)
- **Platform**: macOS only (graceful fallback on other platforms)
- **App Store**: Not compatible (uses `macOSPrivateApi: true` for transparency)
- **Phases Implemented**: All 5 phases (transparent title bar, vibrancy, custom overlay, theme integration, advanced polish)

#### Phase 007: AI Script Example Embedding Management (Branch: 007-frontend-script-example)

- **Status**: Implementation Complete
- **Summary**: Frontend interface for managing script examples used in RAG-powered autocue script formatting
- **Key Features**:
  - View all example embeddings (bundled and user-uploaded)
  - Upload custom script examples with automatic embedding generation
  - Replace existing user-uploaded examples
  - Delete user-uploaded examples (bundled examples are protected)
  - Filter examples by source (All, Bundled, Uploaded)
  - Seamless integration with existing RAG system
  - **Database persistence across app updates** (user examples preserved)
- **Components**: See `src/pages/AI/ExampleEmbeddings/`
- **Hooks**: `useExampleManagement`, `useScriptFileUpload`
- **Backend Commands**: `get_all_examples_with_metadata`, `upload_example`, `replace_example`, `delete_example`
- **Database**:
  - SQLite with `source` column to distinguish bundled vs user-uploaded examples
  - Stored in `app_data_dir()` instead of `resource_dir()` to persist across updates
  - Bundled database copied to app data on first run
  - See [database-persistence.md](specs/007-frontend-script-example/database-persistence.md)

#### Phase 004: Multiple Video Links and Trello Cards (Branch: 004-embed-multiple-video)

- **Status**: Phase 1 Design Complete (data models, contracts, tests planned)
- **Summary**: Enhanced breadcrumbs.json to support arrays of video links and Trello cards instead of single values
- **Key Changes**:
  - New `videoLinks[]` array field (replaces implicit single video)
  - New `trelloCards[]` array field (replaces single `trelloCardUrl`)
  - Backward-compatible: Legacy `trelloCardUrl` preserved for old file readers
  - Sprout Video thumbnails cached in breadcrumbs (no real-time API calls)
  - Trello card titles fetched via API and cached (7-day refresh)
- **Data Models**: See `specs/004-embed-multiple-video/data-model.md`
- **API Contracts**: See `specs/004-embed-multiple-video/contracts/tauri-commands.md`
- **User Workflows**: See `specs/004-embed-multiple-video/quickstart.md`

#### Phase 003: Baker Workflow (Branch: 003-a-new-feature - MERGED)

- Folder scanning and breadcrumbs batch management
- Stale breadcrumbs detection and validation
- Detailed change previews before applying updates

#### Phase 002: Legacy Code Modernization (MERGED)

- Migrated from useEffect to TanStack React Query for data fetching
- Refactored large components into focused, reusable pieces
- Improved error handling and loading states

#### Phase 005: Premiere Template Corruption Fix (MERGED)

- Fixed file corruption when copying Premiere Pro templates during project creation
- Root cause: Missing `sync_all()` call after `write_all()` in Rust file I/O
- Solution: Added `file.sync_all()` to guarantee OS buffer flush to disk
- Impact: Eliminated 100% of corruption cases with <100ms performance overhead
- Enhanced error messages with file path and error kind for better debugging
- Files: [premiere.rs](src-tauri/src/commands/premiere.rs)

## Development Notes

- **Main Branch**: `release` (use for PRs)
- **Package Manager**: Bun (used for all development and CI, replaces npm entirely)
- **Platform**: Cross-platform desktop app, primary development on macOS
- **Security**: Uses argon2 for password hashing, JWT for auth, Tauri stronghold for secure storage

## Development Skills

Custom Claude Code skills available in `.claude/skills/` for specialized tasks:

### new-frontend-feature

**Purpose**: Scaffold new frontend pages/features with TDD approach

**When to use**: Creating new pages or tools in the Bucket app

**What it does**:

1. Interactively gathers feature requirements (name, section, icon, description)
2. Generates comprehensive test suite FIRST (90%+ coverage) using test-specialist
3. Creates production-ready page component following BuildProject/Baker patterns
4. Automatically updates routing in app-sidebar.tsx
5. Verifies all tests pass before completion

**Features**:

- TDD workflow (tests before implementation)
- Follows established UI patterns (header, numbered steps, error boundaries)
- Automatic breadcrumb integration
- Smart icon suggestions based on feature name
- Master-detail or multi-step layouts
- Full TypeScript and accessibility support

**Usage**:

```
Use the new-frontend-feature skill to create a [feature name]
```

**Related Skills**:

- `test-specialist`: Comprehensive testing and bug fixing
- `ui-analyzer`: UI consistency audits across pages
- `ux-animation-guru`: Polish animations and micro-interactions
