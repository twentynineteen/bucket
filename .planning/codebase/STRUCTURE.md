# Codebase Structure

**Analysis Date:** 2026-03-07

## Directory Layout

```
bucket/
├── src/                        # React frontend source
│   ├── App.tsx                 # Root component: providers, QueryClient, ThemeProvider
│   ├── AppRouter.tsx           # Route definitions, auto-updater
│   ├── global.d.ts             # Global type declarations
│   ├── index.css               # Global styles + theme CSS variables
│   ├── app/
│   │   └── dashboard/
│   │       └── page.tsx        # Layout shell: sidebar + header + <Outlet />
│   ├── components/             # Reusable UI components
│   │   ├── Baker/              # Baker feature components (11 files)
│   │   ├── BatchUpdate/        # Batch update UI components (5 files)
│   │   ├── BreadcrumbsViewer/  # Breadcrumbs display components
│   │   ├── Settings/           # Settings page sub-components (themes, Trello)
│   │   ├── trello/             # Trello integration modal components
│   │   ├── ui/                 # Radix-based UI primitives (shadcn/ui style)
│   │   ├── app-sidebar.tsx     # Main sidebar with navigation data
│   │   ├── ErrorBoundary.tsx   # Error boundary + QueryErrorBoundary
│   │   ├── TitleBar.tsx        # macOS custom title bar
│   │   └── theme-toggle.tsx    # Theme switcher in sidebar
│   ├── constants/              # App-wide constants
│   │   ├── animations.ts       # Animation timing/easing
│   │   ├── index.ts            # Barrel exports
│   │   ├── project.ts          # Project-related constants
│   │   ├── themes.ts           # Theme registry and metadata
│   │   └── timing.ts           # Cache/retry timing constants
│   ├── context/                # React context providers
│   │   ├── AuthContext.ts      # Auth context type definition
│   │   └── AuthProvider.tsx    # Auth state management
│   ├── hooks/                  # Custom React hooks (80+ files)
│   │   ├── index.ts            # Barrel exports for commonly used hooks
│   │   ├── useProjectState.ts  # BuildProject form state
│   │   ├── useBakerScan.ts     # Baker scanning logic
│   │   ├── useBuildProjectMachine.ts  # XState machine wrapper
│   │   └── ...                 # Many more domain-specific hooks
│   ├── lib/                    # Query infrastructure
│   │   ├── query-keys.ts       # Centralized query key factory
│   │   ├── query-utils.ts      # Query utility types
│   │   ├── query-client-config.ts  # QueryClient settings
│   │   ├── prefetch-strategies.ts  # Startup data prefetching
│   │   └── performance-monitor.ts  # Query perf monitoring
│   ├── machines/               # XState state machines
│   │   └── buildProjectMachine.ts  # BuildProject workflow FSM
│   ├── pages/                  # Page-level components (route targets)
│   │   ├── AI/                 # AI tools feature
│   │   │   ├── ExampleEmbeddings/  # RAG example management (7 files + hooks/)
│   │   │   └── ScriptFormatter/    # AI script formatting (8 files + steps/)
│   │   ├── Baker/              # Baker page
│   │   │   └── Baker.tsx       # Main Baker page component
│   │   ├── BuildProject/       # Build Project page (7 files)
│   │   │   ├── BuildProject.tsx      # Main page: orchestrates steps
│   │   │   ├── AddFootageStep.tsx    # Step 2: file selection
│   │   │   ├── CreateProjectStep.tsx # Step 3: create button
│   │   │   ├── FolderSelector.tsx    # Destination folder picker
│   │   │   ├── ProgressBar.tsx       # Copy progress display
│   │   │   ├── ProjectConfigurationStep.tsx  # Step 1: title, cameras
│   │   │   ├── ProjectInputs.tsx     # Form input components
│   │   │   └── SuccessSection.tsx    # Post-creation success UI
│   │   ├── PremierePluginManager/    # Premiere plugin management
│   │   ├── UploadTrello/       # Trello upload (with sub-components)
│   │   ├── auth/               # Login and Register pages
│   │   ├── ConnectedApps.tsx   # Connected apps settings
│   │   ├── IngestHistory.tsx   # Ingest history view
│   │   ├── Posterframe.tsx     # Posterframe generation
│   │   ├── Settings.tsx        # Settings page
│   │   ├── UploadOtter.tsx     # Otter upload
│   │   └── UploadSprout.tsx    # Sprout Video upload
│   ├── services/               # Infrastructure services
│   │   ├── cache-invalidation.ts   # Cache management
│   │   ├── ProgressTracker.ts      # Progress tracking
│   │   └── UserFeedbackService.ts  # User notifications
│   ├── store/                  # Zustand state stores
│   │   ├── useAppStore.ts      # Global app state (API keys, settings)
│   │   └── useBreadcrumbStore.ts   # Navigation breadcrumb state
│   ├── types/                  # TypeScript type definitions
│   │   ├── baker.ts            # Baker feature types
│   │   ├── customTheme.ts      # Theme types + Zod schemas
│   │   ├── exampleEmbeddings.ts    # AI example types
│   │   ├── media.ts            # Media-related types
│   │   ├── plugins.ts          # Plugin types
│   │   └── scriptFormatter.ts  # Script formatter types
│   └── utils/                  # Utility functions
│       ├── types.ts            # Core domain types (Breadcrumb, FootageData, SproutFolder)
│       ├── logger.ts           # Dev-only logging utility
│       ├── validation.ts       # Input validation helpers
│       ├── breadcrumbsValidation.ts    # Breadcrumbs-specific validation
│       ├── breadcrumbsComparison.ts    # Diff/comparison logic
│       ├── breadcrumbsMigration.ts     # Legacy data migration
│       ├── themeMapper.ts      # Theme ID mapping
│       ├── themeLoader.ts      # Dynamic theme loading
│       ├── storage.ts          # localStorage helpers
│       └── ...                 # More utilities
├── src-tauri/                  # Rust backend
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri app configuration
│   ├── build.rs                # Build script
│   └── src/
│       ├── main.rs             # App entry: plugin registration, command handlers
│       ├── lib.rs              # Library entry: media types re-export
│       ├── media.rs            # Shared media types (VideoLink, TrelloCard)
│       ├── commands/           # Tauri command handlers
│       │   ├── mod.rs          # Module declarations + re-exports
│       │   ├── file_ops.rs     # File copy/move operations with progress
│       │   ├── premiere.rs     # Premiere Pro template operations
│       │   ├── sprout_upload.rs    # Sprout Video API upload
│       │   ├── auth.rs         # Authentication commands
│       │   ├── ai_provider.rs  # AI provider validation
│       │   ├── docx.rs         # DOCX file parsing/generation
│       │   ├── plugins.rs      # Premiere plugin management
│       │   ├── rag.rs          # RAG/vector search for script examples
│       │   ├── system.rs       # System-level commands
│       │   └── tests/          # Backend tests
│       ├── baker/              # Baker feature module
│       │   ├── mod.rs          # Module declarations
│       │   ├── types.rs        # Data structures (ProjectFolder, ScanResult, etc.)
│       │   ├── scanning.rs     # Filesystem scanning logic
│       │   ├── breadcrumbs.rs  # Breadcrumbs read/write operations
│       │   └── video_links.rs  # Video link CRUD operations
│       ├── state/              # Backend state management
│       │   ├── mod.rs          # Module declarations
│       │   └── auth.rs         # AuthState (token storage)
│       └── utils/              # Backend utilities
│           ├── mod.rs          # Module declarations
│           └── file_copy.rs    # File copy with progress tracking
├── tests/                      # Test files (separated from source)
│   ├── setup/                  # Test infrastructure
│   │   ├── vitest-setup.ts     # Vitest global setup
│   │   ├── msw-server.ts       # MSW mock server
│   │   ├── tauri-mocks.ts      # Tauri API mocks
│   │   ├── trello-handlers.ts  # Trello API mock handlers
│   │   ├── sprout-handlers.ts  # Sprout API mock handlers
│   │   └── framer-motion-mock.ts   # Framer Motion mock
│   ├── unit/                   # Unit tests (mirrors src/ structure)
│   │   ├── components/         # Component tests
│   │   ├── hooks/              # Hook tests
│   │   ├── constants/          # Constants tests
│   │   └── AppRouter.test.tsx  # Router tests
│   ├── component/              # Component-level integration tests
│   ├── contract/               # Contract/API contract tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # Playwright E2E tests
│   │   ├── specs/              # Test specifications
│   │   ├── pages/              # Page object models
│   │   ├── fixtures/           # Test fixtures and mocks
│   │   ├── utils/              # E2E test utilities
│   │   ├── buildproject/       # BuildProject-specific E2E tests
│   │   └── playwright.config.ts
│   ├── fixtures/               # Shared test fixtures
│   └── lib/                    # Library function tests
├── docs/                       # Documentation
├── specs/                      # Feature specifications
├── scripts/                    # Build/utility scripts
├── assets/                     # Bundled resources (plugins, templates)
├── resources/                  # Embedding resources
├── .claude/                    # Claude Code configuration
│   ├── skills/                 # Custom Claude skills
│   └── hooks/                  # Pre-commit/tool hooks
├── vite.config.ts              # Vite + Vitest configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── eslint.config.js            # ESLint configuration
└── .prettierrc                 # Prettier configuration
```

