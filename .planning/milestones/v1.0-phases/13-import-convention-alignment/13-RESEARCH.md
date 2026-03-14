# Phase 13: Import Convention Alignment - Research

**Researched:** 2026-03-10
**Domain:** TypeScript import convention enforcement / barrel import migration
**Confidence:** HIGH

## Summary

Phase 13 closes two gap items from the v1.0 milestone audit: INT-01 (Trello barrel bypass in `useAppendVideoInfo.ts`) and INT-02 (~123 files using `@shared/*/subpath` imports instead of barrel imports). The actual count from current codebase scanning is 146 sub-path import occurrences across 84 files in `src/features/`, plus 6 occurrences across 3 app-level files (`App.tsx`, `AppRouter.tsx`, `index.tsx`), plus 40 occurrences across 22 shared-internal files. Some shared-internal imports are intentional exceptions (contract tests, Tauri-dependent hooks, AI services).

The work is purely mechanical: find-and-replace import paths from `@shared/lib/query-keys` to `@shared/lib`, from `@shared/utils/logger` to `@shared/utils`, etc. Every symbol is already exported from barrels. The risk is low but the volume is high -- a Python/Node bulk script (as used successfully in Phase 02) is the recommended approach.

**Primary recommendation:** Use a bulk import rewriting script to convert all sub-path imports to barrel imports in a single atomic pass, then verify with tests and dev server.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHRD-04 | User can import query infrastructure from `@shared/lib` barrel export only | 30+ files in features use `@shared/lib/query-keys`, `@shared/lib/query-utils`, etc. -- all must convert to `@shared/lib` |
| SHRD-06 | User can import utilities from `@shared/utils` barrel export only | 50+ files use `@shared/utils/logger`, `@shared/utils/breadcrumbs`, etc. -- all must convert to `@shared/utils` |
| SHRD-07 | User can import shared types from `@shared/types` barrel export only | 20+ files use `@shared/types/types`, `@shared/types/media`, etc. -- all must convert to `@shared/types` |
| SHRD-08 | User can import constants from `@shared/constants` barrel export only | 15+ files use `@shared/constants/timing`, `@shared/constants/animations`, etc. -- all must convert to `@shared/constants` |
| TREL-01 | User can import Trello components, hooks, and types from `@features/Trello` barrel only | `useAppendVideoInfo.ts` imports `updateTrelloCard` from `@features/Trello/api` instead of using relative `../api` path |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7 | Type-checked imports | Already configured with path aliases |
| Vitest | (project default) | Test verification | Already configured in vite.config.ts |
| ESLint | (project default) | Boundary enforcement | Already has eslint-plugin-boundaries rules |

### Supporting
No new libraries needed. This is a pure import path refactoring.

## Architecture Patterns

### Import Convention Rules

**Rule 1: Feature modules use barrel imports for @shared/**
```typescript
// CORRECT
import { logger, createNamespacedLogger } from '@shared/utils'
import { queryKeys, createQueryOptions } from '@shared/lib'
import { SproutUploadResponse, Breadcrumb } from '@shared/types'
import { CACHE, SECONDS } from '@shared/constants'

// WRONG (sub-path bypass)
import { logger } from '@shared/utils/logger'
import { queryKeys } from '@shared/lib/query-keys'
import { SproutUploadResponse } from '@shared/types/types'
import { CACHE } from '@shared/constants/timing'
```

**Rule 2: Intra-module imports use relative paths, not alias paths**
```typescript
// CORRECT (inside src/features/Trello/hooks/)
import { updateTrelloCard } from '../api'

// WRONG (alias bypass for intra-module import)
import { updateTrelloCard } from '@features/Trello/api'
```

**Rule 3: Documented exceptions for Tauri-dependent and runtime-dependent imports**
These items are NOT barrel-exported by design (they crash in test environments):
- `@shared/hooks/useWindowState` -- Tauri runtime dependency
- `@shared/hooks/useMacOSEffects` -- Tauri runtime dependency
- `@shared/hooks/useUpdateManager` -- Tauri runtime dependency
- `@shared/hooks/useSystemTheme` -- Tauri runtime dependency
- `@shared/hooks/useVersionCheck` -- Tauri runtime dependency
- `@shared/services/ai/providerConfig` -- Ollama runtime dependency
- `@shared/services/ai/modelFactory` -- Ollama runtime dependency

**Rule 4: Contract tests may use sub-path imports to avoid runtime dependencies**
The lib contract test (`lib.contract.test.ts`) intentionally imports from `@shared/lib/query-keys` and `@shared/lib/query-utils` to avoid Tauri plugin-store runtime dependency. This is documented and acceptable.

### Categorized Violations

**Category A: Feature files -> @shared/*/subpath (MUST FIX)**
- 146 occurrences across 84 files
- All four barrels affected: lib, utils, types, constants
- Every imported symbol is already exported from the barrel

