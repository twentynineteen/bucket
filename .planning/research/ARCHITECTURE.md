# Architecture Patterns

**Domain:** Deep module refactoring of a Tauri desktop app (React/TypeScript frontend)
**Researched:** 2026-03-07

## Recommended Architecture

### Target Directory Structure

```
src/
├── features/                    # Deep feature modules (the core of the refactor)
│   ├── BuildProject/
│   │   ├── index.ts             # Barrel exports — the ONLY external import path
│   │   ├── api.ts               # Tauri invoke() wrappers + TanStack Query hooks
│   │   ├── types.ts             # Feature-specific types
│   │   ├── components/          # Internal components (steps, forms, progress)
│   │   ├── hooks/               # Internal hooks (useProjectState, useCameraAutoRemap, etc.)
│   │   ├── machines/            # XState machines (buildProjectMachine)
│   │   └── __contracts__/       # Contract tests validating public interface
│   │
│   ├── Baker/
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── __contracts__/
│   │
│   ├── AITools/
│   │   ├── index.ts
│   │   ├── ScriptFormatter/     # Sub-feature with own internal structure
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── steps/
│   │   ├── ExampleEmbeddings/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── __contracts__/
│   │
│   ├── Upload/                  # Groups Sprout, Posterframe, Otter
│   │   ├── index.ts
│   │   ├── Sprout/
│   │   ├── Posterframe/
│   │   ├── Otter/
│   │   └── __contracts__/
│   │
│   ├── Trello/                  # Trello integration (separate from Upload — it's used by Baker too)
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── __contracts__/
│   │
│   ├── Premiere/                # Premiere plugin management + template generation
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── __contracts__/
│   │
│   ├── Auth/                    # Login, Register, auth state
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── context/             # AuthProvider, AuthContext
│   │   └── __contracts__/
│   │
│   └── Settings/                # Settings + Connected Apps
│       ├── index.ts
│       ├── api.ts
│       ├── components/
│       ├── hooks/
│       └── __contracts__/
│
├── shared/                      # Shared code layers — NOT feature-specific
│   ├── ui/                      # UI primitives (current src/components/ui/)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── ... (all Radix/shadcn primitives)
│   │   └── index.ts             # Barrel for convenience
│   ├── components/              # Shared composed components (ErrorBoundary, TitleBar)
│   │   ├── ErrorBoundary.tsx
│   │   ├── TitleBar.tsx
│   │   ├── QueryErrorBoundary.tsx
│   │   └── index.ts
│   ├── hooks/                   # Truly shared hooks (useBreadcrumb, useReducedMotion, useWindowState)
│   │   ├── useBreadcrumb.ts
│   │   ├── useReducedMotion.ts
│   │   ├── useMacOSEffects.ts
│   │   ├── useSystemTheme.ts
│   │   ├── useWindowState.ts
│   │   └── index.ts
│   ├── lib/                     # Query infrastructure (query-keys, query-client-config, etc.)
│   │   ├── query-keys.ts
│   │   ├── query-client-config.ts
│   │   ├── query-utils.ts
│   │   ├── prefetch-strategies.ts
│   │   └── performance-monitor.ts
│   ├── store/                   # Global Zustand stores
│   │   ├── useAppStore.ts
│   │   ├── useBreadcrumbStore.ts
│   │   └── index.ts
│   ├── services/                # Cross-cutting services
│   │   ├── cache-invalidation.ts
│   │   ├── ProgressTracker.ts
│   │   ├── UserFeedbackService.ts
│   │   └── index.ts
│   ├── utils/                   # Pure utility functions
│   │   ├── logger.ts
│   │   ├── validation.ts
│   │   ├── storage.ts
│   │   └── index.ts
│   ├── types/                   # Shared domain types (Breadcrumb, FootageData)
│   │   ├── breadcrumbs.ts
│   │   ├── media.ts
│   │   └── index.ts
│   └── constants/               # App-wide constants
│       ├── animations.ts
│       ├── themes.ts
│       ├── timing.ts
│       ├── project.ts
│       └── index.ts
│
├── app/                         # App shell — routing, layout, providers
│   ├── App.tsx                  # Root: QueryClient, ThemeProvider, AuthProvider
│   ├── AppRouter.tsx            # Route definitions (imports feature page components)
│   ├── dashboard/
│   │   └── page.tsx             # Layout shell: sidebar + header + Outlet
│   └── components/
│       ├── app-sidebar.tsx      # Navigation sidebar
│       └── theme-toggle.tsx     # Theme switcher
│
└── index.css                    # Global styles + theme CSS variables
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `features/BuildProject` | File ingest, camera assignment, project creation, Premiere template | `shared/store` (breadcrumbs, settings), `features/Premiere` (template creation), `shared/lib` (query infrastructure) |
| `features/Baker` | Drive scanning, breadcrumbs batch management, stale detection | `shared/store` (breadcrumbs), `features/Trello` (baker-trello integration), `shared/lib` (query keys) |
| `features/AITools` | Script formatting via RAG, example embedding management | `shared/store` (ollamaUrl), `shared/lib` (query infrastructure) |
| `features/Upload` | Sprout Video upload, posterframe generation, Otter upload | `shared/store` (API keys, latest upload), `shared/lib` (query keys) |
| `features/Trello` | Trello board/card integration, used by Baker AND Upload | `shared/store` (API keys, board ID), `shared/lib` (query keys) |
| `features/Premiere` | Plugin management, template operations | `shared/lib` (query infrastructure) |
| `features/Auth` | Login, register, auth state, token management | `shared/store` (via context), `app/AppRouter` (auth gate) |
| `features/Settings` | API key configuration, theme selection, connected apps | `shared/store` (all settings), `shared/constants` (themes) |
| `shared/ui` | Radix/shadcn UI primitives | Nothing (leaf layer) |
| `shared/hooks` | Cross-cutting hooks (breadcrumb nav, accessibility, window) | `shared/store`, `shared/utils` |
| `shared/lib` | TanStack Query infrastructure | Nothing (configuration layer) |
| `shared/store` | Global app state (API keys, breadcrumbs, settings) | Nothing (state layer, consumed by features) |
| `app/` | Routing, layout, provider composition | All features (lazy imports for routes) |

### Data Flow

```
User Interaction
    |
    v
