# Phase 5: Settings Module - Research

**Researched:** 2026-03-09
**Domain:** React component decomposition, feature module migration, API layer pattern
**Confidence:** HIGH

## Summary

Phase 5 decomposes the 527-line Settings.tsx monolith into a `@features/Settings` deep feature module following the exact patterns established in Phases 3-4 (Trello, Upload modules). The monolith contains 5 visual sections (AI Models, Appearance, Backgrounds, SproutVideo, Trello) that map directly to 5 sub-components. All I/O (Tauri plugin-dialog, plugin-shell, storage read/write) consolidates into a single `api.ts` boundary. The `useAIProvider` hook moves into the Settings module since Settings is its only consumer.

A critical finding: `loadApiKeys` and `saveApiKeys` from `@shared/utils/storage` are consumed by MULTIPLE modules (Trello hooks, shared `useApiKeys` hook, prefetch strategies), NOT just Settings. The CONTEXT.md decision says "storage.ts moves INTO Settings api.ts" but the `loadApiKeys` function must remain accessible to those other consumers. The correct approach is to wrap `loadApiKeys`/`saveApiKeys` calls in Settings' `api.ts` as local wrappers that call through to `@shared/utils/storage`, maintaining the single-mock-point pattern without breaking other modules' direct imports. Alternatively, Settings api.ts re-exports them, but the cleanest approach is keeping `@shared/utils/storage` as the canonical location and having Settings api.ts import from it.

