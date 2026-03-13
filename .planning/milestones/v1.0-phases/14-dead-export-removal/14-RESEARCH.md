# Phase 14: Dead Export Removal - Research

**Researched:** 2026-03-10
**Domain:** TypeScript barrel export cleanup, contract test maintenance
**Confidence:** HIGH

## Summary

Phase 14 is a straightforward tech debt cleanup phase. The goal is to remove barrel exports that have zero cross-module consumers and update contract tests to match the reduced barrel surfaces. All seven dead exports and two unused services have been verified through grep-based consumer analysis.

The key insight is that several of these "dead" exports are used internally within their own modules but are not consumed by any external module through the barrel. The barrel export is what gets removed; the underlying code stays because it has internal consumers. Two services (ProgressTracker, UserFeedbackService) have no consumers at all outside their own module files and contract tests, and their source files can be fully removed.

**Primary recommendation:** Remove dead barrel exports in a single pass, update contract tests, then verify with full test suite and dev server.

## Standard Stack

This phase requires no new libraries. It uses the existing project tooling:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (existing) | Run contract tests after changes | Already configured |
| TypeScript | 5.7 | Type checking after export removal | Already configured |
| Vite | 6.1 | Dev server startup verification | Already configured |

## Architecture Patterns

### Dead Export Identification (Verified)

Each candidate was verified by searching for imports across the entire `src/` tree. An export is "dead from barrel" when:
1. It exists in a module's `index.ts` barrel
2. No file outside the module imports it via the barrel (`@features/X` or `@shared/X`)
3. Contract tests reference it (but those will be updated)

### Candidate Analysis

#### Feature Barrel Dead Exports

| Export | Module | Barrel | Internal Use | External Use | Action |
|--------|--------|--------|-------------|-------------|--------|
| `usePremiereIntegration` | Premiere | `index.ts` line 4 | None (BuildProject has its own api.ts Premiere calls) | None | Remove from barrel; remove hook file |
| `PluginInfo` | Premiere | `index.ts` line 6 | Used by `api.ts` and `PremierePluginManager` | None | Remove type re-export from barrel only |
| `InstallResult` | Premiere | `index.ts` line 6 | Used by `api.ts` and `PremierePluginManager` | None | Remove type re-export from barrel only |
| `SimilarExample` | AITools | `index.ts` line 17 | Used by `api.ts`, `aiPrompts.ts`, `useScriptRetrieval.ts`, `useScriptProcessor.ts` | None | Remove type re-export from barrel only |
| `createDefaultSproutUploadResponse` | Trello | `index.ts` line 67 | Used by `useUploadTrello.ts` (internal import `../types`) | None | Remove from barrel only |

#### Shared Services Dead Exports

| Export | Module | Internal Use | External Use | Action |
|--------|--------|-------------|-------------|--------|
| `ProgressTracker` | `@shared/services` | Used by `UserFeedbackService` | None (no import from `@shared/services` for this) | Remove from barrel |
| `ProgressUpdate` (type) | `@shared/services` | Used by `UserFeedbackService` | None | Remove from barrel |
| `ProgressSubscription` (type) | `@shared/services` | None | None | Remove from barrel |
| `ProgressFilter` (type) | `@shared/services` | None | None | Remove from barrel |
| `ProgressSummary` (type) | `@shared/services` | None | None | Remove from barrel |
| `UserFeedbackService` | `@shared/services` | None external | None | Remove from barrel |
| `FeedbackOptions` (type) | `@shared/services` | None | None | Remove from barrel |
| `UserPrompt` (type) | `@shared/services` | None | None | Remove from barrel |
| `NotificationConfig` (type) | `@shared/services` | None | None | Remove from barrel |
| `NotificationAction` (type) | `@shared/services` | None | None | Remove from barrel |

**Key finding:** The only external import from `@shared/services` is `initializeCacheService` in `App.tsx`. The cache-related exports are the only ones with real consumers. ProgressTracker and UserFeedbackService are entirely unused outside their own source files and contract tests.

### Decision: Keep or Delete Source Files?

