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

- **Frontend**: React 19.2 + TypeScript 5.9 + Vite 7.3
- **Backend**: Tauri 2.0 (Rust) with extensive plugin ecosystem
- **UI**: TailwindCSS + Radix UI components + Lucide icons
- **State**: Zustand stores + TanStack React Query (preferred over useEffect)
- **Testing**: Vitest + Testing Library
- **Bundling**: Lazy-loaded routes with React.lazy() + Suspense

### Module Map

```
src/
+-- features/
|   +-- AITools/       # ScriptFormatter + ExampleEmbeddings (api.ts, 2 barrel exports)
|   +-- Baker/         # Drive scanning, breadcrumbs management (api.ts, 24 barrel exports)
|   +-- BuildProject/  # File ingest, camera assignment, XState machine + stages (api.ts)
|   +-- Premiere/      # Adobe Premiere plugin management (api.ts, 1 barrel export)
|   +-- Settings/      # App configuration with per-domain tabs (api.ts, 3 barrel exports)
|   +-- Trello/        # Trello card management, video links (api.ts, 29 barrel exports)
|   +-- Upload/        # Sprout Video, Posterframe, Otter (api.ts, 17 barrel exports)
|
+-- shared/
|   +-- constants/     # Timing, animation, project constants (26 exports)
|   +-- hooks/         # Cross-feature hooks: breadcrumb, search, API keys, mobile (8 exports)
|   +-- lib/           # Query infrastructure: keys, client, utils, prefetch, perf (50 exports)
|   +-- services/      # ProgressTracker, feedback, cache services (5 exports)
|   +-- store/         # Zustand stores: appStore, breadcrumbStore (3 exports)
|   +-- types/         # Shared domain types: media, script, breadcrumbs (41 exports)
|   +-- ui/            # Radix primitives, sidebar, theme, layout (direct imports, NO barrel)
|   +-- utils/         # Logger, storage, validation, cn(), breadcrumbs utils (29 exports)

src-tauri/
+-- src/               # Rust backend with file operations, API integrations
+-- Cargo.toml         # Rust dependencies (tauri, tokio, reqwest, serde, etc.)
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

A feature may add subdirectories of its own beneath this -- `BuildProject/` has `machine/`
(its XState machine), `stages/` (the workflow stage functions) and a `types/` directory in
place of `types.ts`. What it may **not** do is become a second top-level module: one feature,
one directory under `src/features/`, PascalCase, with a single `api.ts` at its root. A feature
spread over two modules puts half of itself outside the reach of its own contract tests, which
is exactly how a module with seven direct `@tauri-apps` imports went unnoticed (#208).

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

Each feature has `__contracts__/` verifying the module boundary. Keep these thin -- they guard
the architecture, not the features.

- **Shape tests**: Verify the barrel exports the names other modules import, and their type
  signatures. Assert named exports individually. Never assert a total export count.
- **Behavioural tests**: Verify hooks return the documented shape and that `api.ts` calls the
  correct Tauri command.
- **No-bypass tests**: Grep source files to ensure zero direct `@tauri-apps` imports (all I/O through api.ts)

A contract test earns its place only if breaking it means another module breaks. If it would
only break a refactor, it belongs in a unit test, or nowhere.

## Testing Policy

The suite is green and runs in under 30 seconds. Protect both properties. Every rule here
exists because of something already in this repo, not as general advice.

### The proportionality question

Before writing a test, answer this: **what behaviour breaks for a user if this test is
deleted?** If the answer is "nothing, but a refactor would have to update it", do not write it.
Tests that describe the current shape of the code make refactoring expensive and catch no
defects.

The suite is currently around 54k lines of test against 40k lines of source. That ratio is not
a target to defend or to grow. Prefer deleting a weak test over adding a second one beside it.

### Where tests live

One location per kind. Do not introduce a new convention.

| Kind        | Location                                        | Purpose                          |
| ----------- | ----------------------------------------------- | -------------------------------- |
| Unit        | Colocated `*.test.ts(x)` beside the source file  | One module's behaviour           |
| Contract    | `src/features/<Name>/__contracts__/`             | Module boundary guarantees       |
| Integration | `tests/integration/`                             | Two or more modules together     |
| E2E         | `tests/e2e/`                                     | Playwright, against the real app |

`tests/unit/`, `tests/component/`, `tests/lib/`, `tests/contract/` and `__tests__/` are legacy
locations that predate this policy. Do not add files to them. When you are already editing a
file that has a test in a legacy location, move that test to the colocated position rather than
growing it in place.

### Do not write these

Each pattern below exists in the repo today and each is a net negative.

**Export-count assertions.** A legitimate new export should never fail a test.

```typescript
// BAD -- breaks on every legitimate addition, verifies no behaviour
expect(Object.keys(bakerApi)).toHaveLength(29)

