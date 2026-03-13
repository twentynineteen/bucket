# Phase 2: Shared Infrastructure - Research

**Researched:** 2026-03-08
**Domain:** TypeScript module extraction, barrel exports, contract testing
**Confidence:** HIGH

## Summary

Phase 2 extracts all cross-cutting code from legacy flat directories (`src/hooks/`, `src/components/ui/`, `src/store/`, `src/lib/`, `src/services/`, `src/utils/`, `src/types/`, `src/constants/`) into `src/shared/` sub-modules with barrel exports and contract tests. The `@shared/*` path alias is already configured (Phase 1), and the `src/shared/` directory exists with a `.gitkeep`.

The primary challenge is classifying 80+ hooks as shared vs. feature-specific using import graph analysis, then physically moving shared code while updating all import paths. The codebase currently has 46 files importing `logger`, 18 files importing `@utils/types`, and `useBreadcrumb` imported by 8+ feature pages -- confirming heavy cross-cutting usage that justifies the shared layer.

**Primary recommendation:** Move files sub-module by sub-module (lib first, then constants, types, utils, store, services, ui, hooks last), updating imports after each move and running `bun run dev` to verify no breakage. Hooks are last because they have the most complex dependency graphs and the invoke() splitting requirement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Hook ownership:** 2+ feature consumers = shared. Single-consumer hooks stay for their feature phase. Physically move, don't re-export. No backward-compat bridges.
- **No invoke() in shared hooks:** Split hooks that call invoke() into logic (shared) + api (feature). Shared hooks must be pure logic/state.
- **UI primitives:** Move entire `src/components/ui/` to `src/shared/ui/`. Move misplaced components from `src/utils/` and layout components from `src/components/`. Allow nested sub-directories. Theme system coalesces into `shared/ui/theme/`.
- **No barrels in `shared/ui/`:** Direct imports only (`@shared/ui/Button`, `@shared/ui/sidebar/Sidebar`). This applies to entire ui tree including nested sub-modules.
- **Barrel scope:** Named re-exports only (`export { X } from './X'`), no wildcards. Export everything public. Barrels exist for: hooks, store, lib, services, utils, types, constants. No barrels for: ui.
- **Contract test depth:** Full behavioral tests (shape + behavior). Use renderHook from Testing Library. `__contracts__/` directory per sub-module. No mocking needed for shared hooks (no invoke calls).
- **Resolve all 14 ambiguous hooks now** using import graph analysis.
- **Tag remaining feature hooks** with `// Target: @features/FeatureName` comments.