For exports that are only used internally within their module (PluginInfo, InstallResult, SimilarExample, createDefaultSproutUploadResponse), the source files remain -- only the barrel re-export line is removed.

For ProgressTracker and UserFeedbackService, since they have no consumers outside their own files:
- `ProgressTracker.ts` is imported only by `UserFeedbackService.ts`
- `UserFeedbackService.ts` has zero consumers
- Both can be deleted entirely (source files + barrel entries)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding dead exports | Manual file-by-file inspection | grep/ripgrep across src/ tree | Automated search is comprehensive and fast |
| Verifying no breakage | Manual dev testing only | `bun run test` + `bun run dev` | Contract tests catch export surface changes |

## Common Pitfalls

### Pitfall 1: Removing Internal-Use Code Along With Barrel Export
**What goes wrong:** Deleting the source file when only the barrel re-export should be removed
**Why it happens:** Conflating "dead barrel export" with "dead code"
**How to avoid:** Check internal imports (from `../types`, from `./X`) before deleting source files. Only remove barrel lines for types/functions still used internally.

### Pitfall 2: Forgetting to Update Contract Test Export Count
**What goes wrong:** Contract tests fail because they assert a specific export count or list
**How to avoid:** Update the `expectedExports` array and `toHaveLength()` assertion in each affected contract test

### Pitfall 3: Type-Only Exports Not Appearing in Object.keys()
**What goes wrong:** Removing a type-only export from the barrel but Object.keys() in contract tests never counted it
**Why it happens:** TypeScript `export type` is erased at runtime; Object.keys() only sees runtime values
**How to avoid:** Check if the contract test references the type export. For Premiere, the shape test only lists `['PremierePluginManager', 'usePremiereIntegration']` -- types are not counted. Same for AITools (5 runtime exports, no types in the list). For Trello, `createDefaultSproutUploadResponse` IS a runtime value in the expected list.

### Pitfall 4: Cascade From ProgressTracker Deletion
**What goes wrong:** Deleting ProgressTracker.ts breaks UserFeedbackService.ts
**How to avoid:** Delete both together since UserFeedbackService depends on ProgressTracker and neither has external consumers.

## Code Examples

### Removing a barrel export line (Premiere)

Before:
```typescript
// src/features/Premiere/index.ts
export { default as PremierePluginManager } from './components/PremierePluginManager'
export { usePremiereIntegration } from './hooks/usePremiereIntegration'
export type { PluginInfo, InstallResult } from './types'
```

After:
```typescript
// src/features/Premiere/index.ts
export { default as PremierePluginManager } from './components/PremierePluginManager'
```

### Updating contract test export list (Premiere)

Before:
```typescript
it('exports exactly the expected named exports', () => {
  const exportNames = Object.keys(premiereBarrel)
  expect(exportNames.sort()).toEqual([
    'PremierePluginManager',
    'usePremiereIntegration'
  ])
})
```

After:
```typescript
it('exports exactly the expected named exports', () => {
  const exportNames = Object.keys(premiereBarrel)
  expect(exportNames.sort()).toEqual([
    'PremierePluginManager'
  ])
})
```

### Updating services barrel (shared/services)

Before (22 lines with ProgressTracker, UserFeedbackService, and all their types):
```typescript
export { ProgressTracker } from './ProgressTracker'
export type { ProgressUpdate } from './ProgressTracker'
// ... 8 more lines for ProgressTracker/UserFeedbackService types
export { UserFeedbackService } from './UserFeedbackService'
// ... remaining cache exports
```

After:
```typescript
export { CacheInvalidationService } from './cache-invalidation'
export { createCacheInvalidationService } from './cache-invalidation'
export { initializeCacheService } from './cache-invalidation'
export { getCacheService } from './cache-invalidation'
export { useCacheInvalidation } from './cache-invalidation'
```

## Contract Test Impact Summary