Feature Component (src/features/X/components/)
    |
    v
Feature Hook (src/features/X/hooks/)
    |
    +---> Feature API Layer (src/features/X/api.ts)
    |         |
    |         +---> Tauri invoke() --> Rust Backend
    |         +---> TanStack Query (caching, invalidation)
    |
    +---> Shared Store (src/shared/store/) for cross-feature state
    |
    +---> Other Feature (via barrel import ONLY)
    |         e.g., Baker imports from features/Trello/index.ts
    |
    v
Feature types.ts (internal type definitions)
```

**Import rule (strict):** A feature module imports from:
1. Its own internal files (unrestricted)
2. `shared/*` (anything in the shared layer)
3. Other `features/*/index.ts` ONLY (never reach into another feature's internals)

**Barrel export rule:** Each `index.ts` exports ONLY the public API:
- Page component (for routing)
- Types needed by other features
- Hooks/functions needed by other features (rare -- keep cross-feature coupling minimal)

## Hook-to-Feature Mapping

This is the critical analysis -- which of the 80+ hooks belong to which feature module.

### BuildProject (14 hooks)
- `useProjectState` -- form state
- `useFileSelection` -- file picker
- `useFileSelector` -- file selection utility (selectFiles)
- `useAutoFileSelection` -- auto file selection
- `useCameraAutoRemap` -- camera assignment
- `useBuildProjectMachine` -- XState machine wrapper
- `useCreateProjectWithMachine` -- project creation orchestration
- `usePostProjectCompletion` -- post-creation actions
- `useProjectValidation` -- validation logic
- `useProjectFolders` -- folder structure
- `useProjectBreadcrumbs` -- project breadcrumbs
- `useFileOperations` -- file copy/move
- `useBackgroundFolder` -- background folder selection
- `usePremiereIntegration` -- Premiere template (may stay in BuildProject or move to Premiere)

### Baker (7 hooks)
- `useBakerScan` -- filesystem scanning
- `useBakerPreferences` -- scan preferences
- `useBakerTrelloIntegration` -- baker+trello integration
- `useBreadcrumbsManager` -- breadcrumbs CRUD
- `useBreadcrumbsPreview` -- diff preview
- `useBreadcrumbsReader` -- read breadcrumbs
- `useLiveBreadcrumbsReader` -- live/polling reader

### AITools/ScriptFormatter (8 hooks)
- `useScriptFormatterState` -- workflow state
- `useScriptProcessor` -- AI processing
- `useScriptReview` -- review step
- `useScriptUpload` -- upload script files
- `useScriptDownload` -- download formatted scripts
- `useScriptRetrieval` -- retrieve scripts
- `useScriptWorkflow` -- workflow orchestration
- `useDocxParser` / `useDocxGenerator` -- DOCX handling

### AITools/ExampleEmbeddings (4 hooks)
- `useExampleManagement` -- CRUD for examples
- `useScriptFileUpload` -- upload example scripts
- `useEmbedding` -- embedding operations
- `useOllamaEmbedding` -- Ollama-specific embedding

### AITools/Shared (2 hooks)
- `useAIModels` -- model listing
- `useAIProvider` -- provider selection
- `useAIProcessing` -- shared processing logic

### Trello (11 hooks)
- `useTrelloBoard` -- board data
- `useTrelloBoardId` -- board ID management
- `useTrelloBoardSearch` -- search boards
- `useTrelloBoards` -- list boards
- `useTrelloActions` -- card actions
- `useTrelloCardDetails` -- card details
- `useTrelloCardSelection` -- card picker
- `useTrelloCardsManager` -- card CRUD
- `useTrelloBreadcrumbs` -- trello+breadcrumbs bridge
- `useTrelloVideoInfo` -- video info on cards
- `useUploadTrello` -- trello upload flow (+ .refactored version)

### Upload/Sprout (3 hooks)
- `useSproutVideoApi` -- Sprout API wrapper
- `useSproutVideoProcessor` -- video processing
- `useUploadEvents` -- upload event tracking

### Upload/Posterframe (3 hooks)
- `usePosterframeCanvas` -- canvas rendering
- `usePosterframeAutoRedraw` -- auto-redraw
- `useImageRefresh` -- image refresh

### Settings (2 hooks)
- `useApiKeys` -- API key management
- `useThemePreview` -- theme live preview

### Auth (2 hooks)
- `useAuth` -- auth actions
- `useAuthCheck` -- auth state check

### Shared (truly cross-cutting, 9 hooks)
- `useBreadcrumb` -- navigation breadcrumbs (UI nav, not project breadcrumbs)
- `useReducedMotion` -- accessibility
- `useMacOSEffects` -- macOS native effects
- `useSystemTheme` -- system theme detection
- `useWindowState` -- window position/size persistence
- `useUpdateManager` -- app update management
- `useVersionCheck` -- version checking
- `useUpdateMutation` -- update installation
- `useUsername` -- username display

### Unclear / Multi-Feature (5 hooks)
- `useAppendBreadcrumbs` -- could be Baker or BuildProject
- `useAppendVideoInfo` -- could be Baker or Upload
- `useBreadcrumbsVideoLinks` -- Baker+Upload bridge
- `useBreadcrumbsTrelloCards` -- Baker+Trello bridge
- `useVideoLinksManager` -- Baker or Upload
- `useVideoDetails` -- Upload/Sprout
- `useVideoInfoBlock` -- UI for video info
- `useParsedTrelloDescription` -- Trello
- `useFuzzySearch` -- shared utility hook
- `useFileUpload` -- shared or Upload-specific
- `useZoomPan` -- Posterframe or shared
- `useHighlights` -- unclear
- `useSproutVideoPlayer` -- Sprout/Upload
- `useTranscript` -- AI or Upload

**Decision for unclear hooks:** Place them in the feature that consumes them primarily. If consumed by multiple features equally, extract to `shared/hooks/`. The `useBreadcrumbsVideoLinks` and `useBreadcrumbsTrelloCards` hooks are Baker-owned because Baker is the breadcrumbs management feature.

## Patterns to Follow

### Pattern 1: Feature Barrel Export

**What:** Every feature module exports exactly what other modules need -- nothing more.

**When:** Every feature module, always.

**Example:**
```typescript
// src/features/BuildProject/index.ts