## Directory Purposes

**`src/components/`:**
- Purpose: Reusable UI components shared across pages
- Contains: Feature-grouped component directories, UI primitives, layout components
- Key files: `app-sidebar.tsx` (navigation), `ErrorBoundary.tsx` (error handling), `TitleBar.tsx` (macOS window chrome)
- Sub-directories organize by feature domain: `Baker/`, `BatchUpdate/`, `Settings/`, `trello/`, `ui/`

**`src/pages/`:**
- Purpose: Top-level page components that serve as route targets
- Contains: One directory per feature with main page + sub-components
- Key files: `BuildProject/BuildProject.tsx`, `Baker/Baker.tsx`, `Settings.tsx`
- Multi-file pages use directory structure; single-file pages are flat

**`src/hooks/`:**
- Purpose: All custom React hooks containing business logic
- Contains: 80+ hooks covering every feature domain
- Key files: `index.ts` (barrel exports), `useProjectState.ts`, `useBakerScan.ts`, `useBuildProjectMachine.ts`
- This is the largest directory - hooks are the primary code organization unit

**`src/lib/`:**
- Purpose: TanStack React Query infrastructure and configuration
- Contains: Query key factory, utilities, prefetch strategies, performance monitoring
- Key files: `query-keys.ts` (centralized key management)