**Category B: App-level files -> @shared/*/subpath (MUST FIX)**
- `src/App.tsx`: 4 sub-path imports (constants/timing, lib/performance-monitor, lib/prefetch-strategies, utils/logger)
- `src/AppRouter.tsx`: 1 sub-path import (utils/logger)
- `src/index.tsx`: 1 sub-path import (utils/logger)

**Category C: Shared-internal -> @shared/*/subpath (MUST FIX)**
- 40 occurrences across 22 files
- Includes: shared/store, shared/services, shared/hooks, shared/lib, shared/ui, shared/utils
- These are shared sub-modules importing from other shared sub-modules using sub-path aliases

**Category D: Documented exceptions (DO NOT TOUCH)**
- `@shared/hooks/useWindowState`, `useMacOSEffects`, `useUpdateManager`, `useVersionCheck` -- direct imports by design
- `@shared/services/ai/providerConfig`, `@shared/services/ai/modelFactory` -- direct imports by design
- `lib.contract.test.ts` sub-path imports -- intentional for test isolation

**Category E: Intra-module barrel bypass (MUST FIX)**
- `src/features/Trello/hooks/useAppendVideoInfo.ts` line 5: `import { updateTrelloCard } from '@features/Trello/api'`
- Should be: `import { updateTrelloCard } from '../api'`

### Sub-Path Import Breakdown by Source Module

| Source Sub-Path | Count | Barrel Target |
|----------------|-------|---------------|
| `@shared/utils/logger` | ~50 | `@shared/utils` |
| `@shared/constants/timing` | ~20 | `@shared/constants` |
| `@shared/lib/query-keys` | ~15 | `@shared/lib` |
| `@shared/lib/query-utils` | ~15 | `@shared/lib` |
| `@shared/types/types` | ~12 | `@shared/types` |
| `@shared/types/scriptFormatter` | ~10 | `@shared/types` |
| `@shared/constants/animations` | ~8 | `@shared/constants` |
| `@shared/utils/breadcrumbs` | ~8 | `@shared/utils` |
| `@shared/types/media` | ~4 | `@shared/types` |
| `@shared/types/breadcrumbs` | ~4 | `@shared/types` |
| `@shared/types/exampleEmbeddings` | ~4 | `@shared/types` |
| `@shared/utils/storage` | ~4 | `@shared/utils` |
| `@shared/utils/validation` | ~3 | `@shared/utils` |
| `@shared/utils/cn` | ~1 | `@shared/utils` |
| `@shared/utils/debounce` | ~1 | `@shared/utils` |
| `@shared/utils/versionUtils` | ~2 | `@shared/utils` |
| `@shared/constants/project` | ~2 | `@shared/constants` |
| `@shared/lib/performance-monitor` | ~2 | `@shared/lib` |
| `@shared/lib/prefetch-strategies` | ~3 | `@shared/lib` |
| `@shared/lib/query-client-config` | ~2 | `@shared/lib` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk import rewriting | Manual file-by-file editing | Python/Node script with regex | 190+ occurrences across 100+ files -- manual editing is error-prone and slow |
| Import merge | Manual combining of imports from same barrel | AST-aware tool or careful regex | When two sub-path imports merge into one barrel import, named imports must be combined |

**Key insight:** Phase 02 established the pattern of using a Python bulk-update script for atomic import rewrites. The same approach applies here. The script must handle:
1. Replacing `from '@shared/utils/logger'` with `from '@shared/utils'`
2. Merging multiple sub-path imports from the same barrel in a single file (e.g., a file importing from both `@shared/types/types` and `@shared/types/media` must combine them into one `@shared/types` import)
3. Preserving `type` imports (`import type { ... }`)
4. NOT touching documented exceptions (Tauri-dependent hooks, AI services, contract tests)

## Common Pitfalls

### Pitfall 1: Import Merge Conflicts
**What goes wrong:** A file has `import { Breadcrumb } from '@shared/types/types'` and `import type { TrelloCard } from '@shared/types/media'` -- naive replacement creates two `from '@shared/types'` lines.
**Why it happens:** Simple find-replace doesn't account for multiple sub-paths from the same barrel in one file.
**How to avoid:** Script must group all sub-path imports from the same barrel and merge them into a single import statement. Keep `import type` separate from value imports.
**Warning signs:** ESLint duplicate-import warnings after migration.