// Page component (for router)
export { BuildProject } from './components/BuildProject'

// Types needed by other features
export type { ProjectConfig, FootageFile } from './types'

// Public hooks (only if genuinely needed externally)
export { useProjectState } from './hooks/useProjectState'
```

### Pattern 2: Feature API Layer

**What:** A single file per feature that wraps all Tauri `invoke()` calls and TanStack Query hooks for that feature. This is the boundary between "how we talk to the backend" and "what the UI needs."

**When:** Every feature that calls Tauri commands.

**Example:**
```typescript
// src/features/Baker/api.ts
import { invoke } from '@tauri-apps/api/core'
import { useQuery, useMutation } from '@tanstack/react-query'

// Raw Tauri command wrappers
export async function startScan(rootPath: string) {
  return invoke<ScanResult>('baker_start_scan', { rootPath })
}

// TanStack Query hooks
export function useBakerScanQuery(rootPath: string) {
  return useQuery({
    queryKey: ['baker', 'scan', rootPath],
    queryFn: () => startScan(rootPath),
    enabled: !!rootPath,
  })
}
```

### Pattern 3: Feature-Scoped Query Keys

**What:** Move query keys from the centralized `query-keys.ts` into each feature's `api.ts`. Keep only the query key factory pattern, not the centralized registry.

**When:** During migration. Each feature owns its own query keys.

**Example:**
```typescript
// src/features/Trello/api.ts
export const trelloKeys = {
  all: ['trello'] as const,
  boards: () => [...trelloKeys.all, 'boards'] as const,
  board: (id: string) => [...trelloKeys.all, 'board', id] as const,
  cards: (boardId: string) => [...trelloKeys.all, 'cards', boardId] as const,
}
```

**Why:** The current centralized `query-keys.ts` mixes all domains. Feature-scoped keys keep knowledge local. The shared `lib/query-keys.ts` can remain as a re-export aggregator if needed for cross-feature invalidation, but each feature should own its keys.

### Pattern 4: Contract Tests as Behavioral Locks

**What:** Each feature's `__contracts__/` directory tests the public API surface -- what's exported from `index.ts`. These tests verify behavior, not implementation.

**When:** Written immediately after migrating each feature module.

**Example:**
```typescript
// src/features/BuildProject/__contracts__/BuildProject.contract.test.ts
import { BuildProject, useProjectState } from '../index'

