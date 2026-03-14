# Architecture

**Analysis Date:** 2026-03-07

## Pattern Overview

**Overall:** Tauri Desktop Application (Rust Backend + React Frontend) with Event-Driven IPC

**Key Characteristics:**
- Two-process architecture: Rust backend handles file I/O, API calls, and system operations; React frontend handles UI rendering and user interaction
- Frontend-to-backend communication via Tauri `invoke()` commands (synchronous request/response) and Tauri event system (async, push-based)
- Frontend state management combines Zustand stores (global app state), XState machines (complex workflows), and TanStack React Query (server/async state)
- Hook-heavy architecture: business logic lives in custom hooks, components are thin rendering layers
- Master-detail and multi-step wizard UI patterns for primary workflows

## Layers

**Presentation Layer (React Components):**
- Purpose: Render UI, handle user interactions, compose layout
- Location: `src/components/`, `src/pages/`
- Contains: React functional components, UI primitives (Radix), page-level compositions
- Depends on: Hooks layer, Store layer, UI component library
- Used by: Router (`src/AppRouter.tsx`)

**Hooks Layer (Business Logic):**
- Purpose: Encapsulate all business logic, data fetching, side effects, and Tauri command invocations
- Location: `src/hooks/`
- Contains: 80+ custom hooks handling data fetching, state management, Tauri IPC, form logic
- Depends on: Tauri API (`@tauri-apps/api/core`), Zustand stores, TanStack React Query, XState machines
- Used by: Page components, other hooks

**State Management Layer:**
- Purpose: Global application state and complex workflow state
- Location: `src/store/`, `src/machines/`, `src/context/`
- Contains:
  - `src/store/useAppStore.ts` - Global app state (API keys, breadcrumbs, settings)
  - `src/store/useBreadcrumbStore.ts` - UI breadcrumb navigation state
  - `src/machines/buildProjectMachine.ts` - XState state machine for BuildProject workflow
  - `src/context/AuthProvider.tsx` - Authentication context
- Depends on: Zustand, XState, React Context
- Used by: Hooks, Components

**Query Infrastructure Layer:**
- Purpose: Data fetching patterns, caching, cache invalidation, prefetching
- Location: `src/lib/`
- Contains:
  - `src/lib/query-keys.ts` - Centralized query key factory with domain-based namespacing
  - `src/lib/query-utils.ts` - Query utility types and helpers
  - `src/lib/prefetch-strategies.ts` - Startup prefetch orchestration
  - `src/lib/performance-monitor.ts` - Query performance monitoring
  - `src/lib/query-client-config.ts` - QueryClient configuration
- Depends on: TanStack React Query
- Used by: Hooks layer

**Services Layer:**
- Purpose: Cross-cutting infrastructure services
- Location: `src/services/`
- Contains:
  - `src/services/cache-invalidation.ts` - Cache invalidation service
  - `src/services/ProgressTracker.ts` - Progress tracking for long operations
  - `src/services/UserFeedbackService.ts` - User notification service
- Depends on: TanStack React Query
- Used by: App initialization (`src/App.tsx`), hooks

**Utility Layer:**
- Purpose: Pure utility functions, type definitions, validation
- Location: `src/utils/`, `src/types/`, `src/constants/`
- Contains: Logger, validators, type definitions, theme utilities, breadcrumbs helpers
- Depends on: Nothing (pure functions)
- Used by: All frontend layers

**Rust Backend (Tauri Commands):**
- Purpose: System-level operations, file I/O, external API calls, database access
- Location: `src-tauri/src/`
- Contains:
  - `src-tauri/src/commands/` - Tauri command handlers (9 modules)
  - `src-tauri/src/baker/` - Baker workflow logic (scanning, breadcrumbs, video links)
  - `src-tauri/src/state/` - Backend state (auth tokens)
  - `src-tauri/src/utils/` - File copy with progress tracking
  - `src-tauri/src/media.rs` - Media type definitions (VideoLink, TrelloCard)