**`src/store/`:**
- Purpose: Zustand global state stores
- Contains: Two stores - app-wide state and navigation breadcrumbs
- Key files: `useAppStore.ts`, `useBreadcrumbStore.ts`

**`src/machines/`:**
- Purpose: XState state machine definitions for complex workflows
- Contains: BuildProject workflow state machine
- Key files: `buildProjectMachine.ts`

**`src/components/ui/`:**
- Purpose: Base UI primitives (shadcn/ui pattern built on Radix UI)
- Contains: Button, Dialog, Select, Input, Tabs, Sidebar, Tooltip, etc.
- Key files: `button.tsx`, `dialog.tsx`, `sidebar.tsx`

**`src-tauri/src/commands/`:**
- Purpose: Tauri command handlers exposed to frontend via IPC
- Contains: 9 command modules + test directory
- Key files: `file_ops.rs` (file operations), `sprout_upload.rs` (Sprout API), `rag.rs` (vector search)

**`src-tauri/src/baker/`:**
- Purpose: Backend logic for Baker feature (scanning, breadcrumbs, video links)
- Contains: Types, filesystem scanning, breadcrumbs I/O, video link management
- Key files: `types.rs` (all Baker data structures), `scanning.rs` (filesystem traversal)

**`tests/`:**
- Purpose: All test files organized by test type
- Contains: Unit, component, contract, integration, and E2E tests
- Key files: `setup/vitest-setup.ts`, `setup/tauri-mocks.ts`

