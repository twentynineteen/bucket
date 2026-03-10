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
npx npm-check-updates                 # Check for available updates
npx npm-check-updates -u             # Update all dependencies to latest
```

## Module Architecture

### Tech Stack

- **Frontend**: React 18.3 + TypeScript 5.7 + Vite 6.1
- **Backend**: Tauri 2.0 (Rust) with extensive plugin ecosystem
- **UI**: TailwindCSS + Radix UI components + Lucide icons
- **State**: Zustand stores + TanStack React Query (preferred over useEffect)
- **Testing**: Vitest + Testing Library
- **Bundling**: Lazy-loaded routes with React.lazy() + Suspense

### Module Map

```
src/
+-- features/
|   +-- AITools/       # ScriptFormatter + ExampleEmbeddings (api.ts, 6 barrel exports)
|   +-- Auth/          # Login, registration, token management (api.ts, 6 barrel exports)
|   +-- Baker/         # Drive scanning, breadcrumbs management (api.ts, 21 barrel exports)
|   +-- BuildProject/  # File ingest, camera assignment, XState (api.ts, 3 barrel exports)
|   +-- Premiere/      # Adobe Premiere plugin management (api.ts, 3 barrel exports)
|   +-- Settings/      # App configuration with per-domain tabs (api.ts, 3 barrel exports)
|   +-- Trello/        # Trello card management, video links (api.ts, 32 barrel exports)
|   +-- Upload/        # Sprout Video, Posterframe, Otter (api.ts, 19 barrel exports)
|
+-- shared/
|   +-- constants/     # Timing, animation, project constants (27 exports)
|   +-- hooks/         # Cross-feature hooks: breadcrumb, search, API keys, mobile (7 exports)
|   +-- lib/           # Query infrastructure: keys, client, utils, prefetch, perf (50 exports)
|   +-- services/      # ProgressTracker, feedback, cache services (16 exports)
|   +-- store/         # Zustand stores: appStore, breadcrumbStore (2 exports)
|   +-- types/         # Shared domain types: media, script, breadcrumbs (34 exports)
|   +-- ui/            # Radix primitives, sidebar, theme, layout (direct imports, NO barrel)
|   +-- utils/         # Logger, storage, validation, cn(), breadcrumbs utils (30 exports)