describe('BuildProject public API', () => {
  it('exports BuildProject page component', () => {
    expect(BuildProject).toBeDefined()
  })

  it('useProjectState returns expected shape', () => {
    const { result } = renderHook(() => useProjectState())
    expect(result.current).toHaveProperty('title')
    expect(result.current).toHaveProperty('numCameras')
    expect(result.current).toHaveProperty('setTitle')
  })
})
```

### Pattern 5: Lazy Route Loading

**What:** Route components loaded via React.lazy() to enforce module boundaries at the bundler level.

**When:** During AppRouter migration.

**Example:**
```typescript
// src/app/AppRouter.tsx
const BuildProject = lazy(() =>
  import('../features/BuildProject').then(m => ({ default: m.BuildProject }))
)
const Baker = lazy(() =>
  import('../features/Baker').then(m => ({ default: m.Baker }))
)
```

**Why:** Lazy loading enforces that routes only depend on the barrel export. It also gives free code splitting.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Cross-Feature Internal Imports

**What:** Importing from `features/Baker/hooks/useBakerScan` instead of `features/Baker`.

**Why bad:** Breaks module boundaries. Any refactor inside Baker could break importers. Defeats the purpose of barrel exports.

**Instead:** Import only from `features/Baker/index.ts`. If something isn't exported, either add it to the public API or reconsider whether the cross-feature dependency is correct.

### Anti-Pattern 2: God Barrel (Re-exporting Everything)

**What:** Making `index.ts` re-export every file in the feature.

**Why bad:** No boundary enforcement. Same as having no barrel at all. Tree-shaking breaks.

**Instead:** Export only what external consumers need. Most features export: page component + maybe 1-2 types. Internal hooks stay internal.

### Anti-Pattern 3: Shared Store as Cross-Feature Communication

**What:** Feature A writes to Zustand store, Feature B reads from it, creating invisible coupling.

**Why bad:** No explicit dependency. Hard to trace data flow. Store becomes a god object.

**Instead:** Keep `useAppStore` for genuinely global state (API keys, user preferences). For feature-to-feature data, use explicit imports through barrel exports or TanStack Query's shared cache with feature-scoped keys.

### Anti-Pattern 4: Big Bang Migration

**What:** Moving all 80+ hooks and all components in one commit.

**Why bad:** Guaranteed breakage. No rollback point. Can't verify feature-by-feature.

**Instead:** Migrate one feature at a time. Old import paths can temporarily redirect via re-exports during migration.

### Anti-Pattern 5: Splitting Trello Across Features

**What:** Putting Trello hooks in Baker, Upload, and BuildProject because each uses Trello.

**Why bad:** Trello is a domain with its own API surface, types, and logic. Splitting it means duplicated types, inconsistent API usage.

**Instead:** Trello is its own feature module. Baker imports `features/Trello` for its integration hooks. The `useBakerTrelloIntegration` hook lives in Baker but imports Trello's public API.

## Migration Strategy

### Phase Order (Build Dependencies)

Migration must follow dependency order: shared layers first, then features from least-coupled to most-coupled.

```
Phase 1: shared/    (foundation -- no feature depends on another feature yet)
Phase 2: features/Auth        (minimal deps, needed by app shell)
Phase 3: features/Trello      (used by Baker, Upload -- must exist before them)
Phase 4: features/Premiere    (used by BuildProject)
Phase 5: features/Upload      (Sprout, Posterframe, Otter -- depends on Trello)
Phase 6: features/Settings    (depends on shared/store, shared/constants)
Phase 7: features/AITools     (self-contained, no cross-feature deps)
Phase 8: features/Baker       (depends on Trello)
Phase 9: features/BuildProject (depends on Premiere, most complex)
Phase 10: app/                (routing, layout -- final integration)
```

**Rationale for this order:**
1. **Shared first** because every feature depends on shared code. Moving shared establishes the foundation and path aliases.
2. **Leaf features early** (Auth, Trello, Premiere) because they are consumed by other features. They must be in place before their consumers migrate.
3. **AITools mid-cycle** because it's self-contained with no cross-feature consumers.
4. **Baker and BuildProject last** because they have the most cross-feature dependencies and the most hooks to migrate (14 and 7 respectively).
5. **App shell last** because it wires everything together and needs all features in place.

### Per-Feature Migration Steps

For each feature module:

1. **Create the feature directory** with `index.ts`, `api.ts`, `types.ts`
2. **Move hooks** from `src/hooks/` into `src/features/X/hooks/`
3. **Move components** from `src/pages/X/` and `src/components/X/` into `src/features/X/components/`
4. **Move types** from `src/types/X.ts` into `src/features/X/types.ts`
5. **Create barrel export** in `index.ts` -- only export what other modules need
6. **Create API layer** in `api.ts` -- centralize Tauri invoke() calls
7. **Add re-export redirects** at old paths (temporary, for incremental migration)
8. **Update imports** across codebase to use new barrel paths
9. **Delete old test files** for this feature
10. **Write contract tests** in `__contracts__/`
11. **Remove re-export redirects** once all consumers updated
12. **Verify** -- run full app, check routing, check no old imports remain

### Path Alias Updates

The `tsconfig.json` paths need updating to support the new structure:

```json
{
  "paths": {
    // New aliases
    "@features/*": ["src/features/*"],
    "@shared/*": ["src/shared/*"],
    "@app/*": ["src/app/*"],

    // Keep during migration (remove after)
    "@components/*": ["src/components/*"],
    "@hooks/*": ["src/hooks/*"],
    "@lib/*": ["src/lib/*"],
    "@utils/*": ["src/utils/*"],
    "@constants/*": ["src/constants/*"],
    "@store/*": ["src/store/*"],
    "@services/*": ["src/services/*"],
    "@pages/*": ["src/pages/*"],
    "@machines/*": ["src/machines/*"],
    "@context/*": ["src/context/*"],
    "@/*": ["src/*"]
  }
}
```

Old aliases kept temporarily during migration, then removed once all imports use `@features/` and `@shared/`.

### The useAppStore Problem

The current `useAppStore` is a cross-cutting god store containing: Trello API keys, Sprout API keys, breadcrumbs, background folder, latest Sprout upload, and Ollama URL. This creates invisible coupling between every feature.

**Recommendation:** Keep `useAppStore` in `shared/store/` but refactor it to use slices:

```typescript
// shared/store/useAppStore.ts
// Keep as-is during migration. Refactoring into feature-specific stores
// is a follow-up optimization, not part of the structural migration.
```

**Rationale:** Refactoring the store shape is a behavioral change, not a structural one. The module refactor is about boundaries and imports. Store decomposition is a separate concern that should happen after the structure is stable.

## Scalability Considerations

| Concern | Current (5 features) | At 10 features | At 20 features |
|---------|---------------------|-----------------|-----------------|
| Module discovery | Flat -- grep through hooks/ | `features/` directory listing | Same -- features/ stays flat |
| Import boundaries | None -- anyone imports anything | Barrel exports enforced | Same + ESLint import rules |
| Build time | Single chunk | Lazy routes = code split per feature | Same with aggressive splitting |
| Test isolation | All tests in tests/ | Contract tests co-located per feature | Same -- scales linearly |
| New developer onboarding | Read all 80+ hooks to understand scope | Read one feature's index.ts | Same -- progressive disclosure |

## Integration Points Between Modules

### Critical Cross-Feature Dependencies

```
Baker ──imports──> Trello (useBakerTrelloIntegration uses Trello's public hooks)
Baker ──imports──> shared/store (breadcrumbs state)
BuildProject ──imports──> Premiere (template creation)
BuildProject ──imports──> shared/store (breadcrumbs, background folder)
Upload/Sprout ──imports──> shared/store (API keys, latest upload)
Settings ──imports──> shared/store (all API keys)
Settings ──imports──> shared/constants (themes)
Auth ──imports──> shared/store (indirectly, via context)
App ──imports──> all features (routing)
```

### No Circular Dependencies

The dependency graph above is acyclic. No feature imports from a feature that imports back from it. This must be maintained. If a circular dependency is discovered during migration, the shared code must be extracted to `shared/`.

## Sources

- [AI Hero: How to Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love) -- primary reference architecture for deep modules with contract tests (HIGH confidence, project requirement)
- [Feature-Sliced Design](https://feature-sliced.design/) -- layered architecture methodology with strict import rules (MEDIUM confidence, validated pattern)
- [Feature-Sliced Design Tutorial](https://feature-sliced.design/docs/get-started/tutorial) -- migration strategy guidance (MEDIUM confidence)
- [Robin Wieruch: React Folder Structure in 5 Steps](https://www.robinwieruch.de/react-folder-structure/) -- feature-grouped folder structure patterns (MEDIUM confidence)
- [React Architecture Patterns 2026](https://www.bacancytechnology.com/blog/react-architecture-patterns-and-best-practices) -- current React architecture trends (LOW confidence, general overview)
- Current codebase analysis: `src/hooks/` (80+ files), `src/pages/`, `src/components/`, `src/store/`, `src/lib/` (HIGH confidence, direct inspection)