- Depends on: Tauri framework, reqwest, rusqlite, serde, tokio
- Used by: Frontend via `invoke()` and event listeners

## Data Flow

**BuildProject Workflow (XState-driven):**

1. User configures project (title, cameras, folder) via `useProjectState()` hook
2. User adds footage files via `useFileSelection()` / Tauri file dialog
3. Camera assignments auto-remap via `useCameraAutoRemap()` hook
4. User clicks "Create Project" - calls `useCreateProjectWithMachine()` hook
5. Hook sends events to XState machine (`buildProjectMachine`): `START_PROJECT` -> `VALIDATION_SUCCESS` -> `FOLDERS_CREATED` -> `BREADCRUMBS_SAVED` -> `FILES_MOVING`
6. Rust backend `move_files` command copies files in a spawned thread
7. Backend emits `copy_progress` events via Tauri event system
8. `useBuildProjectMachine()` hook listens to Tauri events and feeds them into XState machine
9. On completion, `copy_complete` event triggers `COPY_COMPLETE` transition to `creatingTemplate`
10. `usePostProjectCompletion()` hook handles Premiere template creation and success dialog

**Baker Scan Workflow (Async polling):**

1. User selects root directory via `FolderSelector` component
2. `useBakerScan()` hook invokes `baker_start_scan` Tauri command
3. Rust backend scans filesystem for valid project folders (contain Footage/, Graphics/, etc.)
4. Backend emits `scan_progress` events; frontend polls `baker_get_scan_status`
5. Results populate master-detail UI: project list (left) + breadcrumbs viewer (right)
6. User selects projects for batch breadcrumbs update
7. `useBreadcrumbsPreview()` generates diff previews
8. `useBreadcrumbsManager()` invokes `baker_update_breadcrumbs` for batch writes

**Frontend-Backend IPC Pattern:**

1. Frontend hook calls `invoke('command_name', { args })` from `@tauri-apps/api/core`
2. Rust `#[command]` function executes (may be sync or async)
3. For long operations: Rust spawns thread, emits progress events via `app_handle.emit()`
4. Frontend listens via `listen()` from `@tauri-apps/api/event`
5. Results return as `Result<T, String>` from Rust, decoded as Promise on frontend

**State Management:**
- **Global ephemeral state:** Zustand stores (`useAppStore` for API keys, breadcrumbs; `useBreadcrumbStore` for navigation)
- **Async/server state:** TanStack React Query (data fetching with caching, stale-while-revalidate)
- **Complex workflow state:** XState machines (BuildProject has 8 states: idle, validating, creatingFolders, savingBreadcrumbs, copyingFiles, creatingTemplate, showingSuccess, error)
- **Auth state:** React Context (`AuthProvider`) wrapping TanStack query for auth check
- **Persistent state:** localStorage (theme, API keys), Tauri stronghold (secure secrets)

## Key Abstractions

**Tauri Commands:**
- Purpose: Bridge between frontend and backend functionality
- Examples: `src-tauri/src/commands/file_ops.rs`, `src-tauri/src/commands/premiere.rs`, `src-tauri/src/commands/sprout_upload.rs`
- Pattern: `#[command]` attribute on Rust functions, registered in `invoke_handler![]` macro in `src-tauri/src/main.rs`
- All commands registered in `src-tauri/src/main.rs` lines 41-97

**Custom Hooks:**
- Purpose: Encapsulate business logic, keeping components thin
- Examples: `src/hooks/useProjectState.ts`, `src/hooks/useBakerScan.ts`, `src/hooks/useBreadcrumbsManager.ts`
- Pattern: `use` prefix, single responsibility, composed in page components
- Barrel export at `src/hooks/index.ts` for most commonly used hooks

