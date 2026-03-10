# Phase 10: API Bypass Fixes & Baker Bookkeeping - Research

**Researched:** 2026-03-10
**Domain:** Module boundary enforcement, contract testing, documentation bookkeeping
**Confidence:** HIGH

## Summary

Phase 10 closes structural gaps identified by the v1.0 milestone audit. There are three categories of work: (1) fixing 5 files that bypass api.ts with direct Tauri plugin imports (1 Baker, 4 Trello), (2) adding missing barrel exports and comprehensive no-bypass contract tests across all 8 feature modules, and (3) correcting bookkeeping in SUMMARY 07-01 and REQUIREMENTS.md for BAKR-01/02/03.

All patterns needed already exist in the codebase. Baker api.ts already has `openExternalUrl()` wrapping `@tauri-apps/plugin-opener` and `openInShell()` wrapping `@tauri-apps/plugin-shell`. BuildProject has the most modern no-bypass test pattern using `fs.readdirSync` recursion (not grep/execSync). The work is mechanical -- no new libraries, no architectural decisions, no ambiguity.

**Primary recommendation:** Fix bypass violations first, then update contract tests to the comprehensive recursive pattern across all 8 modules, then do bookkeeping last.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each module owns its own I/O boundary -- duplicate wrappers per module, no cross-feature sharing
- Trello gets its own `openExternalUrl()` in Trello/api.ts
- Baker NormalView.tsx uses Baker's existing `openExternalUrl()` from Baker/api.ts
- Trello consolidates all URL-opening to `@tauri-apps/plugin-opener` (openUrl), dropping `@tauri-apps/plugin-shell` (open)
- All 4 Trello call sites use the single Trello api.ts wrapper
- Export `BreadcrumbsViewerProps` from Baker barrel
- Audit all Baker/types.ts for any other types consumed outside Baker that aren't exported -- fix any found
- Replace per-directory grep tests with comprehensive "scan all non-api.ts files" pattern
- Apply comprehensive no-bypass pattern to ALL 8 feature modules
- Mark BAKR-01/02/03 as Complete only AFTER code fixes are done

### Claude's Discretion
- Exact grep command syntax for the comprehensive no-bypass test
- Whether to use a shared test helper or inline the grep in each contract test
- Order of operations for the fixes

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAKR-01 | User can import Baker components, hooks, and types from `@features/Baker` barrel only | BreadcrumbsViewerProps must be added to Baker/index.ts; audit confirmed no other missing exports |
| BAKR-02 | User can see an API layer wrapping Baker-related Tauri commands | Baker/internal/NormalView.tsx line 6 imports `open` from `@tauri-apps/plugin-shell` -- must use `openExternalUrl` from `../api` |
| BAKR-03 | User can see contract tests validating Baker module's public interface | Baker no-bypass tests must be upgraded to comprehensive pattern scanning internal/ and all subdirectories |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (project) | Test runner for contract tests | Already configured, all existing tests use it |
| node:fs | (built-in) | File system reads in no-bypass tests | Used by BuildProject pattern for recursive directory scanning |
| node:path | (built-in) | Path resolution in tests | Used by BuildProject pattern for module path calculation |

### Supporting
No new libraries needed. All work uses existing project infrastructure.

## Architecture Patterns

### Pattern 1: API Bypass Fix (Baker)
**What:** Replace direct `@tauri-apps/plugin-shell` import with api.ts wrapper
**When to use:** Any file importing a Tauri plugin directly instead of through the module's api.ts

Baker/internal/NormalView.tsx currently:
```typescript
import { open } from '@tauri-apps/plugin-shell'
// ... later:
await open(url)
```

Must become:
```typescript
import { openExternalUrl } from '../api'
// ... later:
await openExternalUrl(url)
```

Note: The CONTEXT.md specifies using `openExternalUrl` (plugin-opener) not `openInShell` (plugin-shell). This is because the NormalView usage opens URLs in browser, not files in system shell.

### Pattern 2: API Bypass Fix (Trello)
**What:** Add `openExternalUrl()` to Trello/api.ts, replace all 4 direct imports
**When to use:** Trello files that import plugin-shell or plugin-opener directly

Trello/api.ts needs a new wrapper:
```typescript
import { openUrl } from '@tauri-apps/plugin-opener'
// ...
export async function openExternalUrl(url: string): Promise<void> {
  return openUrl(url)
}
```