**Primary recommendation:** Follow the Trello/Upload module pattern exactly. Create 5 sub-components with self-contained save logic, a thin api.ts wrapping dialog/shell/storage calls, move useAIProvider in, and write fresh contract tests. The storage.ts functions stay in `@shared/utils/` since they have multiple consumers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **5 sub-components, one per domain**: AIModelsSection, AppearanceSection, BackgroundsSection, SproutVideoSection, TrelloSection
- Each sub-component stays under ~100 lines, independently testable
- **Keep accordion layout** -- each sub-component wraps its content in an AccordionItem, no visual change
- **Keep hash-based scroll navigation** -- sidebar links with #ai-models, #appearance, etc. preserved with scrollIntoView
- **Each sub-component owns its save logic** -- useMutation, validation, save button all self-contained. Parent Settings page is layout-only
- **api.ts wraps everything**: Tauri plugin calls (openPath for folder picker, open for URLs) AND storage utils (loadApiKeys, saveApiKeys)
- Single I/O boundary -- mock one file to isolate the entire module. Consistent with Phase 3/4 pattern
- **useAIProvider moves INTO Settings module** -- single consumer (Settings only), its fetch() calls route through Settings api.ts
- **storage.ts (loadApiKeys, saveApiKeys) moves into Settings api.ts** -- Settings is the only writer. Other modules read API keys from the Zustand store, not from storage directly
- **Drop ConnectedApps.tsx entirely** -- 8-line stub with no functionality. Delete file and remove its route. Recoverable from git history
- **Keep TrelloBoardSelector import from @features/Trello barrel** -- module-to-module imports through public interfaces
- **Keep ThemeSelector in @shared/ui/theme/** -- multiple consumers (Settings + sidebar theme toggle). Phase 2 decision preserved
- **ApiKeyInput stays in @shared/ui/** -- reusable UI primitive, not Settings-specific
- **Fresh contract tests only** -- delete existing Settings.test.tsx (363 lines), write new __contracts__/ tests following established pattern
- **Shape + Settings-owned behavior** -- verify barrel exports the right members, test Settings-owned hooks/logic
- **Mock cross-module dependencies** -- TrelloBoardSelector, ThemeSelector mocked in tests. Each module tests its own surface
- **1 plan total** -- atomic: module structure, decompose monolith, build api.ts, move hooks, update consumers, contract tests. No broken intermediate state

### Claude's Discretion
- Exact sub-component file naming (flat with prefixes per Phase 4 convention)
- Internal organization of api.ts (sections, function grouping)
- Which hooks get behavioral tests vs shape-only in contracts
- How to handle the shared save infrastructure (React Query mutations) across sub-components
- Whether useAIProvider stays as a hook or gets absorbed into api.ts functions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STNG-01 | User can import Settings components, hooks, and types from `@features/Settings` barrel only | Barrel pattern documented from Trello/Upload; exact export list derived from monolith analysis |
| STNG-02 | User can see Settings decomposed into per-domain sub-components (no 523-line monolith) | 5 sections identified in monolith (AI Models, Appearance, Backgrounds, SproutVideo, Trello); each maps to one sub-component under ~100 lines |
| STNG-03 | User can see an API layer wrapping Settings-related Tauri commands | All I/O calls catalogued: openPath (dialog), open (shell), loadApiKeys, saveApiKeys (storage), plus useAIProvider's providerRegistry calls |
| STNG-04 | User can see contract tests validating Settings module's public interface | Contract test patterns from Trello/Upload analyzed; shape tests + behavioral tests for Settings-owned hooks |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3 | Component framework | Project standard |
| TypeScript | 5.7 | Type safety | Project standard |
| TanStack React Query | latest | Data fetching, mutations | Project standard for async state |
| Zustand | latest | Global state (useAppStore) | Project standard |
| Vitest | latest | Testing framework | Project standard |
| @testing-library/react | latest | Component/hook test rendering | Project standard |

### Supporting (used by Settings specifically)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-dialog | 2.x | Folder picker (openPath) | BackgroundsSection folder selection |
| @tauri-apps/plugin-shell | 2.x | URL opener (open) | TrelloSection authorization URL |
| @shared/utils/storage | N/A | loadApiKeys/saveApiKeys | Settings api.ts wraps these for save mutations |
| lucide-react | latest | Icons (AlertTriangle, CheckCircle, etc.) | Connection status UI in AIModelsSection |
| react-router-dom | latest | useLocation for hash navigation | Settings page scroll-to-section |

### No Alternatives Needed
This is a structural refactor using existing libraries. No new dependencies required.

## Architecture Patterns

### Recommended Module Structure
```
src/features/Settings/
  api.ts                        # Single I/O boundary (dialog, shell, storage, AI provider validation)
  types.ts                      # ConnectionStatus, SettingsSection types
  index.ts                      # Barrel: named re-exports only, no wildcards
  hooks/
    useAIProvider.ts             # Moved from src/hooks/ (single consumer: Settings)
    useSettingsScroll.ts         # Extract scroll-to-section logic from monolith
  components/
    SettingsPage.tsx             # Layout-only parent: header + sections wrapper + ErrorBoundary
    AIModelsSection.tsx          # Ollama URL, test connection, save
    AppearanceSection.tsx        # ThemeSelector accordion wrapper
    BackgroundsSection.tsx       # Default folder picker + save
    SproutVideoSection.tsx       # SproutVideo API key input + save
    TrelloSection.tsx            # Trello API key, token, auth, board selector + save
  __contracts__/
    settings.contract.test.ts   # Shape + behavioral tests
```

### Pattern 1: Sub-Component with Self-Contained Save
**What:** Each section component manages its own local state, mutation, and save button
**When to use:** Every Settings sub-component (AIModelsSection, BackgroundsSection, SproutVideoSection, TrelloSection)
**Example:**
```typescript
// Source: Derived from current monolith pattern + CONTEXT.md decision
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveSettingsApiKeys } from '../api'
import { queryKeys } from '@shared/lib/query-keys'

export const SproutVideoSection: React.FC<{ apiKeys: ApiKeys }> = ({ apiKeys }) => {
  const queryClient = useQueryClient()
  const [localKey, setLocalKey] = useState(apiKeys.sproutVideo || '')

  const saveMutation = useMutation({
    mutationFn: (newKeys: Partial<ApiKeys>) => saveSettingsApiKeys({ ...apiKeys, ...newKeys }),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(queryKeys.settings.apiKeys(), { ...apiKeys, ...variables })
    }
  })

  const handleSave = () => saveMutation.mutate({ sproutVideo: localKey })

  return (
    <section id="sproutvideo" className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16">
      {/* Section header + ApiKeyInput + Save button */}
    </section>
  )
}
```

### Pattern 2: Layout-Only Parent Page
**What:** SettingsPage renders header + maps over sub-components. Zero business logic
**When to use:** The Settings page component
**Example:**
```typescript
// Source: CONTEXT.md locked decision -- parent is layout-only
const SettingsPageContent: React.FC = () => {
  useSettingsScroll() // hash-based scroll navigation

  const { data: apiKeys = {} } = useQuery({
    ...createQueryOptions(queryKeys.settings.apiKeys(), () => loadSettingsApiKeys(), 'DYNAMIC')
  })

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        <SettingsHeader />
        <div className="max-w-full space-y-8 px-6 py-4">
          <AIModelsSection apiKeys={apiKeys} />
          <AppearanceSection />
          <BackgroundsSection apiKeys={apiKeys} />
          <SproutVideoSection apiKeys={apiKeys} />
          <TrelloSection apiKeys={apiKeys} />
        </div>
      </div>
    </div>
  )
}
```

### Pattern 3: api.ts as Single I/O Boundary
**What:** All external calls wrapped in api.ts. Sub-components and hooks import from api.ts, never from Tauri plugins directly
**When to use:** Every I/O operation in the Settings module
**Example:**
```typescript
// Source: Trello api.ts pattern (Phase 3)
import { open as openPath } from '@tauri-apps/plugin-dialog'
import { open } from '@tauri-apps/plugin-shell'
import { loadApiKeys, saveApiKeys, type ApiKeys } from '@shared/utils/storage'