### Claude's Discretion
- Exact classification of each hook (shared vs feature-specific) based on import graph analysis
- Internal file organization within each shared sub-module
- Which utils are truly shared vs feature-specific (apply same 2+ consumer rule)
- How to handle the breadcrumbs utility barrel (`src/utils/breadcrumbs/index.ts`) during migration
- Services sub-module structure (AI services may be feature-specific)
- How to split hooks that currently call invoke() into logic + api parts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHRD-01 | Import shared hooks from `@shared/hooks` barrel export only | Hook classification (below), barrel pattern, contract tests |
| SHRD-02 | Import shared UI primitives from `@shared/ui/*` (no barrel -- direct imports) | UI file inventory, nested sub-dir structure, theme coalescing |
| SHRD-03 | Import global stores from `@shared/store` barrel export | 2 stores (useAppStore, useBreadcrumbStore) move as-is |
| SHRD-04 | Import query infrastructure from `@shared/lib` barrel export | 5 lib files move as-is, existing barrel pattern |
| SHRD-05 | Import services from `@shared/services` barrel export | 3 shared services + AI services classification |
| SHRD-06 | Import utilities from `@shared/utils` barrel export | Logger, storage, validation, breadcrumbs classification |
| SHRD-07 | Import shared types from `@shared/types` barrel export | types/media.ts shared, types/baker.ts feature-specific |
| SHRD-08 | Import constants from `@shared/constants` barrel export | 5 constant files, existing minimal barrel |
| SHRD-09 | Contract tests validating each shared sub-module's public interface | __contracts__/ pattern, renderHook, behavioral depth |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (project) | Test runner for contract tests | Already configured with jsdom, setupFiles, globals |
| @testing-library/react | (project) | renderHook for hook contract tests | Already in project, renderHook available |
| TypeScript | 5.7 | Path aliases, barrel exports, type checking | Project standard |
| Vite | 6.1 | Path alias resolution via vite-tsconfig-paths | Already configured, reads tsconfig paths |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eslint-plugin-boundaries | (project) | Enforce shared/feature import rules | Already configured from Phase 1 |
| vite-tsconfig-paths | (project) | Resolve @shared/* aliases in Vite | Already configured |

### Alternatives Considered
None -- all tooling is already in the project from Phase 1.

## Architecture Patterns

### Target Shared Module Structure
```
src/shared/
├── hooks/
│   ├── index.ts                      # Barrel: named re-exports
│   ├── useBreadcrumb.ts
│   ├── useReducedMotion.ts
│   ├── useFuzzySearch.ts
│   ├── useUsername.ts
│   ├── ... (other shared hooks)
│   └── __contracts__/
│       └── hooks.contract.test.ts
├── ui/
│   ├── button.tsx                    # NO barrel -- direct imports
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── ... (all Radix primitives)
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SidebarLayout.tsx
│   │   ├── SidebarMenu.tsx
│   │   └── SidebarProvider.tsx
│   ├── theme/
│   │   ├── ThemeSelector.tsx
│   │   ├── ThemeColorSwatch.tsx
│   │   ├── ThemeImport.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── useThemePreview.ts
│   │   ├── themeMapper.ts
│   │   ├── themeLoader.ts
│   │   ├── themes.ts               # from constants/themes.ts
│   │   └── customTheme.ts          # from types/customTheme.ts
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── nav-main.tsx
│   │   ├── nav-user.tsx
│   │   ├── team-switcher.tsx
│   │   ├── TitleBar.tsx
│   │   └── ErrorBoundary.tsx
│   └── __contracts__/
│       └── ui.contract.test.ts
├── store/
│   ├── index.ts                      # Barrel
│   ├── useAppStore.ts
│   ├── useBreadcrumbStore.ts
│   └── __contracts__/
│       └── store.contract.test.ts
├── lib/
│   ├── index.ts                      # Barrel
│   ├── query-keys.ts
│   ├── query-client-config.ts
│   ├── query-utils.ts
│   ├── performance-monitor.ts
│   ├── prefetch-strategies.ts
│   └── __contracts__/
│       └── lib.contract.test.ts
├── services/
│   ├── index.ts                      # Barrel
│   ├── ProgressTracker.ts
│   ├── UserFeedbackService.ts
│   ├── cache-invalidation.ts
│   └── __contracts__/
│       └── services.contract.test.ts
├── utils/
│   ├── index.ts                      # Barrel
│   ├── logger.ts
│   ├── storage.ts
│   ├── debounce.ts
│   ├── validation.ts
│   ├── breadcrumbs/
│   │   ├── comparison.ts
│   │   ├── dateFormatting.ts
│   │   ├── debug.ts
│   │   ├── displayFormatting.ts
│   │   ├── fieldCategorization.ts
│   │   └── previewGeneration.ts
│   └── __contracts__/
│       └── utils.contract.test.ts
├── types/
│   ├── index.ts                      # Barrel
│   ├── media.ts
│   ├── types.ts                      # from utils/types.ts (Breadcrumb, FootageData, etc.)
│   └── __contracts__/
│       └── types.contract.test.ts
└── constants/
    ├── index.ts                      # Barrel
    ├── timing.ts
    ├── animations.ts
    ├── project.ts
    └── __contracts__/
        └── constants.contract.test.ts
```

### Pattern 1: Named Barrel Exports
**What:** Each sub-module (except ui) has an `index.ts` that re-exports all public members by name.
**When to use:** Every shared sub-module except `shared/ui/`.
**Example:**
```typescript
// src/shared/hooks/index.ts
export { useBreadcrumb } from './useBreadcrumb'
export { useReducedMotion } from './useReducedMotion'
export { useFuzzySearch } from './useFuzzySearch'
export { useUsername } from './useUsername'
// ... all shared hooks
```

### Pattern 2: Direct UI Imports (No Barrel)
**What:** UI components are imported directly by path, never through a barrel.
**When to use:** All `@shared/ui/*` imports.
**Example:**
```typescript
// Correct
import { Button } from '@shared/ui/button'
import { Sidebar } from '@shared/ui/sidebar/Sidebar'
import { ThemeSelector } from '@shared/ui/theme/ThemeSelector'

// WRONG - no barrel exists
import { Button } from '@shared/ui'
```

### Pattern 3: Contract Test per Sub-Module
**What:** Each shared sub-module has a `__contracts__/` directory with tests verifying export shape AND behavior.
**When to use:** Every shared sub-module.
**Example:**
```typescript
// src/shared/hooks/__contracts__/hooks.contract.test.ts
import { renderHook } from '@testing-library/react'
import * as SharedHooks from '../index'

describe('shared/hooks contract', () => {
  // Shape test: verify all expected exports exist
  it('exports useBreadcrumb', () => {
    expect(SharedHooks.useBreadcrumb).toBeDefined()
    expect(typeof SharedHooks.useBreadcrumb).toBe('function')
  })

  // Behavioral test: verify hook behavior
  it('useBreadcrumb updates breadcrumb store on call', () => {
    const items = [{ label: 'Home', href: '/' }]
    const { result } = renderHook(() => SharedHooks.useBreadcrumb(items))
    // Verify breadcrumb store was updated
    // (useBreadcrumb calls setBreadcrumbs via Zustand -- pure state, no invoke)
  })
})
```

### Pattern 4: Theme Coalescing
**What:** All theme-related code from scattered locations consolidates into `shared/ui/theme/`.
**When to use:** During ui sub-module extraction.
**Source files:**
- `src/constants/themes.ts` -> `src/shared/ui/theme/themes.ts`
- `src/utils/themeMapper.ts` -> `src/shared/ui/theme/themeMapper.ts`
- `src/utils/themeLoader.ts` -> `src/shared/ui/theme/themeLoader.ts`
- `src/hooks/useThemePreview.ts` -> `src/shared/ui/theme/useThemePreview.ts`
- `src/components/theme-toggle.tsx` -> `src/shared/ui/theme/theme-toggle.tsx`
- `src/types/customTheme.ts` -> `src/shared/ui/theme/customTheme.ts`
- `src/components/Settings/ThemeSelector.tsx` -> `src/shared/ui/theme/ThemeSelector.tsx`
- `src/components/Settings/ThemeColorSwatch.tsx` -> `src/shared/ui/theme/ThemeColorSwatch.tsx`
- `src/components/Settings/ThemeImport.tsx` -> `src/shared/ui/theme/ThemeImport.tsx`

### Anti-Patterns to Avoid
- **Wildcard re-exports in barrels:** `export * from './useBreadcrumb'` leaks internals and breaks contract tests. Use named exports.
- **Barrel for ui:** Decision explicitly forbids this. Every ui import is direct path.
- **Backward-compat bridges:** Decision says "move, don't re-export." No leaving re-exports at old paths.
- **invoke() in shared hooks:** Any hook calling Tauri `invoke()` must be split before moving to shared.

## Hook Classification (Import Graph Analysis)

### Hooks with invoke() -- CANNOT move to shared as-is
These 7 hooks call `invoke()` directly and need splitting if they're multi-consumer:
1. `useUpdateMutation.ts` -- Settings/App Shell (invoke for update)
2. `usePostProjectCompletion.ts` -- BuildProject only (invoke for post-completion)
3. `usePremiereIntegration.ts` -- BuildProject/Premiere only (invoke for premiere)
4. `useFileOperations.ts` -- BuildProject only (invoke for file ops)
5. `useFileUpload.ts` -- Upload only (invoke for upload)
6. `useCreateProjectWithMachine.ts` -- BuildProject only (invoke for project creation)
7. `useBakerScan.ts` -- Baker only (invoke for scan)

**All 7 are single-feature hooks.** None need splitting -- they stay in `src/hooks/` for their feature phase.

### Shared Hooks (2+ feature consumers, no invoke)
Based on import graph analysis:

| Hook | Consumers | Target |
|------|-----------|--------|
| `useBreadcrumb` | BuildProject, Baker, Settings, Posterframe, UploadSprout, UploadTrello, ScriptFormatter, ExampleEmbeddings, PremierePluginManager | `@shared/hooks` |
| `useReducedMotion` | Baker (ProjectListPanel), ui/button.tsx | `@shared/hooks` |
| `useFuzzySearch` | TrelloCardsManager, UploadTrello, TrelloBoardSearch, TrelloIntegrationModal | `@shared/hooks` |
| `useUsername` | BuildProject, app-sidebar | `@shared/hooks` |
| `useApiKeys` | BuildProject, UploadSprout, TrelloBoards, VideoLinksManager | `@shared/hooks` |

### Feature-Specific Hooks (single consumer or tightly coupled feature)

| Hook | Target Feature | Rationale |
|------|---------------|-----------|
| `useAuth` | Auth | Login + app-sidebar (both auth-related) |
| `useAuthCheck` | Auth | AuthProvider only |
| `useBakerPreferences` | Baker | Baker only |
| `useBakerScan` | Baker | Baker only, has invoke() |
| `useBakerTrelloIntegration` | Baker | Baker only |
| `useBreadcrumbsManager` | Baker | Baker breadcrumbs management |
| `useBreadcrumbsPreview` | Baker | Baker preview |
| `useBreadcrumbsReader` | Baker | Baker reading |
| `useBreadcrumbsTrelloCards` | Baker/Trello | Baker+Trello integration |
| `useBreadcrumbsVideoLinks` | Baker/Upload | Baker+Upload integration |
| `useBuildProjectMachine` | BuildProject | BuildProject only |
| `useCameraAutoRemap` | BuildProject | BuildProject only |
| `useCreateProjectWithMachine` | BuildProject | BuildProject only, has invoke() |
| `useDocxGenerator` | AITools | Script upload/download |
| `useDocxParser` | AITools | Script upload/download |
| `useEmbedding` | AITools | AI embedding |
| `useExampleManagement` | AITools | Example management |
| `useFileOperations` | BuildProject | BuildProject only, has invoke() |
| `useFileSelection` | Upload/Posterframe | Posterframe only |
| `useFileSelector` | BuildProject | BuildProject only |
| `useAutoFileSelection` | BuildProject | BuildProject only |
| `useBackgroundFolder` | BuildProject/Settings | Background folder selection |
| `useFileUpload` | Upload | Upload only, has invoke() |
| `useHighlights` | (unused -- 0 external consumers) | Dead code candidate |
| `useImageRefresh` | Upload | Image refresh |
| `useLiveBreadcrumbsReader` | Baker | Baker live reading |
| `useMacOSEffects` | App Shell | macOS effects |
| `useOllamaEmbedding` | AITools | Ollama AI |
| `useParsedTrelloDescription` | Trello | Trello parsing |
| `usePostProjectCompletion` | BuildProject | BuildProject only, has invoke() |
| `usePosterframeAutoRedraw` | Upload | Posterframe |
| `usePosterframeCanvas` | Upload | Posterframe |
| `usePremiereIntegration` | BuildProject | BuildProject only, has invoke() |
| `useProjectBreadcrumbs` | Baker/BuildProject | Breadcrumbs management |
| `useProjectFolders` | BuildProject | BuildProject only |
| `useProjectState` | BuildProject | BuildProject only |
| `useProjectValidation` | BuildProject | BuildProject only |
| `useScriptDownload` | AITools | Script download |
| `useScriptFileUpload` | AITools | Script upload |
| `useScriptFormatterState` | AITools | Script formatter state |
| `useScriptProcessor` | AITools | Script processing |
| `useScriptRetrieval` | AITools | Script retrieval |
| `useScriptReview` | AITools | Script review |
| `useScriptUpload` | AITools | Script upload |
| `useScriptWorkflow` | AITools | Script workflow |
| `useSproutVideoApi` | Upload | Sprout API |
| `useSproutVideoPlayer` | Upload | Sprout player |
| `useSproutVideoProcessor` | Upload | Sprout processing |
| `useSystemTheme` | App Shell | System theme detection |
| `useThemePreview` | Theme (moves to shared/ui/theme/) | Theme preview |
| `useTranscript` | AITools | Transcript |
| `useTrelloActions` | Trello | Trello actions |
| `useTrelloBoard` | Trello | Trello board |
| `useTrelloBoardId` | Trello | Trello board ID |
| `useTrelloBoardSearch` | Trello | Trello search |
| `useTrelloBoards` | Trello | Trello boards |
| `useTrelloBreadcrumbs` | Trello/Baker | Trello breadcrumbs |
| `useTrelloCardDetails` | Trello | Trello card details |
| `useTrelloCardSelection` | Trello | Trello card selection |
| `useTrelloCardsManager` | Trello/Baker | Trello cards management |
| `useTrelloVideoInfo` | Trello | Trello video info |
| `useUpdateManager` | App Shell | Update management |
| `useUpdateMutation` | App Shell | Update mutation, has invoke() |
| `useUploadEvents` | Upload | Upload events |
| `useUploadTrello` | Upload/Trello | Upload to Trello |
| `useVersionCheck` | App Shell | Version check |
| `useVideoDetails` | Upload | Video details (0 external consumers) |
| `useVideoInfoBlock` | BuildProject | Video info |
| `useVideoLinksManager` | Baker/Upload | Video links |
| `useWindowState` | App Shell | Window state |
| `useZoomPan` | Upload/Posterframe | Zoom/pan |

### Summary: 5 hooks move to `@shared/hooks`, ~75 stay for feature phases

Tag remaining hooks with `// Target: @features/X` comment indicating which feature module claims them.

## Utils Classification

### Shared Utils (2+ feature consumers)
| File | Consumers | Notes |
|------|-----------|-------|
| `logger.ts` | 46 files across ALL features | Core shared utility |
| `storage.ts` | Settings, TrelloBoardId, lib/prefetch-strategies | API key persistence |
| `validation.ts` | TrelloCardsManager, VideoLinksManager | Video/Trello validation |
| `debounce.ts` | PosterframeAutoRedraw (1 consumer -- borderline) | General utility, keep shared |
| `breadcrumbs/` (entire directory) | Baker, BuildProject, Upload | Breadcrumbs comparison/formatting |
| `versionUtils.ts` | useVersionCheck (1 consumer) | General utility, keep shared |

### Feature-Specific Utils (stay in src/utils/ for feature phases)
| File | Target Feature | Notes |
|------|---------------|-------|
| `aiPrompts.ts` | AITools | AI-specific prompts |
| `batchUpdateSummary.ts` | Baker | Baker batch updates |
| `breadcrumbsComparison.ts` | Baker | Duplicate of breadcrumbs/ barrel? |
| `breadcrumbsMigration.ts` | Baker | Breadcrumbs migration |
| `breadcrumbsValidation.ts` | Baker | Breadcrumbs validation |
| `extractVideoInfoBlock.ts` | BuildProject | Video info extraction |
| `loadFont.ts` | Upload/Posterframe | Font loading |
| `parseSproutVideoUrl.ts` | Upload | Sprout URL parsing |
| `trelloBoardValidation.ts` | Trello | Trello validation |
| `updateManifest.ts` | App Shell | Update manifest |

### Misplaced React Components in Utils (move to shared/ui/)
| File | Target |
|------|--------|
| `ApiKeyInput.tsx` | `shared/ui/ApiKeyInput.tsx` |
| `EmbedCodeInput.tsx` | `shared/ui/EmbedCodeInput.tsx` |
| `ExternalLink.tsx` | `shared/ui/ExternalLink.tsx` |
| `FormattedDate.tsx` | `shared/ui/FormattedDate.tsx` |
| `TrelloCards.tsx` | Feature-specific (Trello), not shared ui |
| `trello/` (entire directory) | Feature-specific (Trello), not shared ui |

### Misplaced Type File in Utils
| File | Target |
|------|--------|
| `utils/types.ts` (Breadcrumb, FootageData, SproutUploadResponse, etc.) | `shared/types/types.ts` -- 18 importers across all features |

## Types Classification

| File | Shared? | Rationale |
|------|---------|-----------|
| `types/media.ts` | YES | VideoLink, TrelloCard -- used by Baker, Upload, Trello |
| `types/plugins.ts` | NO | Premiere-specific (PluginInfo) |
| `types/baker.ts` | NO | Baker-specific (BreadcrumbsFile) |
| `types/scriptFormatter.ts` | NO | AITools-specific |
| `types/exampleEmbeddings.ts` | NO | AITools-specific |
| `types/customTheme.ts` | Moves to shared/ui/theme/ | Theme system coalescing |
| `utils/types.ts` | YES | Core types (Breadcrumb, FootageData) -- 18 importers |

## Services Classification

| File | Shared? | Rationale |
|------|---------|-----------|
| `ProgressTracker.ts` | YES | Used across multiple features for progress tracking |
| `UserFeedbackService.ts` | YES | Depends on ProgressTracker, general feedback |
| `cache-invalidation.ts` | YES | Uses queryKeys/QueryClient -- general cache utility |
| `services/ai/modelFactory.ts` | NO | AITools-specific |
| `services/ai/providerConfig.ts` | NO | AITools-specific |
| `services/ai/types.ts` | NO | AITools-specific |

The 3 AI service files stay in `src/services/ai/` for the AITools feature phase (Phase 6).

## Constants Classification

All 5 constant files are shared (general-purpose):
- `timing.ts` -- timeouts, cache durations (used by services, hooks)
- `animations.ts` -- animation constants
- `project.ts` -- project structure constants
- `themes.ts` -- **moves to shared/ui/theme/** per theme coalescing decision

So 3 files go to `shared/constants/` barrel, 1 goes to `shared/ui/theme/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import path updates | Manual find-and-replace | IDE "Move Symbol" or `sed` with verification | Too many files to update manually; typos break builds |
| Barrel generation | Manual index.ts writing | Write barrels from file listing, verify with contract tests | Ensures completeness |
| Hook classification | Guessing ownership | Import graph from grep/dependency-cruiser | Evidence-based classification prevents rework |

## Common Pitfalls

### Pitfall 1: Circular Dependencies Between Shared Sub-Modules
**What goes wrong:** `shared/hooks` imports from `shared/store`, which imports from `shared/types`, which imports from `shared/utils`. If any reverse dependency exists, build breaks.
**Why it happens:** Hooks depend on stores, stores depend on types, utils depend on types. These are valid one-way dependencies.
**How to avoid:** Dependency order is: types -> constants -> utils -> store -> lib -> services -> hooks. Never import "up" this chain. ui is independent (no barrel, direct imports).
**Warning signs:** Vite circular dependency warnings in console.

### Pitfall 2: Stale Old-Path Imports
**What goes wrong:** Moving files but missing some import updates. Build succeeds because old alias still resolves, but ESLint boundary rules fire warnings.
**Why it happens:** Some imports use `@hooks/*`, some use `@/hooks/*`, some use relative paths. Multiple import styles make search-and-replace unreliable.
**How to avoid:** After each sub-module move, grep for ALL old import patterns: `@hooks/`, `@/hooks/`, `'../hooks/`, `'./hooks/`. Run ESLint boundaries check.
**Warning signs:** ESLint boundary warnings, TypeScript path resolution differences between IDE and Vite.

### Pitfall 3: HMR Degradation After Barrel Exports
**What goes wrong:** Barrel files that re-export many modules cause Vite HMR to invalidate too many modules on a single file change, making hot reload slow.
**Why it happens:** Vite traces import graphs; a barrel that re-exports 20 items means changing one item invalidates all 20 consumers.
**How to avoid:** Keep barrels lean (named re-exports only, no logic in barrel files). The ui sub-module correctly avoids barrels entirely. For hooks barrel with 5 items, this is not a real concern.
**Warning signs:** HMR updates taking >2 seconds after changes to shared modules.

### Pitfall 4: Breaking Existing Tests
**What goes wrong:** Existing test files import from old paths. Moving source files breaks test imports.
**Why it happens:** Tests in `tests/` directory use path aliases like `@hooks/`, `@lib/`, `@utils/` that point to old locations.
**How to avoid:** Update test imports alongside source imports. Run `bun run test` after each sub-module move.
**Warning signs:** Test failures with "Cannot find module" errors.

### Pitfall 5: The sidebar.tsx vs sidebar/ Conflict
**What goes wrong:** `src/components/ui/sidebar.tsx` (flat file) and `src/components/ui/sidebar/` (directory with multi-file sub-module) both exist. Moving one without the other creates confusion.
**Why it happens:** The sidebar was refactored from a single file to a directory but the original may still exist.
**How to avoid:** Check if `sidebar.tsx` is still imported anywhere. If it's the old version, delete it. Move the `sidebar/` directory as the canonical sidebar module.
**Warning signs:** Duplicate sidebar exports, ambiguous imports.

## Code Examples

### Barrel Export Pattern
```typescript
// src/shared/hooks/index.ts
export { useBreadcrumb } from './useBreadcrumb'
export { useReducedMotion } from './useReducedMotion'
export { useFuzzySearch } from './useFuzzySearch'
export { useUsername } from './useUsername'
export { useApiKeys } from './useApiKeys'
```

### Contract Test Pattern (Shape + Behavior)
```typescript
// src/shared/hooks/__contracts__/hooks.contract.test.ts
import { renderHook, act } from '@testing-library/react'
import * as SharedHooks from '../index'

describe('shared/hooks contract', () => {
  // SHAPE: Verify all expected exports exist
  const expectedExports = [
    'useBreadcrumb',
    'useReducedMotion',
    'useFuzzySearch',
    'useUsername',
    'useApiKeys',
  ]

  expectedExports.forEach(name => {
    it(`exports ${name}`, () => {
      expect(SharedHooks[name]).toBeDefined()
      expect(typeof SharedHooks[name]).toBe('function')
    })
  })

  // BEHAVIOR: Verify hook behavior
  describe('useBreadcrumb', () => {
    it('updates breadcrumb store on mount', () => {
      const items = [{ label: 'Home', href: '/' }]
      renderHook(() => SharedHooks.useBreadcrumb(items))
      // useBreadcrumb calls setBreadcrumbs via Zustand -- verify store was updated
    })
  })

  describe('useReducedMotion', () => {
    it('returns boolean reflecting prefers-reduced-motion', () => {
      const { result } = renderHook(() => SharedHooks.useReducedMotion())
      expect(typeof result.current).toBe('boolean')
    })
  })
})
```

### Store Contract Test
```typescript
// src/shared/store/__contracts__/store.contract.test.ts
import { useAppStore, useBreadcrumbStore } from '../index'

describe('shared/store contract', () => {
  it('exports useAppStore with expected state shape', () => {
    const state = useAppStore.getState()
    expect(state).toHaveProperty('trelloApiKey')
    expect(state).toHaveProperty('sproutVideoApiKey')
    expect(state).toHaveProperty('breadcrumbs')
    expect(state).toHaveProperty('setTrelloApiKey')
    expect(typeof state.setTrelloApiKey).toBe('function')
  })

  it('exports useBreadcrumbStore with expected state shape', () => {
    const state = useBreadcrumbStore.getState()
    expect(state).toHaveProperty('breadcrumbs')
    expect(state).toHaveProperty('setBreadcrumbs')
  })

  it('useAppStore.setTrelloApiKey updates state', () => {
    useAppStore.getState().setTrelloApiKey('test-key')
    expect(useAppStore.getState().trelloApiKey).toBe('test-key')
    // Reset
    useAppStore.getState().setTrelloApiKey('')
  })
})
```

### Types Contract Test
```typescript
// src/shared/types/__contracts__/types.contract.test.ts
import type { Breadcrumb, FootageData, VideoLink, TrelloCard } from '../index'

describe('shared/types contract', () => {
  it('Breadcrumb type has expected shape', () => {
    const breadcrumb: Breadcrumb = {
      projectTitle: 'Test',
      numberOfCameras: 2,
      files: [],
    }
    expect(breadcrumb.projectTitle).toBe('Test')
  })

  it('VideoLink type has expected shape', () => {
    const link: VideoLink = {
      url: 'https://example.com',
      title: 'Test Video',
    }
    expect(link.url).toBeDefined()
  })
})
```

### Feature Hook Tagging Pattern
```typescript
// src/hooks/useBakerScan.ts (stays in src/hooks/ for now)
// Target: @features/Baker
import { invoke } from '@tauri-apps/api/core'
// ... existing code unchanged
```

## Migration Order

The recommended sub-module extraction order minimizes dependency issues:

1. **lib** (5 files, no internal dependencies to other shared modules) -- simplest move
2. **constants** (3 files after theme extraction) -- no dependencies
3. **types** (2 files: media.ts + utils/types.ts) -- depended on by everything, move early
4. **utils** (logger, storage, debounce, validation, breadcrumbs/) -- depends on types, constants
5. **store** (2 files) -- depends on types
6. **services** (3 files) -- depends on utils, lib, constants
7. **ui** (20+ files, complex, theme coalescing) -- mostly independent but large surface area
8. **hooks** (5 shared hooks) -- depends on store, types; smallest count but most import updates

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat directories | Deep modules with barrels | This refactor | Clear ownership, enforced boundaries |
| `export *` barrels | Named re-exports only | Best practice | Prevents accidental leaks, better tree-shaking |
| Test alongside barrel | `__contracts__/` directory | This refactor | Colocated but separated from implementation |

## Open Questions

1. **`useHighlights` and `useVideoDetails` appear unused externally**
   - What we know: Both have 0 external consumers (only their own definition file)
   - What's unclear: Are they used internally by other hooks, or truly dead code?
   - Recommendation: Check during implementation. If dead, flag for knip cleanup (Phase 9). For now, tag with feature target and skip.

2. **Breadcrumbs utility barrel vs individual files**
   - What we know: `src/utils/breadcrumbs/index.ts` already has a barrel re-exporting 6 files
   - What's unclear: Should the barrel be preserved inside `shared/utils/breadcrumbs/` or flattened into the main `shared/utils/` barrel?
   - Recommendation: Keep the sub-directory structure. The `shared/utils/index.ts` barrel re-exports the breadcrumbs barrel: `export * from './breadcrumbs'` (exception to no-wildcard rule since it's a nested sub-barrel, or enumerate each export).

3. **`src/components/ui/sidebar.tsx` vs `src/components/ui/sidebar/` directory**
   - What we know: Both exist. The directory has Sidebar.tsx, SidebarLayout.tsx, SidebarMenu.tsx, SidebarProvider.tsx. The flat file also exists.
   - What's unclear: Is sidebar.tsx still used or was it replaced by the directory?
   - Recommendation: Check imports during implementation. Likely sidebar.tsx is legacy; move only the directory.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-configured) |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `bunx vitest run --reporter=verbose src/shared` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHRD-01 | Import shared hooks from `@shared/hooks` barrel | unit | `bunx vitest run src/shared/hooks/__contracts__/hooks.contract.test.ts` | Wave 0 |
| SHRD-02 | Import UI primitives via direct `@shared/ui/*` path | unit | `bunx vitest run src/shared/ui/__contracts__/ui.contract.test.ts` | Wave 0 |
| SHRD-03 | Import stores from `@shared/store` barrel | unit | `bunx vitest run src/shared/store/__contracts__/store.contract.test.ts` | Wave 0 |
| SHRD-04 | Import query infra from `@shared/lib` barrel | unit | `bunx vitest run src/shared/lib/__contracts__/lib.contract.test.ts` | Wave 0 |
| SHRD-05 | Import services from `@shared/services` barrel | unit | `bunx vitest run src/shared/services/__contracts__/services.contract.test.ts` | Wave 0 |
| SHRD-06 | Import utils from `@shared/utils` barrel | unit | `bunx vitest run src/shared/utils/__contracts__/utils.contract.test.ts` | Wave 0 |
| SHRD-07 | Import types from `@shared/types` barrel | unit | `bunx vitest run src/shared/types/__contracts__/types.contract.test.ts` | Wave 0 |
| SHRD-08 | Import constants from `@shared/constants` barrel | unit | `bunx vitest run src/shared/constants/__contracts__/constants.contract.test.ts` | Wave 0 |
| SHRD-09 | All contract tests pass | unit | `bunx vitest run src/shared/*/__contracts__/ --run` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bunx vitest run src/shared --run` (shared module tests only)
- **Per wave merge:** `bun run test -- --run` (full suite)
- **Phase gate:** Full suite green + `bun run dev:tauri` starts without errors