Then all 4 files replace their direct imports:
- `useTrelloActions.ts`: `import { open } from '@tauri-apps/plugin-shell'` -> `import { openExternalUrl } from '../api'`
- `useUploadTrello.ts`: `import { open } from '@tauri-apps/plugin-shell'` -> `import { openExternalUrl } from '../api'`
- `TrelloIntegrationModal.tsx`: `import { open } from '@tauri-apps/plugin-shell'` -> `import { openExternalUrl } from '../api'`
- `TrelloCardItem.tsx`: `import { openUrl } from '@tauri-apps/plugin-opener'` -> `import { openExternalUrl } from '../api'`

Call site changes: `open(url)` / `openUrl(url)` -> `openExternalUrl(url)` in all 4 files.

The Trello api.ts mock in trello.contract.test.ts must also add `openExternalUrl: vi.fn()`.

### Pattern 3: Comprehensive No-Bypass Test (BuildProject Reference)
**What:** Recursively scan all .ts/.tsx files in a module (excluding api.ts and __contracts__/) for direct @tauri-apps imports
**Source:** BuildProject contract test (lines 122-180) -- the most modern pattern

```typescript
import fs from 'node:fs'
import path from 'node:path'

// Inside describe block:
const projectRoot = path.resolve(__dirname, '../../../../')
const modulePath = path.resolve(projectRoot, 'src/features/ModuleName')

function getFilesRecursive(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
      files.push(...getFilesRecursive(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

it('all non-api.ts files have zero direct @tauri-apps imports', () => {
  const allFiles = getFilesRecursive(modulePath, ['.ts', '.tsx'])
  const nonApiFiles = allFiles.filter((f) => !f.endsWith('/api.ts'))
  for (const file of nonApiFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const lines = content.split('\n')
    const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
    expect(tauriImports).toEqual([])
  }
})
```