// --- Dialog Wrappers ---
export async function openFolderPicker(): Promise<string | null> {
  const folder = await openPath({ directory: true, multiple: false })
  return typeof folder === 'string' ? folder : null
}

export async function openExternalUrl(url: string): Promise<void> {
  return open(url)
}

// --- Storage Wrappers ---
export async function loadSettingsApiKeys(): Promise<ApiKeys> {
  return loadApiKeys()
}

export async function saveSettingsApiKeys(keys: ApiKeys): Promise<void> {
  return saveApiKeys(keys)
}

// Re-export the type for consumers
export type { ApiKeys } from '@shared/utils/storage'
```

### Pattern 4: Contract Test Structure
**What:** `__contracts__/settings.contract.test.ts` follows Trello/Upload pattern exactly
**When to use:** Validating the module's public surface
**Example:**
```typescript
// Source: Trello contract test pattern (Phase 3)

// Mock the api layer (single mock point for all Settings I/O)
vi.mock('../api', () => ({
  openFolderPicker: vi.fn().mockResolvedValue(null),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  loadSettingsApiKeys: vi.fn().mockResolvedValue({}),
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined),
  validateAIProvider: vi.fn().mockResolvedValue({ success: true })
}))

// Mock cross-module dependencies
vi.mock('@features/Trello', () => ({
  TrelloBoardSelector: () => null
}))
vi.mock('@shared/ui/theme/ThemeSelector', () => ({
  ThemeSelector: () => null
}))

import * as settingsBarrel from '../index'

