# Phase 9: App Shell & Enforcement - Research

**Researched:** 2026-03-09
**Domain:** React lazy loading, ESLint boundary enforcement, JSDoc documentation, alert/confirm replacement
**Confidence:** HIGH

## Summary

Phase 9 is purely enforcement, documentation, and polish -- no new features. The codebase is well-structured after 8 phases of module migration. The work breaks into five distinct workstreams: (1) wrapping all feature route imports with React.lazy() + Suspense boundaries, (2) promoting ESLint boundary rules from warn to error, (3) removing all legacy path aliases and updating ~58 remaining old-alias imports across ~47 files, (4) adding JSDoc to all barrel file exports, and (5) replacing remaining alert()/confirm() calls with Sonner toasts and Radix AlertDialog.

The codebase currently has 8 feature barrel files and 7 shared barrel files, totaling ~15 files needing JSDoc. There are 5 alert() calls to replace with toasts, 2 browser confirm() calls to replace with AlertDialog, 1 stub alert to convert to info toast, and 3 Tauri confirmDialog() wrappers to keep as-is. The old-alias cleanup is the largest task by file count, with ~29 `@components/lib/utils` imports in shared/ui components being the dominant pattern.

**Primary recommendation:** Execute in dependency order: old-alias removal first (unblocks ESLint error promotion), then lazy routes + alert replacement (independent), then JSDoc + CLAUDE.md (final polish).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 13 feature routes wrapped with React.lazy() in AppRouter
- Single shared Suspense fallback wrapping all lazy routes -- minimal centered spinner
- Spinner appears in content area only -- sidebar and title bar remain visible during route loads
- Error boundary with retry button for failed chunk loads (network issues, etc.)
- 5 remaining alert() calls replaced with Sonner error toasts (red-styled, auto-dismiss)
- 2 browser confirm() calls (Trello remove card, remove video link) replaced with Radix AlertDialog (Cancel/Confirm buttons)
- ThemeImport stub alert to Sonner info toast (blue, non-disruptive)
- Baker/BuildProject api.ts confirmDialog() wrappers KEPT as Tauri native OS dialogs
- Primary emphasis on module map + dev workflows for @features/* and @shared/* structure in CLAUDE.md
- Include ASCII dependency diagram showing feature to shared relationships
- Remove all old phase history (Phases 002-009) entirely from CLAUDE.md
- Add step-by-step "how to add a new feature module" workflow section
- One-liner purpose statement per export (brief, scannable, sufficient for AI agents)
- Apply JSDoc to ALL barrel exports: components, hooks, AND types
- Cover both feature barrels (8 modules) and shared barrels (@shared/hooks, @shared/store, etc.)
- JSDoc placed on barrel re-export lines in index.ts
- Promote all 3 boundary rules from warn to error: boundaries/element-types, boundaries/no-unknown-files, boundaries/no-unknown
- Remove all legacy aliases from tsconfig: @components/*, @hooks/*, @lib/*, @utils/*, @constants/*, @store/*, @services/*, @pages/*, @context/*, @/*
- Update all 48 remaining old-alias imports across 42 files to use @features/* or @shared/*
- Migrate @components/lib/utils (cn() utility) references to @shared equivalent

### Claude's Discretion
- Spinner component design and animation
- Error boundary retry UX details
- Exact JSDoc wording for each export
- Import update order/batching strategy
- CLAUDE.md section ordering and formatting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHEL-01 | All feature routes loaded via React.lazy() | React.lazy() + Suspense patterns documented; AppRouter.tsx has 13 direct imports to convert; App.tsx provider stack identified for Suspense placement |
| SHEL-02 | ESLint boundary rules promoted from warn to error | eslint.config.js lines 94-118 identified; 3 rules to promote; old-alias imports must be cleaned first or they will cause lint errors |
| SHEL-03 | Old path aliases removed after migration | tsconfig.json has 10 legacy aliases; 58 old-alias imports across 47 files catalogued; cn() utility is dominant pattern (29 files) |
| DOCS-01 | CLAUDE.md updated to reflect new module structure | Current CLAUDE.md has stale phase history; needs module map, dependency diagram, and "add feature" workflow |
| DOCS-02 | JSDoc on every public export in barrel files | 8 feature barrels + 7 shared barrels = 15 barrel files; ~120 total exports estimated |
| DOCS-04 | All alert()/confirm() replaced with Sonner toasts and Radix dialogs | 5 alert() + 2 confirm() + 1 stub alert identified; Sonner and AlertDialog already available in codebase |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3 | React.lazy() + Suspense for code splitting | Built-in, no extra deps needed |
| sonner | (installed) | Toast notifications replacing alert() | Already used in 9+ files across codebase |
| @radix-ui/react-alert-dialog | (installed) | Confirmation dialogs replacing confirm() | Already wrapped in @shared/ui/alert-dialog.tsx, used in 6 feature dialogs |
| eslint-plugin-boundaries | (installed) | Module boundary enforcement | Already configured with 3 rules at warn level |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-tsconfig-paths | (installed) | Path alias resolution from tsconfig | Already configured -- alias removal cascades from tsconfig changes |

### Alternatives Considered
None -- all tools are already installed and in use. This phase uses existing infrastructure only.

## Architecture Patterns

### Pattern 1: React.lazy() Route Wrapping
**What:** Convert static imports to dynamic imports with React.lazy()
**When to use:** All 13 feature route components in AppRouter.tsx

**Current state (AppRouter.tsx):**
```typescript
// Static imports -- lines 12-20
import { ExampleEmbeddings, ScriptFormatter } from '@features/AITools'
import { Login, Register } from '@features/Auth'
import { BakerPage as Baker } from '@features/Baker'
// ... etc
```

**Target state:**
```typescript
const ExampleEmbeddings = React.lazy(() =>
  import('@features/AITools').then(m => ({ default: m.ExampleEmbeddings }))
)
const ScriptFormatter = React.lazy(() =>
  import('@features/AITools').then(m => ({ default: m.ScriptFormatter }))
)
// ... etc for all route components
```

**Key detail:** Components exported as named exports (not default) from barrels need the `.then(m => ({ default: m.ComponentName }))` wrapper since React.lazy() expects a default export. Only `Page` (dashboard layout) should remain a static import since it's the layout shell.

**Suspense placement:** Between `<Router>` and `<AppRouter />` in App.tsx, wrapping only the content area. TitleBar sits outside Suspense so it stays visible during route loads.

```typescript
// App.tsx target structure
<Router>
  <TitleBar />
  <Suspense fallback={<RouteLoadingSpinner />}>
    <AppRouter />
  </Suspense>
</Router>
```

### Pattern 2: Error Boundary for Chunk Load Failures
**What:** Wrap lazy routes with error boundary that catches chunk load failures
**When to use:** Around the Suspense boundary in App.tsx

**Implementation:** QueryErrorBoundary already exists in the provider stack. A dedicated ChunkErrorBoundary should be placed around the Suspense to catch dynamic import failures specifically, with a retry button that reloads the chunk. This is separate from QueryErrorBoundary which handles React Query errors.

```typescript
class ChunkErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    // Only catch chunk load errors
    if (error.message.includes('Failed to fetch dynamically imported module')) {
      return { hasError: true }
    }
    throw error // Re-throw non-chunk errors
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ChunkLoadError onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}
```

### Pattern 3: Alert/Confirm Replacement
**What:** Replace browser native dialogs with themed UI components
**When to use:** For each identified alert()/confirm() call

**Alert to toast pattern:**
```typescript
// Before
alert('Failed to save breadcrumbs: ' + errorMessage)

// After
import { toast } from 'sonner'
toast.error('Failed to save breadcrumbs: ' + errorMessage)
```

**Confirm to AlertDialog pattern (requires state management):**
```typescript
// Before (synchronous)
if (confirm('Are you sure you want to remove this Trello card?')) {
  removeTrelloCard(index)
}

// After (state-driven)
const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)

const handleRemove = (index: number) => {
  setPendingRemoveIndex(index)  // Opens dialog
}

const confirmRemove = () => {
  if (pendingRemoveIndex !== null) {
    removeTrelloCard(pendingRemoveIndex)
    setPendingRemoveIndex(null)
  }
}

// In JSX
<AlertDialog open={pendingRemoveIndex !== null} onOpenChange={() => setPendingRemoveIndex(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove Trello Card</AlertDialogTitle>
      <AlertDialogDescription>Are you sure you want to remove this Trello card?</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Note:** The confirm() calls are in hooks (useTrelloCardsManager, useVideoLinksManager), not components. The dialog state and JSX must be lifted to the consuming component or the hook must return dialog state for the component to render. The cleanest approach is to have the hook return `{ pendingRemoveIndex, requestRemove, confirmRemove, cancelRemove }` and let the component render the AlertDialog.

### Pattern 4: JSDoc on Barrel Re-exports
**What:** One-liner JSDoc on each export line in barrel files
**When to use:** All 15 barrel files (8 feature + 7 shared)

```typescript
/** Main page component for the Baker workflow - drive scanning and breadcrumbs management */
export { default as BakerPage } from './BakerPage'