### Pitfall 2: Touching Documented Exceptions
**What goes wrong:** Converting `@shared/hooks/useWindowState` to `@shared/hooks` -- but it's excluded from the barrel because it crashes in test environments.
**Why it happens:** Overly broad regex pattern catches intentional direct imports.
**How to avoid:** Script must skip known exception paths: `@shared/hooks/useWindowState`, `@shared/hooks/useMacOSEffects`, `@shared/hooks/useUpdateManager`, `@shared/hooks/useSystemTheme`, `@shared/hooks/useVersionCheck`, `@shared/services/ai/*`. Also skip `__contracts__` directories.
**Warning signs:** Test suite crashes with Tauri runtime errors after migration.

### Pitfall 3: Re-export Type vs Value Confusion
**What goes wrong:** Some files use `export type { X } from '@shared/types/...'` (re-exports) -- these need the same treatment as imports.
**Why it happens:** Search only catches `import` statements, missing `export ... from` statements.
**How to avoid:** Script must also handle `export { ... } from` and `export type { ... } from` patterns.
**Warning signs:** Leftover sub-path re-exports found by post-migration grep.

### Pitfall 4: Circular Import via Barrel
**What goes wrong:** When shared modules import from their sibling barrels, it can create circular dependencies (e.g., `@shared/lib/query-utils` imports from `@shared/constants` barrel which re-exports from `./timing` -- but if timing somehow imported from lib, circular).
**Why it happens:** Barrel files aggregate all module exports; importing the barrel means loading all peers.
**How to avoid:** Shared-internal imports should stay as sub-path imports if they're within the same barrel scope (e.g., `@shared/lib/query-utils` importing from `@shared/constants/timing` is fine to convert to `@shared/constants` since there's no circular risk between different shared sub-modules). But watch for any shared module importing from its OWN barrel.
**Warning signs:** Runtime errors, infinite loops, or Vite build hangs.

### Pitfall 5: `queryKeys` Name Collision
**What goes wrong:** `@shared/types/scriptFormatter` exports a `queryKeys` value AND `@shared/lib/query-keys` exports a `queryKeys` value. If a file imports both from their barrels, there's a name collision.
**Why it happens:** Both `@shared/types` and `@shared/lib` export a symbol named `queryKeys`.
**How to avoid:** Check for files that import `queryKeys` from both barrels. If found, one import needs aliasing: `import { queryKeys as scriptQueryKeys } from '@shared/types'`.
**Warning signs:** TypeScript compilation errors about duplicate identifiers.

## Code Examples

### Bulk Import Rewrite Script Pattern
```python
# Pattern from Phase 02 -- atomic bulk import update
import re
import os

# Map sub-paths to barrel paths
BARREL_MAP = {
    '@shared/utils/logger': '@shared/utils',
    '@shared/utils/storage': '@shared/utils',
    '@shared/utils/breadcrumbs': '@shared/utils',
    '@shared/utils/validation': '@shared/utils',
    '@shared/utils/cn': '@shared/utils',
    '@shared/utils/debounce': '@shared/utils',
    '@shared/utils/versionUtils': '@shared/utils',
    '@shared/lib/query-keys': '@shared/lib',
    '@shared/lib/query-utils': '@shared/lib',
    '@shared/lib/performance-monitor': '@shared/lib',
    '@shared/lib/prefetch-strategies': '@shared/lib',
    '@shared/lib/query-client-config': '@shared/lib',
    '@shared/types/types': '@shared/types',
    '@shared/types/media': '@shared/types',
    '@shared/types/breadcrumbs': '@shared/types',
    '@shared/types/scriptFormatter': '@shared/types',
    '@shared/types/exampleEmbeddings': '@shared/types',
    '@shared/constants/timing': '@shared/constants',
    '@shared/constants/animations': '@shared/constants',
    '@shared/constants/project': '@shared/constants',
}

# Exception paths -- do NOT convert
EXCEPTIONS = [
    '@shared/hooks/useWindowState',
    '@shared/hooks/useMacOSEffects',
    '@shared/hooks/useUpdateManager',
    '@shared/hooks/useSystemTheme',
    '@shared/hooks/useVersionCheck',
    '@shared/services/ai/',
]

SKIP_DIRS = ['__contracts__']
```