describe('Settings Barrel Exports - Shape', () => {
  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(settingsBarrel).sort()
    expect(exportNames).toEqual([...expectedExports].sort())
  })
})
```

### Anti-Patterns to Avoid
- **Shared mutation hook:** Don't create a `useSettingsMutation` shared hook. CONTEXT.md says each sub-component owns its save logic self-contained. Duplicating `useMutation` across 4 components is fine -- it's ~5 lines each.
- **Props drilling apiKeys to deeply nested children:** The parent loads apiKeys once via useQuery, passes to each section as a prop. Don't create a Settings-specific context or provider.
- **Moving storage.ts entirely into Settings:** `loadApiKeys` has consumers in `@shared/hooks/useApiKeys`, `@features/Trello/hooks/useTrelloBoardId`, `@features/Trello/hooks/useTrelloBoard`, and `@shared/lib/prefetch-strategies`. Settings api.ts wraps these calls but does NOT absorb the canonical implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key persistence | Custom file I/O | Existing `@shared/utils/storage` (loadApiKeys/saveApiKeys) | Already handles appDataDir, JSON serialization, Zustand store sync |
| Folder picker | Custom file dialog | `@tauri-apps/plugin-dialog` (openPath) | Native OS dialog, already used |
| URL opening | Custom shell exec | `@tauri-apps/plugin-shell` (open) | Tauri's secure URL opener |
| Theme UI | Custom theme picker | Existing `ThemeSelector` from `@shared/ui/theme/` | Already built, tested, multi-consumer |
| Board selector | Custom dropdown | Existing `TrelloBoardSelector` from `@features/Trello` | Already built with search, validation, error states |
| Query cache management | Manual state sync | TanStack React Query `setQueryData` + `queryKeys.settings.apiKeys()` | Already established pattern in monolith |

## Common Pitfalls

### Pitfall 1: Breaking storage.ts Consumers
**What goes wrong:** Moving `loadApiKeys`/`saveApiKeys` INTO Settings api.ts breaks Trello hooks, shared useApiKeys, and prefetch strategies that import directly from `@shared/utils/storage`
**Why it happens:** CONTEXT.md says "storage.ts moves into Settings api.ts" but multiple modules depend on it
**How to avoid:** Settings api.ts wraps the calls (import from @shared/utils/storage, re-export as `loadSettingsApiKeys`/`saveSettingsApiKeys`). The canonical functions stay in @shared/utils/storage. Other modules continue importing from @shared/utils/storage.
**Warning signs:** Import errors in Trello contract tests, prefetch-strategies, useApiKeys

### Pitfall 2: Sub-Components Using Stale apiKeys
**What goes wrong:** Each sub-component has local state initialized from `apiKeys` prop, but when one section saves, others don't see the updated cache
**Why it happens:** React Query cache updates are async; local state snapshots can go stale
**How to avoid:** Each sub-component initializes local state from the prop AND syncs via `useEffect` when prop changes (same pattern as current monolith lines 169-173). Alternatively, use the apiKeys query data directly without local state for display, only use local state for edit-in-progress values.
**Warning signs:** Saving in one section, switching to another, seeing old values

### Pitfall 3: ConnectedApps Route Removal Breaking Navigation
**What goes wrong:** Removing the ConnectedApps route without checking sidebar links causes 404s
**Why it happens:** Sidebar may have a link to /settings/connected-apps
**How to avoid:** Search for all references to "connected-apps" in sidebar components and remove them
**Warning signs:** Dead links in sidebar navigation

### Pitfall 4: useAIProvider Import Path Updates
**What goes wrong:** Moving useAIProvider from `@hooks/useAIProvider` to `@features/Settings` breaks the import in the monolith during migration
**Why it happens:** The hook is currently imported at `@hooks/useAIProvider` in Settings.tsx
**How to avoid:** Since Settings.tsx is being replaced entirely by the new module, the old import path just needs to be cleaned up (delete old file). Verify no other files import from `@hooks/useAIProvider`.
**Warning signs:** TypeScript errors on missing module `@hooks/useAIProvider`

### Pitfall 5: Hash Scroll Behavior After Decomposition
**What goes wrong:** Section IDs must remain on the outermost `<section>` element in each sub-component, not on an inner wrapper
**Why it happens:** Sub-components might wrap content in extra divs, moving the id attribute away from scroll-mt-16
**How to avoid:** Each sub-component's root element is `<section id="section-name" className="... scroll-mt-16">`. The existing pattern has `id` directly on `<section>`.
**Warning signs:** Hash navigation scrolls to wrong position or doesn't scroll at all

## Code Examples

### useAIProvider Migration Notes
The hook currently lives at `src/hooks/useAIProvider.ts` with a `// Target: @features/AITools` tag. Per CONTEXT.md, it moves to Settings instead (single consumer). Key details:
- Imports `providerRegistry` from `@services/ai/providerConfig` -- this stays as-is since AI services are shared infrastructure
- Uses `localStorage` directly for STORAGE_KEYS -- should route through api.ts for consistency
- Uses `useAppStore` for ollamaUrl -- stays as-is (shared store access is allowed)
- The `validateProvider` function calls `adapter.validateConnection(config)` -- wrap this in api.ts

### Existing Section ID Map (must be preserved)
```
#ai-models     -> AIModelsSection
#appearance    -> AppearanceSection
#backgrounds   -> BackgroundsSection
#sproutvideo   -> SproutVideoSection
#trello        -> TrelloSection
```

### apiKeys Query Pattern (keep exactly)
```typescript
// Source: Current monolith lines 77-94
const { data: apiKeys = {} } = useQuery({
  ...createQueryOptions(
    queryKeys.settings.apiKeys(),
    async () => loadSettingsApiKeys(),
    'DYNAMIC',
    {
      staleTime: CACHE.STANDARD,
      gcTime: CACHE.GC_MEDIUM,
      retry: (failureCount, error) => shouldRetry(error, failureCount, 'settings')
    }
  )
})
```