**Decision point (Claude's discretion):** Whether to use a shared test helper or inline.

**Recommendation:** Inline the helper in each contract test. Reasons:
1. Contract tests should be self-contained -- no external dependencies
2. The helper is ~15 lines, not worth extracting
3. Each module can customize exclusions if needed
4. Matches existing BuildProject pattern exactly

### Pattern 4: Baker Barrel Export Addition
**What:** Add BreadcrumbsViewerProps type export to Baker/index.ts

```typescript
/** Props for the BreadcrumbsViewer component with project path and display options */
export type { BreadcrumbsViewerProps } from './types'
```

Baker contract shape test must also update the expected export count.

### Anti-Patterns to Avoid
- **Sharing api.ts wrappers across modules:** Each module owns its boundary. Baker has `openExternalUrl`, Trello gets its own `openExternalUrl`. Do not create a shared utility.
- **Using execSync/grep for no-bypass tests:** Baker's current pattern uses `child_process.execSync` with grep. BuildProject's `fs.readdirSync` pattern is more portable, faster, and gives better error messages. Replace the old pattern.
- **Marking requirements complete before code fixes:** CONTEXT.md explicitly says bookkeeping happens AFTER code fixes are verified.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| No-bypass scanning | Custom grep/shell scripts | fs.readdirSync recursive pattern | Portable, fast, better error messages per-file |
| URL opening wrapper | Shared cross-module utility | Per-module api.ts wrapper | Module isolation principle |

## Common Pitfalls

### Pitfall 1: Missing Call Site Rename
**What goes wrong:** Replacing the import but not the function call (`open(url)` must become `openExternalUrl(url)`)
**Why it happens:** Find-and-replace on import line misses the usage sites
**How to avoid:** Search for `open(` and `openUrl(` calls in each file after changing imports
**Warning signs:** TypeScript errors about `open` not being defined

### Pitfall 2: Forgetting to Update Contract Test Mocks
**What goes wrong:** Adding `openExternalUrl` to Trello/api.ts but not adding it to `vi.mock('../api')` in trello.contract.test.ts
**Why it happens:** Mock definitions are separate from source
**How to avoid:** Every api.ts change requires a corresponding mock update
**Warning signs:** Contract tests fail with "openExternalUrl is not a function"

### Pitfall 3: Baker Contract Shape Count Drift
**What goes wrong:** Adding BreadcrumbsViewerProps to barrel but not updating the shape test expected count
**Why it happens:** Baker barrel currently exports 21 items (6 runtime + 15 type exports based on index.ts). Adding BreadcrumbsViewerProps makes it 22.
**How to avoid:** Update the shape test `toHaveLength()` assertion
**Warning signs:** Shape test fails with "expected 21, received 22"

### Pitfall 4: NormalView Uses `open()` for URL, Not File Path
**What goes wrong:** Using `openInShell()` instead of `openExternalUrl()` for the NormalView fix
**Why it happens:** NormalView imports from `plugin-shell` so it seems like shell open
**How to avoid:** Check the actual usage -- line 150 calls `await open(url)` where url is an external URL. Use `openExternalUrl` (plugin-opener) not `openInShell` (plugin-shell).
**Warning signs:** URLs don't open in browser, or different behavior than expected

### Pitfall 5: No-Bypass Test Not Excluding api.ts
**What goes wrong:** The comprehensive test catches api.ts itself (which legitimately imports @tauri-apps)
**Why it happens:** Recursive scan includes all .ts files
**How to avoid:** Filter out files ending in `/api.ts` from the scan results
**Warning signs:** Test fails on the api.ts file itself

## Code Examples

### Current Baker No-Bypass (OLD -- to be replaced)
```typescript
// Source: src/features/Baker/__contracts__/baker.contract.test.ts lines 324-361
// Uses execSync + grep -- per-directory, misses internal/
it('hooks/ directory has zero direct @tauri-apps imports', async () => {
  const { execSync } = await import('child_process')
  const result = execSync(
    'grep -rn "@tauri-apps" src/features/Baker/hooks/ 2>/dev/null || true',
    { encoding: 'utf-8', cwd: '/Users/danielmills/Documents/CODE/bucket' }
  )
  expect(result.trim()).toBe('')
})
```

### New Comprehensive Pattern (from BuildProject)
```typescript
// Source: src/features/BuildProject/__contracts__/buildproject.contract.test.ts lines 122-180
// Uses fs.readdirSync -- scans ALL subdirectories, excludes only __contracts__/
function getFilesRecursive(dir: string, extensions: string[]): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
      files.push(...getFilesRecursive(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}
```

### Trello api.ts Mock (current -- needs openExternalUrl added)
```typescript
// Source: src/features/Trello/__contracts__/trello.contract.test.ts lines 13-32
vi.mock('../api', () => ({
  fetchTrelloBoards: vi.fn().mockResolvedValue([]),
  // ... existing mocks ...
  openFileDialog: vi.fn().mockResolvedValue(null)
  // ADD: openExternalUrl: vi.fn().mockResolvedValue(undefined)
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| execSync grep per-directory | fs.readdirSync recursive scan | Phase 8 (BuildProject) | Catches all subdirectories including internal/ |
| Per-directory no-bypass tests | Single comprehensive "all non-api.ts files" test | Phase 8 | Prevents future subdirectory additions from being missed |
| No no-bypass tests (Auth, Premiere, Upload, Settings, AITools, Trello) | Comprehensive no-bypass tests on all 8 modules | Phase 10 | Full structural enforcement |

## Specific File Inventory

### Files to Modify (bypass fixes)
| File | Current Import | New Import | Call Site Change |
|------|---------------|------------|-----------------|
| `src/features/Baker/internal/NormalView.tsx:6` | `import { open } from '@tauri-apps/plugin-shell'` | `import { openExternalUrl } from '../api'` | `open(url)` -> `openExternalUrl(url)` |
| `src/features/Trello/hooks/useTrelloActions.ts:7` | `import { open } from '@tauri-apps/plugin-shell'` | `import { openExternalUrl } from '../api'` | `open(url)` -> `openExternalUrl(url)` |
| `src/features/Trello/hooks/useUploadTrello.ts:14` | `import { open } from '@tauri-apps/plugin-shell'` | `import { openExternalUrl } from '../api'` | `open(url.toString())` -> `openExternalUrl(url.toString())` |
| `src/features/Trello/components/TrelloIntegrationModal.tsx:11` | `import { open } from '@tauri-apps/plugin-shell'` | `import { openExternalUrl } from '../api'` | `open(url.toString())` -> `openExternalUrl(url.toString())` |
| `src/features/Trello/components/TrelloCardItem.tsx:6` | `import { openUrl } from '@tauri-apps/plugin-opener'` | `import { openExternalUrl } from '../api'` | `openUrl(trelloCard.url)` -> `openExternalUrl(trelloCard.url)` |

### Files to Modify (api.ts additions)
| File | Addition |
|------|----------|
| `src/features/Trello/api.ts` | Add `import { openUrl } from '@tauri-apps/plugin-opener'` and `export async function openExternalUrl(url: string): Promise<void> { return openUrl(url) }` |

### Files to Modify (barrel exports)
| File | Addition |
|------|----------|
| `src/features/Baker/index.ts` | Add `export type { BreadcrumbsViewerProps } from './types'` with JSDoc |

### Files to Modify (contract tests -- update existing)
| File | Change |
|------|--------|
| `src/features/Baker/__contracts__/baker.contract.test.ts` | Replace 3 per-directory grep tests with comprehensive recursive pattern; update shape count |
| `src/features/Trello/__contracts__/trello.contract.test.ts` | Add no-bypass test section; add openExternalUrl to api mock |

### Files to Modify (contract tests -- add no-bypass to)
| File | Change |
|------|--------|
| `src/features/Auth/__contracts__/auth.contract.test.ts` | Add no-bypass test section |
| `src/features/Premiere/__contracts__/premiere.contract.test.ts` | Add no-bypass test section |
| `src/features/Upload/__contracts__/upload.contract.test.ts` | Add no-bypass test section |
| `src/features/Settings/__contracts__/settings.contract.test.ts` | Add no-bypass test section |
| `src/features/AITools/__contracts__/aitools.contract.test.ts` | Add no-bypass test section |
| `src/features/BuildProject/__contracts__/buildproject.contract.test.ts` | Already has comprehensive pattern -- no changes needed |

### Files to Modify (bookkeeping)
| File | Change |
|------|--------|
| `.planning/phases/07-baker-module/07-01-SUMMARY.md` | Change `requirements-completed: []` to `requirements-completed: [BAKR-01, BAKR-02, BAKR-03]` |
| `.planning/REQUIREMENTS.md` | Check BAKR-01/02/03 boxes `[x]`, update traceability status to Complete |

## Module No-Bypass Coverage Status

| Module | Has No-Bypass Tests | Pattern | Phase 10 Action |
|--------|-------------------|---------|-----------------|
| Auth | No | N/A | Add comprehensive pattern |
| Premiere | No | N/A | Add comprehensive pattern |
| Trello | No | N/A | Add comprehensive pattern |
| Upload | No | N/A | Add comprehensive pattern |
| Settings | No | N/A | Add comprehensive pattern |
| AITools | No | N/A | Add comprehensive pattern |
| Baker | Yes | Old (grep/execSync, per-directory) | Replace with comprehensive pattern |
| BuildProject | Yes | Current (fs.readdirSync, recursive) | No changes needed |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project configured) |
| Config file | vite.config.ts (inline vitest config) |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAKR-01 | BreadcrumbsViewerProps exported from barrel | unit (shape) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Yes (needs update) |
| BAKR-02 | NormalView.tsx uses api.ts, not direct plugin | unit (no-bypass) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Yes (needs update) |
| BAKR-03 | Contract tests scan internal/ directory | unit (no-bypass) | `bun run test -- --run src/features/Baker/__contracts__/baker.contract.test.ts` | Yes (needs update) |

### Sampling Rate
- **Per task commit:** `bun run test -- --run`
- **Per wave merge:** `bun run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Contract test files already exist for all 8 modules.

## Open Questions

None. All technical decisions are locked or covered by Claude's discretion. The work is fully specified.

## Sources

### Primary (HIGH confidence)
- Direct file inspection of all affected source files in the codebase
- Baker/api.ts (lines 178-184): Existing openInShell and openExternalUrl wrappers
- Trello/api.ts: Current api boundary -- missing openExternalUrl wrapper
- BuildProject contract test (lines 122-180): Reference comprehensive no-bypass pattern
- Baker contract test (lines 324-361): Current per-directory grep pattern to replace
- v1.0-MILESTONE-AUDIT.md: Gap identification and evidence

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all patterns exist in codebase
- Architecture: HIGH - replicating existing BuildProject pattern across modules
- Pitfalls: HIGH - all identified from direct code inspection, known failure modes
- Bypass fixes: HIGH - exact file/line/import identified for all 5 violations
- Bookkeeping: HIGH - exact files and field values identified

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies or version concerns)