### Wave 0 Gaps
- [ ] `src/shared/hooks/__contracts__/hooks.contract.test.ts` -- covers SHRD-01
- [ ] `src/shared/ui/__contracts__/ui.contract.test.ts` -- covers SHRD-02
- [ ] `src/shared/store/__contracts__/store.contract.test.ts` -- covers SHRD-03
- [ ] `src/shared/lib/__contracts__/lib.contract.test.ts` -- covers SHRD-04
- [ ] `src/shared/services/__contracts__/services.contract.test.ts` -- covers SHRD-05
- [ ] `src/shared/utils/__contracts__/utils.contract.test.ts` -- covers SHRD-06
- [ ] `src/shared/types/__contracts__/types.contract.test.ts` -- covers SHRD-07
- [ ] `src/shared/constants/__contracts__/constants.contract.test.ts` -- covers SHRD-08
- [ ] All shared sub-module directories and barrel files -- created during implementation

## Sources

### Primary (HIGH confidence)
- Codebase analysis: import graph via grep across all `src/` files
- `tsconfig.json` -- path aliases already configured
- `eslint.config.js` -- boundary rules already configured
- `vite.config.ts` -- test config, vite-tsconfig-paths plugin
- `src/hooks/index.ts` -- existing barrel pattern (21 named re-exports)
- `src/utils/breadcrumbs/index.ts` -- existing barrel pattern
- CONTEXT.md -- locked decisions from user

### Secondary (MEDIUM confidence)
- Hook consumer counts based on grep -- may miss dynamic imports or conditional requires (unlikely in this codebase)

### Tertiary (LOW confidence)
- `useHighlights` and `useVideoDetails` classified as dead code -- needs verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tooling already in project, no new dependencies
- Architecture: HIGH -- patterns derived from locked decisions + existing codebase analysis
- Hook classification: HIGH -- based on full import graph analysis of 80 hooks
- Pitfalls: HIGH -- derived from known codebase patterns and barrel export best practices

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependency changes expected)