## Key File Locations

**Entry Points:**
- `src/App.tsx`: Frontend root - providers, QueryClient, services initialization
- `src/AppRouter.tsx`: Route definitions and auto-updater
- `src/app/dashboard/page.tsx`: Layout shell with sidebar and outlet
- `src-tauri/src/main.rs`: Rust backend entry - all plugin and command registration
- `vite.config.ts`: Build configuration + Vitest test config

**Configuration:**
- `package.json`: Dependencies and npm scripts
- `tsconfig.json`: TypeScript paths and compiler options
- `src-tauri/tauri.conf.json`: Tauri window config, plugins, bundle settings
- `src-tauri/Cargo.toml`: Rust dependencies
- `vite.config.ts`: Vite build + Vitest test settings

**Core Logic:**
- `src/hooks/useProjectState.ts`: BuildProject form state management
- `src/hooks/useBuildProjectMachine.ts`: XState machine + Tauri event bridge
- `src/hooks/useCreateProjectWithMachine.ts`: Project creation orchestration
- `src/machines/buildProjectMachine.ts`: Workflow state machine definition
- `src/hooks/useBakerScan.ts`: Baker scanning logic
- `src/hooks/useBreadcrumbsManager.ts`: Breadcrumbs CRUD operations
- `src-tauri/src/commands/file_ops.rs`: File copy with progress tracking
- `src-tauri/src/baker/scanning.rs`: Filesystem project scanning

**Testing:**
- `tests/setup/vitest-setup.ts`: Global test setup
- `tests/setup/tauri-mocks.ts`: Tauri API mock implementations
- `tests/setup/msw-server.ts`: MSW mock service worker
- `tests/e2e/playwright.config.ts`: Playwright configuration

**Types:**
- `src/utils/types.ts`: Core domain types (Breadcrumb, FootageData, SproutFolder, SproutUploadResponse)
- `src/types/baker.ts`: Baker-specific types
- `src/types/media.ts`: Media types
- `src-tauri/src/baker/types.rs`: Rust Baker types (must match TS interfaces)
- `src-tauri/src/media.rs`: Rust media types (VideoLink, TrelloCard)

## Naming Conventions

**Files:**
- React components: PascalCase (`BuildProject.tsx`, `ErrorBoundary.tsx`, `ThemeSelector.tsx`)
- Hooks: camelCase with `use` prefix (`useProjectState.ts`, `useBakerScan.ts`)
- Stores: camelCase with `use` prefix and `Store` suffix (`useAppStore.ts`, `useBreadcrumbStore.ts`)
- Machines: camelCase with `Machine` suffix (`buildProjectMachine.ts`)
- Utils/constants: camelCase (`logger.ts`, `validation.ts`, `themes.ts`)
- UI primitives: kebab-case (`button-variants.ts`, `alert-dialog.tsx`, `use-sidebar.ts`)
- Rust: snake_case (`file_ops.rs`, `sprout_upload.rs`, `video_links.rs`)
- Tests: source filename + `.test.tsx`/`.test.ts` (`Settings.test.tsx`, `useBakerScan.test.ts`)

**Directories:**
- Feature directories: PascalCase (`BuildProject/`, `Baker/`, `ExampleEmbeddings/`)
- Category directories: lowercase (`hooks/`, `utils/`, `store/`, `components/`, `pages/`)
- UI primitive directory: lowercase (`ui/`)
- Rust modules: snake_case (`commands/`, `baker/`, `state/`)

## Where to Add New Code

**New Page/Feature:**
1. Create page component directory: `src/pages/FeatureName/FeatureName.tsx`
2. Add sub-components in same directory: `src/pages/FeatureName/StepOne.tsx`
3. Create hooks for business logic: `src/hooks/useFeatureName.ts`
4. Add route in `src/AppRouter.tsx`
5. Add sidebar navigation entry in `src/components/app-sidebar.tsx` data object
6. If feature needs Tauri commands, add module in `src-tauri/src/commands/` and register in `src-tauri/src/main.rs`