src-tauri/
+-- src/               # Rust backend with file operations, API integrations
+-- Cargo.toml         # Rust dependencies (tokio, reqwest, serde, argon2, etc.)
+-- tauri.conf.json    # Tauri app configuration
```

### Dependency Diagram

Feature modules import from `@shared/*` and from other feature barrels via `@features/*`.
Shared modules NEVER import from features.

```
                    +-- @shared/* --+
                    |               |
        +-----------+-----------+   |
        |     |     |     |     |   |
     constants hooks lib services store types utils ui
        ^     ^     ^     ^       ^   ^     ^     ^
        |     |     |     |       |   |     |     |
  +-----+-----+-----+-----+------+---+-----+-----+---+
  |                                                    |
  |  +-- @features/* (cross-feature via barrel only) --|
  |  |                                                 |
  |  |   Trello <------> Baker (bidirectional types)   |
  |  |   Trello -------> BuildProject (VideoInfoData)  |
  |  |   Trello -------> Upload (Sprout hooks)         |
  |  |   Baker ---------> Trello (integration hooks)   |
  |  |   Baker ---------> BuildProject (FootageFile)   |
  |  |   Upload --------> Baker (VideoLink type)       |
  |  |   Settings ------> Trello (TrelloBoardSelector) |
  |  |   AITools -------> Settings (useAIProvider)     |
  |  |   BuildProject --> Trello (TrelloCardsManager)  |
  |  |                                                 |
  +--+-------------------------------------------------+
```

## Module Conventions

### Feature Module Anatomy

Each feature module in `src/features/<Name>/` follows this structure:

```
<Name>/
+-- api.ts              # I/O boundary -- wraps ALL Tauri invoke/plugin calls
+-- types.ts            # Shared type definitions for the module
+-- index.ts            # Barrel file -- named re-exports with JSDoc
+-- __contracts__/      # Contract tests: shape, behavioral, no-bypass
+-- components/         # React components
+-- hooks/              # React hooks
+-- internal/           # Internal utilities (NOT exported from barrel)
```

### Import Rules

1. **Features import shared** via `@shared/*` barrel imports (e.g., `import { logger } from '@shared/utils'`)
2. **Features import other features** via `@features/*` barrel only (e.g., `import { TrelloCardsManager } from '@features/Trello'`)
3. **Shared NEVER imports features** -- dependency flows one direction
4. **No direct Tauri plugin imports** in components/hooks -- all I/O goes through `api.ts`
5. **shared/ui/ has NO barrel files** -- use direct imports (e.g., `@shared/ui/button`, `@shared/ui/sidebar/Sidebar`)

### Path Aliases

Only three aliases exist in tsconfig.json:

- `@features/*` -- `src/features/*`
- `@shared/*` -- `src/shared/*`
- `@tests/*` -- `tests/*`

### Barrel Convention

- Named re-exports only (no wildcard `export *`)
- JSDoc one-liner on every export describing purpose
- Internal utilities stay in `internal/` directory, never exported from barrel
- Tauri-dependent hooks that crash in test environments are excluded from barrels (import directly instead)

### Contract Tests

Each feature has `__contracts__/` with three test types:

- **Shape tests**: Verify export counts and type signatures from the barrel
- **Behavioral tests**: Verify hooks return expected shapes, api.ts calls correct functions
- **No-bypass tests**: Grep source files to ensure zero direct `@tauri-apps` imports (all I/O through api.ts)

## How to Add a New Feature Module

1. **Create directory**: `src/features/MyFeature/`
2. **Create `api.ts`**: Wrap all Tauri invoke/plugin calls as the single I/O boundary
3. **Create `types.ts`**: Define shared type definitions for the module
4. **Create page/hook/component files** in `components/`, `hooks/` subdirectories
5. **Create `index.ts` barrel**: Re-export public API with JSDoc on every export
6. **Create `__contracts__/`** with shape + behavioral + no-bypass tests
7. **Add lazy route** in `AppRouter.tsx` using `React.lazy()` pattern:
   ```typescript
   const MyFeaturePage = React.lazy(() => import('@features/MyFeature').then(m => ({ default: m.MyFeaturePage })))
   ```
8. **Update `app-sidebar.tsx`** navigation with new menu item
9. **Run `bun run eslint:fix`** to verify ESLint boundary compliance

## Code Conventions

### TypeScript/React

- **Components**: Functional with React.FC typing, PascalCase files
- **Hooks**: Prefix with `use`, custom hooks in feature `hooks/` directory
- **State**: Zustand stores (suffix with `Store`) over Context API
- **Data Fetching**: TanStack React Query over useEffect
- **Confirmations**: Radix AlertDialog for destructive actions, Sonner toasts for notifications
- **File Operations**: All through Tauri backend via feature `api.ts` with progress tracking

### Formatting (Auto-configured)

- **Prettier**: 90 char width, single quotes, no semicolons, no trailing commas
- **Import Sorting**: Automatic with @ianvs/prettier-plugin-sort-imports
- **Tailwind Classes**: Auto-sorted with prettier-plugin-tailwindcss

## Key Business Logic

### BuildProject Workflow

1. **File Selection**: Multi-select files via Tauri dialog (through `@features/BuildProject` api.ts)
2. **Camera Assignment**: Validate and assign camera numbers to footage
3. **Project Creation**: Generate folder structure + Adobe Premiere integration (XState machine)
4. **Progress Tracking**: Real-time progress during file operations

### Baker Workflow

1. **Drive Selection**: Choose root directory for scanning
2. **Structure Validation**: Identify BuildProject-compatible folders (Footage/, Graphics/, Renders/, Projects/, Scripts/)
3. **Breadcrumbs Management**: Update existing or create missing breadcrumbs.json files
4. **Batch Operations**: Apply changes to multiple project folders with progress tracking

### External Integrations

- **Adobe Premiere**: Project template generation (`@features/Premiere`)
- **Trello**: Project management card updates via REST API (`@features/Trello`)
- **Sprout Video**: Video hosting + posterframe generation (`@features/Upload`)

## Development Notes

- **Main Branch**: `main` (use for PRs)
- **Package Manager**: Bun (used for all development and CI, replaces npm entirely)
- **Platform**: Cross-platform desktop app, primary development on macOS
- **Security**: Uses argon2 for password hashing, JWT for auth, Tauri stronghold for secure storage
- **Themes**: 8 themes available (System, Light, Dark, Dracula, Catppuccin variants) via `@shared/ui/theme/`
- **Window**: Native macOS title bar with traffic lights, vibrancy effects, window state persistence