| Contract Test File | Current State | Changes Needed |
|-------------------|---------------|----------------|
| `Premiere/__contracts__/premiere.contract.test.ts` | 2 runtime exports | Remove `usePremiereIntegration` from expected list (1 export); remove behavioral tests for it; remove mock for api functions only used by that hook |
| `AITools/__contracts__/aitools.contract.test.ts` | 5 runtime exports | No change -- `SimilarExample` is a type-only export, not in `Object.keys()` list |
| `Trello/__contracts__/trello.contract.test.ts` | 26 runtime exports | Remove `createDefaultSproutUploadResponse` from expected list (25 exports); update `toHaveLength(25)`; remove behavioral test for it |
| `services/__contracts__/services.contract.test.ts` | Tests ProgressTracker + UserFeedbackService + Cache | Remove all ProgressTracker shape/behavioral tests; remove all UserFeedbackService shape/behavioral tests; keep cache service tests |

## Files to Delete

| File | Reason |
|------|--------|
| `src/features/Premiere/hooks/usePremiereIntegration.ts` | Zero consumers (internal or external) |
| `src/shared/services/ProgressTracker.ts` | Only consumer is UserFeedbackService (also being deleted) |
| `src/shared/services/UserFeedbackService.ts` | Zero consumers |

## Files to Modify

| File | Change |
|------|--------|
| `src/features/Premiere/index.ts` | Remove 2 export lines (usePremiereIntegration, PluginInfo/InstallResult types) |
| `src/features/AITools/index.ts` | Remove 1 export line (SimilarExample type) |
| `src/features/Trello/index.ts` | Remove 1 export line (createDefaultSproutUploadResponse) |
| `src/shared/services/index.ts` | Remove 10 export lines (ProgressTracker + UserFeedbackService + all their types) |
| `src/features/Premiere/__contracts__/premiere.contract.test.ts` | Update expected exports, remove usePremiereIntegration behavioral tests |
| `src/features/Trello/__contracts__/trello.contract.test.ts` | Update expected exports and count, remove createDefaultSproutUploadResponse behavioral test |
| `src/shared/services/__contracts__/services.contract.test.ts` | Remove ProgressTracker and UserFeedbackService tests entirely |

**AITools contract test needs NO changes** -- SimilarExample is type-only and not in the runtime export list.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `bun run test -- --reporter=verbose <file>` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (tech debt) | Dead exports removed from Premiere barrel | unit | `bun run test -- src/features/Premiere/__contracts__/premiere.contract.test.ts` | Exists (needs update) |
| (tech debt) | Dead exports removed from Trello barrel | unit | `bun run test -- src/features/Trello/__contracts__/trello.contract.test.ts` | Exists (needs update) |
| (tech debt) | Dead exports removed from AITools barrel | unit | `bun run test -- src/features/AITools/__contracts__/aitools.contract.test.ts` | Exists (no change needed) |
| (tech debt) | Dead services removed from shared/services | unit | `bun run test -- src/shared/services/__contracts__/services.contract.test.ts` | Exists (needs update) |
| (tech debt) | Full test suite passes | integration | `bun run test` | Existing |
| (tech debt) | Dev server starts | smoke | `bun run build` | Manual |

### Sampling Rate
- **Per task commit:** `bun run test -- --reporter=verbose <affected contract test files>`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green + `bun run build` succeeds

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Contract tests already exist for every affected module.

## Sources

### Primary (HIGH confidence)
- Direct grep analysis of `src/` tree for all 7 dead exports + 2 unused services
- Direct reading of all affected barrel files (`index.ts`) and contract tests
- Live test run confirming 86/86 contract tests pass currently

### Verification Method
Every "zero consumers" claim was verified by:
1. `Grep` for the export name across entire `src/` directory
2. Checking each match to distinguish definition vs. import vs. internal use vs. external use
3. Confirming no `@features/X` or `@shared/X` barrel import paths reference the export

## Metadata

**Confidence breakdown:**
- Dead export identification: HIGH - verified by exhaustive grep of entire src/ tree
- Contract test impact: HIGH - read every affected test file, confirmed exact assertions to update
- File deletion safety: HIGH - verified dependency chains (ProgressTracker -> UserFeedbackService -> nothing)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- dead code does not change)