// GOOD -- asserts the guarantee that actually matters to callers
expect(typeof bakerApi.scanDrive).toBe('function')
```

**Tests that mock every child they render.** If everything is mocked, the assertion only proves
the mocks were called. It passes when the real component is broken.

```typescript
// BAD -- mocks AppSidebar, then asserts the mock rendered
vi.mock('@shared/ui/layout/app-sidebar', () => ({ AppSidebar: () => <div>AppSidebar</div> }))
expect(screen.getByText('AppSidebar')).toBeInTheDocument()

// GOOD -- mock only the I/O boundary, then assert what a user would see
vi.mock('@tauri-apps/api', () => ({ core: { invoke: async () => 'alice' } }))
expect(await screen.findByRole('button', { name: /alice/i })).toBeInTheDocument()
```

**Soft checks.** A test that logs violations and passes regardless is not a test. Either assert
the rule or delete the test. `tests/integration/us11-boundary-integrity.test.ts` currently does
this and should be fixed rather than copied.

**"Renders without crashing" as the only assertion.** Name what it should render.

**A second test file for a unit that already has one.** The sidebar currently has five files and
roughly 3,900 lines across two locations. Extend the existing file instead.

### Mocks must resolve

`vi.mock()` pointed at a path that no longer exists fails silently and the test still passes.
Only the `@features/*`, `@shared/*` and `@tests/*` aliases exist; `@/` was removed and
`src/pages/` no longer exists. Confirm the module is really there before mocking it.

### Deleting tests

Delete a test when it asserts a shape rather than a behaviour, duplicates an existing test,
mocks the thing it claims to verify, or has needed updating more than once for reasons
unrelated to a real defect. Removing such a test is a fix, not a regression -- say so plainly in
the PR body.

Do not delete a test because it is failing. A failing test is either a real defect or a wrong
assertion, and you must state which before touching it.

### Before calling test work done

Walk this list and say which entries applied:

1. Does a test already exist for this unit? Extend it rather than adding a file.
2. Is every `vi.mock()` path resolvable?
3. Does each new test actually fail when you break the behaviour it names? Verify by breaking it.
4. Is the test in the correct location from the table above?
5. Does `bun run test:run` still finish in under 30 seconds?

These are good defaults, not hard rules. A developer's explicit instruction overrides anything
in this section.

## How to Add a New Feature Module

1. **Create directory**: `src/features/MyFeature/`
2. **Create `api.ts`**: Wrap all Tauri invoke/plugin calls as the single I/O boundary
3. **Create `types.ts`**: Define shared type definitions for the module
4. **Create page/hook/component files** in `components/`, `hooks/` subdirectories
5. **Create `index.ts` barrel**: Re-export public API with JSDoc on every export
6. **Create `__contracts__/`** with shape + behavioural + no-bypass tests, following the
   [Testing Policy](#testing-policy). Keep them thin and assert named exports, never counts
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
3. **Project Creation**: Generate folder structure + Adobe Premiere integration, orchestrated by
   the XState machine in `BuildProject/machine/buildProjectMachine.ts` over the stage functions
   in `BuildProject/stages/`
4. **Progress Tracking**: Real-time progress during file operations, via the throttled
   `transfer_files_with_progress` command and its `file-transfer-*` events

The page composes the machine through `useBuildProject`; the machine and stages reach Tauri
only through `BuildProject/api.ts`.

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

- **Main Branch**: `master` (use for PRs)
- **Package Manager**: Bun (used for all development and CI, replaces npm entirely)
- **Platform**: Cross-platform desktop app, primary development on macOS
- **Security**: The app has **no authentication**. It is a single-user local desktop tool, there is
  no login, no user account and no password anywhere in the codebase. Third-party credentials
  (Sprout, Trello, AI providers) are stored **unencrypted** in `api_keys.json` in the app data
  directory, protected only by the OS file permissions of the user's account. Do not assume
  hashing, token signing or an encrypted keystore exists -- none does. Anything that needs one has
  to add it.
- **Themes**: 13 themes available (System, Light, Dark, Dracula, Tokyo Night, Catppuccin variants, Solarized Light, GitHub Light, Nord Light, One Light) via `@shared/ui/theme/`
- **Window**: Native macOS title bar with traffic lights, vibrancy effects, window state persistence