/** Hook for appending breadcrumbs data to project folders */
export { useAppendBreadcrumbs } from './hooks/useAppendBreadcrumbs'

/** Video link data structure with URL, title, and thumbnail */
export type { VideoLink } from './types'
```

### Pattern 5: cn() Utility Migration
**What:** Move cn() utility from @components/lib/utils to @shared/utils or keep at current path with new alias
**When to use:** 29 shared/ui files currently import from @components/lib/utils

**Current location:** `src/components/lib/utils.ts`
**Target:** Move to `src/shared/utils/cn.ts` and re-export from @shared/utils barrel, OR update the 29 imports directly to a relative path within shared/ui.

**Recommendation:** Create `src/shared/utils/cn.ts` (or add cn to existing shared/utils), update all 29 shared/ui imports and the 1 feature import to use `@shared/utils/cn` or a relative path. Then add cn() to the @shared/utils barrel export.

### Anti-Patterns to Avoid
- **Putting Suspense inside Routes:** Suspense should wrap the router outlet area, not individual Route elements -- otherwise each navigation remounts the fallback
- **Using React.lazy() for non-route components:** Only route-level components benefit from code splitting; sub-components within a feature should stay eagerly loaded
- **Removing aliases before updating imports:** Would break the build immediately -- must update imports first, then remove aliases

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast system | `sonner` (already installed) | Theme integration, accessibility, auto-dismiss, stacking |
| Confirmation dialogs | Custom modal | `@shared/ui/alert-dialog` (Radix) | Focus trap, keyboard navigation, animation, accessibility |
| Code splitting | Manual dynamic import management | `React.lazy()` + `Suspense` | Built into React, handles loading states automatically |
| Bulk import updates | Manual find-and-replace | Python script or sed batch operation | Atomic updates prevent linter/auto-save reversion (established pattern from Phase 02) |

## Common Pitfalls

### Pitfall 1: Named Export with React.lazy()
**What goes wrong:** React.lazy() expects a module with a default export. Named exports from barrel files need wrapping.
**Why it happens:** Most feature barrels export named components, not default exports.
**How to avoid:** Use the `.then()` pattern: `React.lazy(() => import('@features/X').then(m => ({ default: m.Component })))`
**Warning signs:** Runtime error "Element type is invalid" or blank screen after navigation.

### Pitfall 2: Import Update Order
**What goes wrong:** Removing tsconfig aliases before updating imports breaks the TypeScript compiler and all IDE support.
**Why it happens:** vite-tsconfig-paths reads from tsconfig.json -- removing an alias makes all imports using it unresolvable.
**How to avoid:** Two-step process: (1) update all imports to new paths, (2) then remove old aliases from tsconfig.json.
**Warning signs:** Red squiggles everywhere, `bun run build` fails.

### Pitfall 3: confirm() is Synchronous, AlertDialog is Async
**What goes wrong:** Direct replacement of `if (confirm(...))` with AlertDialog breaks control flow because AlertDialog is state-driven, not synchronous.
**Why it happens:** Browser confirm() blocks execution and returns boolean. Radix AlertDialog is a React component requiring state management.
**How to avoid:** Refactor to state-driven pattern: store pending action in state, render dialog when state is set, execute action on confirm callback.
**Warning signs:** Hook tries to return JSX (hooks should not render), or action fires before user confirms.

### Pitfall 4: Suspense Placement Affects Layout Stability
**What goes wrong:** Placing Suspense too high in the tree causes sidebar and title bar to flash/remount during route transitions.
**Why it happens:** Everything inside Suspense is replaced with fallback during lazy load.
**How to avoid:** Place Suspense below TitleBar and around AppRouter only, so the shell stays stable while content area shows spinner.
**Warning signs:** Sidebar disappears momentarily when navigating between routes.

### Pitfall 5: ESLint Boundary Errors Block CI After Promotion
**What goes wrong:** Promoting boundary rules to "error" while old-alias imports still exist causes all lint checks to fail.
**Why it happens:** Old-alias imports resolve to "legacy" elements which violate boundary rules.
**How to avoid:** Complete ALL import migrations before promoting rules. Run `bun run eslint:fix` and verify zero boundary warnings first.
**Warning signs:** `bun run eslint:fix` shows boundary warnings before promotion.

### Pitfall 6: Non-Component Legacy Files
**What goes wrong:** Some old-alias imports reference files that are not in feature modules and need to be relocated first.
**Why it happens:** Files like `@components/FolderTree`, `@components/BreadcrumbsViewerEnhanced`, `@components/UpdateDialog`, `@hooks/useMacOSEffects`, `@hooks/useUpdateManager`, `@services/ai/providerConfig`, `@services/ai/modelFactory`, `@utils/extractVideoInfoBlock`, `@utils/trello/*`, and various `@/types/*` are still at legacy locations.
**How to avoid:** These files need to be either: (a) moved into the appropriate feature module, (b) moved into @shared/, or (c) their path updated to use relative imports. Catalogue each one and decide its destination before bulk-updating.
**Warning signs:** Import update script changes the alias prefix but the file doesn't exist at the new path.

## Code Examples

### Exact Alert/Confirm Replacement Map

**5 alert() calls to replace with toast.error():**
1. `src/features/Trello/hooks/useTrelloBreadcrumbs.ts:73` -- `alert('Failed to save breadcrumbs: ' + errorMessage)` -> `toast.error('Failed to save breadcrumbs: ' + errorMessage)`
2. `src/features/Trello/hooks/useUploadTrello.ts:167` -- same pattern
3. `src/features/Trello/hooks/useTrelloCardsManager.ts:272` -- `alert('Trello API credentials not configured')` -> `toast.error('Trello API credentials not configured')`
4. `src/features/Trello/hooks/useTrelloCardsManager.ts:289` -- `alert('Failed to refresh card: ...')` -> `toast.error('Failed to refresh card: ...')`
5. `src/shared/ui/theme/ThemeImport.tsx:18` -- `alert('Custom theme import...')` -> `toast.info('Custom theme import feature coming soon!')`

**2 confirm() calls to replace with AlertDialog:**
1. `src/features/Trello/hooks/useTrelloCardsManager.ts:264` -- `confirm('Are you sure you want to remove this Trello card?')`
2. `src/features/Trello/hooks/useVideoLinksManager.ts:148` -- `confirm('Are you sure you want to remove this video link?')`

**3 Tauri confirmDialog() to KEEP as-is:**
1. `src/features/Baker/api.ts:173`
2. `src/features/Trello/api.ts:209`
3. `src/features/BuildProject/api.ts:85`

### Old-Alias Import Categories (58 imports across 47 files)

| Pattern | Count | Target |
|---------|-------|--------|
| `@components/lib/utils` (cn utility) | 29 | Move cn() to @shared/utils/cn, update imports |
| `@/types/scriptFormatter` | 8 | Move to @features/AITools/types or @shared/types |
| `@/types/exampleEmbeddings` | 2 | Move to @features/AITools/types |
| `@hooks/useAppendVideoInfo` | 2 | Move to appropriate feature module |
| `@hooks/useMacOSEffects` | 1 | Move to @shared/hooks or keep with relative import |
| `@hooks/useUpdateManager` | 1 | Move to @shared/hooks or keep with relative import |
| `@services/ai/providerConfig` | 3 | Move to @features/AITools or @shared/services |
| `@services/ai/modelFactory` | 1 | Move to @features/AITools or @shared/services |
| `@utils/extractVideoInfoBlock` | 1 | Move to appropriate feature module |
| `@utils/trello/*` | 3 | Move to @features/Trello/internal |
| `@components/FolderTree` | 1 | Move to @features/BuildProject or @shared |
| `@components/BreadcrumbsViewerEnhanced` | 1 | Move to @features/Baker or @shared |
| `@components/UpdateDialog` | 1 | Move to @shared/ui/layout |
| `@components/hooks/use-mobile` | 1 | Move to @shared/hooks |
| `@/components/BreadcrumbsViewer/fieldUtils` | 1 | Move to @shared/utils or Baker |

### Lazy Route Components to Wrap (13 total)

From AppRouter.tsx current imports:
1. `ExampleEmbeddings` from @features/AITools (named)
2. `ScriptFormatter` from @features/AITools (named)
3. `Login` from @features/Auth (named)
4. `Register` from @features/Auth (named)
5. `BakerPage` from @features/Baker (named)
6. `BuildProjectPage` from @features/BuildProject (named)
7. `Settings` from @features/Settings (named)
8. `Posterframe` from @features/Upload (named)
9. `UploadOtter` from @features/Upload (named)
10. `UploadSprout` from @features/Upload (named)
11. `PremierePluginManager` from @features/Premiere (named)
12. `UploadTrello` from @features/Trello (named)
13. `IngestHistory` from ./pages/IngestHistory (default export, legacy location)

**Note:** IngestHistory is still at a legacy path (`src/pages/IngestHistory.tsx`) and is a stub component. It should either be moved into a feature module or kept as a simple page. Since it's a trivial placeholder, it could remain eagerly loaded or be wrapped in lazy regardless.

### Barrel Files Needing JSDoc (15 total)

**Feature barrels (8):**
- `src/features/Auth/index.ts` -- 6 exports
- `src/features/Trello/index.ts` -- 28 exports
- `src/features/Premiere/index.ts` -- 3 exports
- `src/features/Upload/index.ts` -- 14 exports
- `src/features/Settings/index.ts` -- 3 exports
- `src/features/AITools/index.ts` -- 8 exports
- `src/features/Baker/index.ts` -- 12 exports
- `src/features/BuildProject/index.ts` -- 3 exports

**Shared barrels (7):**
- `src/shared/hooks/index.ts` -- 6 exports
- `src/shared/store/index.ts` -- 2 exports
- `src/shared/constants/index.ts` -- 18 exports
- `src/shared/services/index.ts` -- 11 exports
- `src/shared/lib/index.ts` -- ~40 exports
- `src/shared/types/index.ts` -- 11 exports
- `src/shared/utils/index.ts` -- 17 exports

**Total exports to document:** ~153 estimated

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static route imports | React.lazy() + Suspense | React 16.6+ (stable) | Automatic code splitting per route |
| browser alert()/confirm() | Sonner toasts + Radix AlertDialog | Project convention | Themed, accessible, non-blocking |
| @components/* aliases | @features/* + @shared/* | This refactor (Phase 1+) | Module boundary enforcement |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts) |
| Config file | vite.config.ts (test section, lines 60-66) |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHEL-01 | All routes use React.lazy() | grep/static analysis | `grep -c "React.lazy" src/AppRouter.tsx` | No dedicated test -- verify via grep |
| SHEL-02 | Boundary rules at error level | grep/config check | `grep '"error"' eslint.config.js \| grep boundaries` | No dedicated test -- verify via config |
| SHEL-03 | No old aliases in tsconfig | config check | `grep -c "@components" tsconfig.json` should return 0 | No dedicated test |
| DOCS-01 | CLAUDE.md has module map | manual review | N/A (documentation) | manual-only |
| DOCS-02 | JSDoc on all barrel exports | grep/static analysis | `grep -c "\/\*\*" src/features/*/index.ts src/shared/*/index.ts` | No dedicated test |
| DOCS-04 | Zero alert()/confirm() calls | grep | `grep -rn "alert\(\|confirm(" src/ --include="*.ts" --include="*.tsx" \| grep -v "AlertDialog\|AlertCircle\|AlertDescription\|\.test\.\|confirmDialog\|api\.ts"` | Contract tests exist in Baker |

### Sampling Rate
- **Per task commit:** `bun run test -- --run` + `bun run eslint:fix` (lint must pass)
- **Per wave merge:** Full test suite + lint + build check
- **Phase gate:** Full suite green, zero boundary lint errors, zero alert()/confirm() calls

### Wave 0 Gaps
- [ ] Verify existing AppRouter.test.tsx still passes after lazy conversion (exists at `tests/unit/AppRouter.test.tsx`)
- [ ] No new test files needed -- this phase is enforcement/cleanup, verified via grep and lint checks
- [ ] Extend Baker contract test pattern (`no alert() calls`) to all feature modules

## Open Questions

1. **IngestHistory stub placement**
   - What we know: `src/pages/IngestHistory.tsx` is a 7-line stub component still at legacy path
   - What's unclear: Should it be moved to a feature module or stay as-is?
   - Recommendation: Leave as-is or move to a simple shared location -- it's trivial and not worth creating a feature module for

2. **cn() utility final location**
   - What we know: 29 shared/ui files import from `@components/lib/utils`, plus 2 feature files
   - What's unclear: Best location -- `@shared/utils/cn` or keep in `src/shared/utils/` and add to barrel
   - Recommendation: Create `src/shared/utils/cn.ts`, re-export from `@shared/utils` barrel, update all 31 imports

3. **Legacy service/type files that need relocation**
   - What we know: `@services/ai/providerConfig`, `@services/ai/modelFactory`, `@/types/scriptFormatter`, `@/types/exampleEmbeddings` are at legacy locations used by AITools and Settings
   - What's unclear: Whether to move them into feature modules or shared
   - Recommendation: Since both AITools and Settings consume providerConfig, it should go to @shared/services. Types consumed by multiple features go to @shared/types. modelFactory is AITools-only and goes into that feature.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct grep/read of all 47 affected files
- `tsconfig.json` -- 10 legacy aliases identified (lines 16-25)
- `eslint.config.js` -- 3 boundary rules at warn (lines 95-118)
- `AppRouter.tsx` -- 13 route imports identified (lines 11-21)
- `App.tsx` -- Provider stack analyzed (lines 72-114)
- React documentation -- React.lazy() requires default export module

### Secondary (MEDIUM confidence)
- Import counts from grep analysis -- may have minor variance due to test file exclusions
- Export counts from barrel file reads -- exact counts verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns verified against existing codebase conventions
- Pitfalls: HIGH -- derived from direct codebase analysis (confirm() synchronous flow, alias removal order)
- Alert/confirm inventory: HIGH -- exhaustive grep of entire src/ tree

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- enforcement phase, no external dependency changes)