**Query Key Factory:**
- Purpose: Centralized, type-safe query key management for TanStack React Query
- Examples: `src/lib/query-keys.ts`
- Pattern: Domain-namespaced keys (projects, trello, files, user, settings, sprout, upload, images, camera) with factory functions

**Breadcrumbs (Domain Concept):**
- Purpose: Project metadata files (`breadcrumbs.json`) stored alongside video project folders
- Examples: `src/utils/types.ts` (Breadcrumb interface), `src-tauri/src/baker/types.rs` (BreadcrumbsFile struct)
- Pattern: JSON files with project title, camera count, file list, creator, timestamps, video links, Trello cards

**State Machines:**
- Purpose: Model complex multi-step workflows with explicit state transitions
- Examples: `src/machines/buildProjectMachine.ts`
- Pattern: XState v5 `setup().createMachine()` with typed context and events, consumed via `useMachine()` hook

## Entry Points

**Frontend Entry:**
- Location: `src/App.tsx`
- Triggers: Vite dev server / Tauri webview load
- Responsibilities: Initialize QueryClient, ThemeProvider, AuthProvider, Router; set up performance monitoring and prefetching

**Backend Entry:**
- Location: `src-tauri/src/main.rs`
- Triggers: Application launch
- Responsibilities: Initialize Tauri builder, register all plugins (fs, shell, dialog, updater, opener, macos-permissions), manage state (AuthState, ScanState), register all invoke handlers

**Router:**
- Location: `src/AppRouter.tsx`
- Triggers: Navigation events
- Responsibilities: Route mapping, auto-updater check on mount, auth gate (currently always authenticated)

**Layout Shell:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: Rendered as parent route element
- Responsibilities: Sidebar + header + breadcrumb navigation + `<Outlet />` for child routes

## Error Handling

**Strategy:** Multi-layered error boundaries + toast notifications + Result types

**Patterns:**
- `QueryErrorBoundary` wraps entire app in `src/App.tsx` - catches React Query and rendering errors with retry capability
- Page-level `ErrorBoundary` components with custom fallback UI (see `src/pages/Baker/Baker.tsx` wrapping `BakerPageContent`)
- Tauri commands return `Result<T, String>` - errors surface as rejected promises in frontend
- Toast notifications via `sonner` library for transient errors (see `src/pages/BuildProject/BuildProject.tsx`)
- XState machine has explicit `error` state with error message in context
- Backend emits specific error events (`copy_file_error`, `copy_complete_with_errors`) for partial failures
- Dev-only error details shown in `<details>` elements, hidden in production

## Cross-Cutting Concerns

**Logging:**
- Frontend: Custom logger (`src/utils/logger.ts`) that no-ops in production. Supports namespaced loggers via `createNamespacedLogger('ModuleName')`.
- Backend: `simple_logger` crate with `log` macros (`info!`, `debug!`, etc.)

**Validation:**
- Frontend: Zod schemas for theme validation (`src/types/customTheme.ts`); custom validation utils (`src/utils/validation.ts`, `src/utils/breadcrumbsValidation.ts`)
- Backend: Rust type system + serde deserialization for command input validation

**Authentication:**
- React Context-based (`src/context/AuthProvider.tsx`) wrapping TanStack Query auth check
- Tokens stored in localStorage + Tauri backend token list
- Currently hardcoded `isAuthenticated = true` in `src/AppRouter.tsx` (auth gate bypassed)
- Backend uses JWT (`jsonwebtoken` crate) and argon2 for password hashing (`src-tauri/src/commands/auth.rs`)

**Theming:**
- `next-themes` ThemeProvider with 13 theme options
- CSS custom properties in `src/index.css`
- Theme selection persisted to localStorage under key `"theme"`

**Navigation:**
- React Router DOM v7 with nested routes
- UI breadcrumbs via Zustand store (`useBreadcrumbStore`) + `useBreadcrumb()` hook
- Sidebar navigation defined as static data in `src/components/app-sidebar.tsx`

---

*Architecture analysis: 2026-03-07*