**New Reusable Component:**
- Shared components: `src/components/FeatureArea/ComponentName.tsx`
- UI primitives: `src/components/ui/component-name.tsx` (shadcn/ui pattern)
- Feature-specific components: co-locate in `src/pages/FeatureName/` or `src/components/FeatureName/`

**New Hook:**
- Create: `src/hooks/useHookName.ts`
- Export from `src/hooks/index.ts` if commonly used
- Follow pattern: wrap Tauri `invoke()` calls, return structured object

**New Tauri Command:**
- Add command function in appropriate `src-tauri/src/commands/*.rs` module (or create new module)
- If new module: declare in `src-tauri/src/commands/mod.rs` and re-export with `pub use`
- Register in `invoke_handler![]` in `src-tauri/src/main.rs`

**New State Machine:**
- Create: `src/machines/featureNameMachine.ts`
- Wrap with hook: `src/hooks/useFeatureNameMachine.ts`

**New Zustand Store:**
- Create: `src/store/useFeatureStore.ts`
- Follow `useAppStore.ts` pattern: interface + create function

**New Types:**
- Domain types: `src/types/featureName.ts`
- Core shared types: `src/utils/types.ts`
- Rust counterparts: match field names using `#[serde(rename = "camelCase")]`

**Tests:**
- Unit tests: `tests/unit/` mirroring source structure
- Component tests: `tests/component/`
- Contract tests: `tests/contract/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/specs/`
- Co-located tests also allowed: `src/components/FeatureName/Component.test.tsx`

**Utilities:**
- Shared helpers: `src/utils/utilityName.ts`
- Query infrastructure: `src/lib/`
- Constants: `src/constants/`

## Special Directories

**`src/components/ui/`:**
- Purpose: Base UI primitives following shadcn/ui pattern
- Generated: Partially (initially generated by shadcn CLI, then customized)
- Committed: Yes

**`src-tauri/target/`:**
- Purpose: Rust build artifacts
- Generated: Yes
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: NPM/Bun dependencies
- Generated: Yes
- Committed: No

**`dist/`:**
- Purpose: Vite frontend build output
- Generated: Yes
- Committed: No

**`assets/`:**
- Purpose: Bundled resources shipped with the app (Premiere plugins, templates)
- Generated: No
- Committed: Yes

**`resources/embeddings/`:**
- Purpose: Pre-computed embedding vectors for RAG
- Generated: Yes (via `bun run embed:examples`)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes (by Claude Code)
- Committed: Yes

**`specs/`:**
- Purpose: Feature specifications and design documents
- Generated: No (human authored)
- Committed: Yes

## Path Aliases

Use these TypeScript path aliases (defined in `tsconfig.json`):

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@components/*` | `src/components/*` | `import { Button } from '@components/ui/button'` |
| `@hooks/*` | `src/hooks/*` | `import { useBakerScan } from '@hooks/useBakerScan'` |
| `@lib/*` | `src/lib/*` | `import { queryKeys } from '@lib/query-keys'` |
| `@utils/*` | `src/utils/*` | `import { logger } from '@utils/logger'` |
| `@constants/*` | `src/constants/*` | `import { CACHE } from '@constants/timing'` |
| `@store/*` | `src/store/*` | `import { useAppStore } from '@store/useAppStore'` |
| `@services/*` | `src/services/*` | `import { ... } from '@services/cache-invalidation'` |
| `@pages/*` | `src/pages/*` | `import Baker from '@pages/Baker/Baker'` |
| `@machines/*` | `src/machines/*` | `import { buildProjectMachine } from '@machines/buildProjectMachine'` |
| `@context/*` | `src/context/*` | `import { AuthContext } from '@context/AuthContext'` |
| `@/*` | `src/*` | `import { logger } from '@/utils/logger'` |
| `@tests/*` | `tests/*` | `import { ... } from '@tests/setup/tauri-mocks'` |

---

*Structure analysis: 2026-03-07*