### Files to Delete
```
src/pages/Settings.tsx          -> replaced by src/features/Settings/components/SettingsPage.tsx
src/pages/Settings.test.tsx     -> replaced by src/features/Settings/__contracts__/settings.contract.test.ts
src/pages/ConnectedApps.tsx     -> dropped entirely (8-line stub)
src/hooks/useAIProvider.ts      -> moved to src/features/Settings/hooks/useAIProvider.ts
```

### Files to Update
```
src/AppRouter.tsx               -> import Settings from '@features/Settings', remove ConnectedApps import + route
src/shared/utils/storage.ts     -> stays unchanged (other modules depend on it)
src/shared/utils/index.ts       -> stays unchanged (re-exports loadApiKeys, saveApiKeys, ApiKeys type)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 527-line monolith with all sections in one file | Per-domain sub-components under ~100 lines each | Phase 5 | Testability, readability, maintainability |
| Direct Tauri plugin imports in components | api.ts single I/O boundary | Phase 3 | Mockability, consistent with module pattern |
| Settings.test.tsx (363 lines, full render tests) | __contracts__/ shape + behavioral tests | Phase 5 | Lighter tests, module boundary focus |

## Open Questions

1. **useAIProvider: hook or api.ts functions?**
   - What we know: CONTEXT.md lists this as Claude's discretion. The hook uses React state (useState) and reads from useAppStore.
   - Recommendation: Keep as a hook. It manages React state (availableProviders, activeProvider, connectionStatus) which is inherently hook territory. Its I/O calls (providerRegistry.get().validateConnection) should route through api.ts, but the hook orchestration stays as-is.

2. **How to pass apiKeys to sub-components?**
   - What we know: CONTEXT.md says parent is layout-only. The parent loads apiKeys via useQuery.
   - Recommendation: Pass `apiKeys` as a prop to each section that needs it (AIModels, Backgrounds, SproutVideo, Trello). AppearanceSection doesn't need it. This keeps the parent as the single data-loading point while sub-components stay self-contained for mutations.

3. **Save infrastructure duplication across sub-components**
   - What we know: CONTEXT.md says each sub-component owns its save logic. This means ~4 components each create their own useMutation.
   - Recommendation: Accept the duplication. Each mutation is ~8 lines. A shared hook would add indirection for minimal savings. Each component's save mutation is slightly different (different keys, different success messages).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, configured in vite.config.ts) |
| Config file | vite.config.ts `test` block |
| Quick run command | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STNG-01 | Barrel exports correct members | unit (shape) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | No - Wave 0 |
| STNG-02 | Sub-components render independently | unit (behavioral) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | No - Wave 0 |
| STNG-03 | api.ts wraps all Tauri commands | unit (shape) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | No - Wave 0 |
| STNG-04 | Contract tests validate public interface | unit (shape+behavioral) | `bun run test -- --run src/features/Settings/__contracts__/settings.contract.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run src/features/Settings/`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/Settings/__contracts__/settings.contract.test.ts` -- covers STNG-01, STNG-02, STNG-03, STNG-04
- [ ] No framework install needed -- Vitest already configured
- [ ] No shared fixtures needed -- contract tests are self-contained with vi.mock()

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/pages/Settings.tsx` (527 lines) -- all sections, handlers, imports catalogued
- Direct codebase analysis of `src/pages/Settings.test.tsx` (363 lines) -- existing test patterns understood
- Direct codebase analysis of `src/features/Trello/` -- reference module pattern (api.ts, index.ts, __contracts__/)
- Direct codebase analysis of `src/features/Upload/` -- reference module pattern (flat structure, api.ts)
- Direct codebase analysis of `src/shared/utils/storage.ts` -- loadApiKeys/saveApiKeys consumers identified
- Direct codebase analysis of `src/hooks/useAIProvider.ts` -- hook dependencies and structure understood
- Direct codebase analysis of `src/AppRouter.tsx` -- ConnectedApps route location identified

### Secondary (MEDIUM confidence)
- None needed -- this is a structural refactor of known code

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all dependencies already in project
- Architecture: HIGH -- exact patterns copied from completed Phases 3-4
- Pitfalls: HIGH -- identified from direct codebase analysis, especially storage.ts multi-consumer issue

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- structural refactor of known code, no external API changes)