### Import Merge Pattern
```typescript
// BEFORE (two sub-path imports from same barrel):
import { Breadcrumb, SproutUploadResponse } from '@shared/types/types'
import type { TrelloCard, VideoLink } from '@shared/types/media'

// AFTER (merged into barrel, preserving type-only):
import { Breadcrumb, SproutUploadResponse } from '@shared/types'
import type { TrelloCard, VideoLink } from '@shared/types'
```

### Intra-Module Fix Pattern
```typescript
// BEFORE (useAppendVideoInfo.ts):
import { updateTrelloCard } from '@features/Trello/api'

// AFTER:
import { updateTrelloCard } from '../api'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sub-path imports (`@shared/utils/logger`) | Barrel imports (`@shared/utils`) | Phase 2 convention established | Convention gap persists in ~190 import sites |
| Intra-module alias imports (`@features/X/api`) | Relative imports (`../api`) | Phase 3 convention established | 1 remaining violation in Trello |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts test block) |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHRD-04 | Zero `@shared/lib/` sub-path imports in features | grep/smoke | `grep -r "from '@shared/lib/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A -- grep validation |
| SHRD-06 | Zero `@shared/utils/` sub-path imports in features | grep/smoke | `grep -r "from '@shared/utils/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A -- grep validation |
| SHRD-07 | Zero `@shared/types/` sub-path imports in features | grep/smoke | `grep -r "from '@shared/types/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A -- grep validation |
| SHRD-08 | Zero `@shared/constants/` sub-path imports in features | grep/smoke | `grep -r "from '@shared/constants/" src/features/ --include="*.ts" --include="*.tsx"` (expect 0) | N/A -- grep validation |
| TREL-01 | `useAppendVideoInfo.ts` uses relative import for api | grep/smoke | `grep "from '@features/Trello/api'" src/features/Trello/hooks/useAppendVideoInfo.ts` (expect 0) | N/A -- grep validation |
| ALL | Tests pass after migration | unit | `bun run test -- --run` | Existing test suite |
| ALL | Dev server starts without errors | smoke | `bun run dev` (manual verify, or timeout-based) | N/A -- manual |

### Sampling Rate
- **Per task commit:** `bun run test -- --run`
- **Per wave merge:** `bun run test -- --run` + grep validation
- **Phase gate:** Full suite green + zero sub-path grep matches (excluding documented exceptions)

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. No new test files needed; verification is grep-based (zero remaining violations) plus existing test suite green.

## Open Questions

1. **Shared-internal sub-path imports: convert or leave?**
   - What we know: 40 occurrences across 22 shared-internal files use sub-path imports (e.g., `@shared/lib/query-utils` imports from `@shared/constants/timing`)
   - What's unclear: The phase success criteria says "All `@shared/lib`, `@shared/utils`, `@shared/types`, `@shared/constants` imports use barrel paths" -- does "all" include shared-internal?
   - Recommendation: Convert shared-internal imports too, EXCEPT within the same barrel scope (don't have `@shared/lib/query-utils` import from `@shared/lib` barrel -- that would be a self-import). Cross-barrel shared imports should use barrel paths (e.g., `@shared/lib/query-utils` importing from `@shared/constants` barrel is fine).

2. **`queryKeys` name collision between `@shared/types` and `@shared/lib`**
   - What we know: Both barrels export a `queryKeys` symbol. Current sub-path imports disambiguate by specifying the sub-module.
   - What's unclear: Are there any files that import `queryKeys` from both `@shared/types/scriptFormatter` AND `@shared/lib/query-keys`?
   - Recommendation: Check for collision during migration. If found, use aliased import: `import { queryKeys as scriptFormatterQueryKeys } from '@shared/types'`.

## Sources

### Primary (HIGH confidence)
- Direct codebase grep scan of all `@shared/*/subpath` and `@features/*/subpath` imports
- Barrel file contents verified: `src/shared/utils/index.ts`, `src/shared/lib/index.ts`, `src/shared/types/index.ts`, `src/shared/constants/index.ts`, `src/shared/hooks/index.ts`, `src/shared/services/index.ts`
- Milestone audit: `.planning/v1.0-MILESTONE-AUDIT.md` (INT-01, INT-02 gap definitions)
- Phase 02 decisions in STATE.md (bulk import script pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, purely codebase refactoring
- Architecture: HIGH - barrel convention already established, just enforcing consistency
- Pitfalls: HIGH - identified from actual codebase patterns (merge conflicts, exceptions, name collision)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- codebase conventions unlikely to change)
