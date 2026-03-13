# Phase 3: Leaf Feature Modules - Research

**Researched:** 2026-03-09
**Domain:** Feature module extraction (Auth, Trello, Premiere) with barrel exports, API layers, contract tests
**Confidence:** HIGH

## Summary

Phase 3 migrates three leaf feature modules (Auth, Trello, Premiere) from scattered locations across `src/hooks/`, `src/context/`, `src/pages/`, `src/components/`, and `src/utils/` into self-contained deep modules at `src/features/`. Each module gets a barrel export (`index.ts`), an API layer (`api.ts`) wrapping all external I/O, and contract tests validating public interface behavior.

The established patterns from Phase 2 (shared infrastructure) provide a clear template: named re-exports in barrels, `__contracts__/` directories colocated with modules, and behavioral + shape tests. The ESLint boundary rules are already configured for `@features/*` (warn mode). Path aliases `@features/*` and `@shared/*` exist in tsconfig.

**Primary recommendation:** Follow Phase 2 contract test patterns exactly. Extract API layers first (they define the mockable boundary), then move files, then update imports, then write contract tests. The 2-plan split (Auth+Premiere then Trello) aligns with complexity: Auth has 6 files + 2 invoke calls, Premiere has 2 files + 4 invoke calls, Trello has 21+ files with mixed fetch/invoke/file-plugin calls.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Trello barrel exports **both components and hooks** -- Baker imports pre-built UI (TrelloIntegrationButton, TrelloIntegrationModal) + logic hooks from `@features/Trello`
- `useBakerTrelloIntegration` lives **inside Trello module** -- it's a Trello capability, not Baker orchestration
- Trello-specific utils (TrelloCards.tsx, trelloBoardValidation.ts) move **inside the Trello module** as internal files, not exported
- UploadTrello page types and hooks **merge into module-level structure** (types.ts, hooks/) -- no nested page-level type/hook silos
- api.ts wraps **all external calls**: Tauri invoke(), fetch() to REST APIs, AND Tauri file plugins (writeTextFile, readTextFile, etc.)
- Single file owns all I/O per module -- mock one file to isolate the entire module for testing
- This pattern applies **consistently to all three modules** (Auth, Trello, Premiere)
- **Keep React Context pattern** for Auth -- converting to Zustand would be a behavioral change
- Barrel exports `AuthProvider` for App.tsx: `import { AuthProvider } from '@features/Auth'`
- All auth API calls (login, register, token check) go through auth/api.ts
- Login.tsx and Register.tsx pages live **inside @features/Auth/components/** -- barrel exports them for AppRouter
- **2 plans total**: Plan 03-01 (Auth + Premiere, 8 files combined), Plan 03-02 (Trello, 21 files)
- Contract tests written as part of each plan, not a separate step

### Claude's Discretion
- Whether Auth api.ts owns localStorage access or just wraps invoke() calls
- Whether to split Trello's api.ts into sub-files if it exceeds ~200 lines
- Exact barrel export list for each module (which hooks/components are public vs internal)
- Internal file organization within each module directory

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Import auth components, hooks, types from `@features/Auth` barrel only | Barrel pattern from Phase 2; 6 files identified (AuthContext, AuthProvider, useAuth, useAuthCheck, Login, Register) |
| AUTH-02 | API layer wrapping auth-related Tauri commands | 2 invoke calls (add_token, check_auth) + localStorage + external API fetch identified in AuthProvider.tsx and useAuthCheck.ts |
| AUTH-03 | Contract tests validating Auth module's public interface | Phase 2 contract test pattern documented (shape + behavioral tests) |
| TREL-01 | Import Trello components, hooks, types from `@features/Trello` barrel only | 21+ files identified across hooks/, components/, utils/, pages/ |
| TREL-02 | API layer wrapping Trello-related Tauri commands | 1 invoke (fetch_trello_boards) + 5 REST fetch() calls + 4 readTextFile/writeTextFile calls identified |
| TREL-03 | Contract tests validating Trello module's public interface | Same pattern; Trello has richer surface requiring more behavioral tests |
| PREM-01 | Import Premiere components, hooks, types from `@features/Premiere` barrel only | 2 files: PremierePluginManager.tsx, usePremiereIntegration.ts |
| PREM-02 | API layer wrapping Premiere-related Tauri commands | 4 invoke calls: get_available_plugins, install_plugin, open_cep_folder, show_confirmation_dialog + copy_premiere_project in usePremiereIntegration |
| PREM-03 | Contract tests validating Premiere module's public interface | Small surface -- shape + behavioral tests straightforward |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (project standard) | Contract test runner | Already used for all Phase 2 contract tests |
| @testing-library/react | (project standard) | renderHook for behavioral tests | Established in Phase 2 hooks contract tests |
| eslint-plugin-boundaries | (project standard) | Enforce barrel-only imports | Already configured with `@features/*` zone in eslint.config.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api/core | 2.x | invoke() wrapper target | Auth (2 calls), Premiere (5 calls), Trello (1 call via fetch_trello_boards) |
| @tauri-apps/plugin-fs | 2.x | readTextFile/writeTextFile wrapper target | Trello breadcrumbs I/O (4 call sites) |

No new dependencies needed. All tools are already in the project.

## Architecture Patterns

### Recommended Module Structure

Each feature module follows the same deep module pattern:

```
src/features/Auth/
  index.ts              # Barrel: named re-exports only
  api.ts                # All I/O: invoke(), localStorage, fetch()
  types.ts              # Module-scoped types
  AuthContext.ts         # React context definition
  AuthProvider.tsx       # Context provider component
  hooks/
    useAuth.ts
    useAuthCheck.ts
  components/
    Login.tsx
    Register.tsx
  __contracts__/
    auth.contract.test.ts

src/features/Premiere/
  index.ts
  api.ts                # invoke() wrappers for 5 commands
  types.ts
  components/
    PremierePluginManager.tsx
  hooks/
    usePremiereIntegration.ts
  __contracts__/
    premiere.contract.test.ts

src/features/Trello/
  index.ts
  api.ts                # fetch() to Trello REST + invoke(fetch_trello_boards) + readTextFile/writeTextFile
  types.ts              # Merged from UploadTrelloTypes.ts + TrelloCards.tsx interfaces
  hooks/
    useTrelloBoards.ts
    useTrelloBoard.ts
    useTrelloBoardId.ts
    useTrelloBoardSearch.ts
    useTrelloCardDetails.ts
    useTrelloCardSelection.ts
    useTrelloCardsManager.ts
    useTrelloActions.ts
    useTrelloBreadcrumbs.ts
    useUploadTrello.ts
    useTrelloVideoInfo.ts
    useParsedTrelloDescription.ts
    useBakerTrelloIntegration.ts
    useVideoLinksManager.ts
    useBreadcrumbsTrelloCards.ts
    (UploadTrelloHooks.ts merged or eliminated)
  components/
    TrelloIntegrationButton.tsx
    TrelloIntegrationModal.tsx
    TrelloCardItem.tsx
    TrelloCardUpdateDialog.tsx
    TrelloCardsManager.tsx
    TrelloBoardSelector.tsx
    TrelloBoardError.tsx
    CardDetailsDialog.tsx
    UploadTrello.tsx       # Page component
  internal/
    TrelloCards.tsx         # Utility functions (not exported from barrel)
    trelloBoardValidation.ts
    TrelloCardList.tsx
    TrelloCardMembers.tsx
  __contracts__/
    trello.contract.test.ts
```

### Pattern 1: API Layer (Single I/O Boundary)

**What:** One `api.ts` file per module that wraps ALL external calls (invoke, fetch, file plugins, localStorage).
**When to use:** Every feature module.
**Example:**

```typescript
// src/features/Auth/api.ts
import { invoke } from '@tauri-apps/api/core'

export async function addToken(token: string): Promise<void> {
  await invoke('add_token', { token })
}

export async function checkAuth(token: string): Promise<string> {
  return invoke<string>('check_auth', { token })
}

// localStorage wrappers (Claude's discretion: include here for single mock point)
export function getStoredToken(): string | null {
  return localStorage.getItem('access_token')
}

export function getStoredUsername(): string | null {
  return localStorage.getItem('username')
}

export function setStoredCredentials(token: string, username: string): void {
  localStorage.setItem('access_token', token)
  localStorage.setItem('username', username)
}

export function clearStoredCredentials(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('username')
}
```

### Pattern 2: Barrel Export (Named Re-exports Only)

**What:** `index.ts` uses explicit named re-exports, no wildcards.
**When to use:** Every feature module barrel.
**Example:**

```typescript
// src/features/Auth/index.ts
export { AuthProvider } from './AuthProvider'
export { useAuth } from './hooks/useAuth'
export { useAuthCheck } from './hooks/useAuthCheck'
export type { AuthContextType } from './AuthContext'
// Login and Register exported for AppRouter
export { default as Login } from './components/Login'
export { default as Register } from './components/Register'
```

### Pattern 3: Contract Tests (Shape + Behavioral)

**What:** Tests in `__contracts__/` that validate barrel export shape and key behaviors.
**When to use:** Every feature module.
**Example:**

```typescript
// src/features/Auth/__contracts__/auth.contract.test.ts
import { describe, expect, it, vi } from 'vitest'
import * as authBarrel from '../index'

// Mock the api layer (single mock point)
vi.mock('../api', () => ({
  addToken: vi.fn().mockResolvedValue(undefined),
  checkAuth: vi.fn().mockResolvedValue('authenticated'),
  getStoredToken: vi.fn().mockReturnValue('test-token'),
  getStoredUsername: vi.fn().mockReturnValue('test-user'),
  setStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn()
}))

describe('Auth Barrel Exports - Shape', () => {
  it('exports AuthProvider as a component', () => {
    expect(typeof authBarrel.AuthProvider).toBe('function')
  })

  it('exports useAuth as a function', () => {
    expect(typeof authBarrel.useAuth).toBe('function')
  })

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(authBarrel)
    expect(exportNames.sort()).toEqual([
      'AuthProvider', 'Login', 'Register', 'useAuth', 'useAuthCheck'
    ])
  })
})

// Behavioral tests with renderHook follow same pattern as Phase 2
```

### Anti-Patterns to Avoid
- **Wildcard re-exports in barrels:** Use `export { X } from './X'`, never `export * from './X'`. Wildcard exports leak internals.
- **Components calling invoke() directly:** Every invoke/fetch/file-plugin call must go through api.ts. PremierePluginManager.tsx currently has 4 direct invoke() calls that must be refactored to use api.ts.
- **Importing from internal paths:** After migration, `import { useTrelloBoards } from '@hooks/useTrelloBoards'` must become `import { useTrelloBoards } from '@features/Trello'`. No deep imports into module internals.
- **Cross-referencing old paths:** Hooks like useTrelloCardSelection.ts import from `@pages/UploadTrello/UploadTrelloTypes` -- these must reference module-local types after migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Barrel export enforcement | Custom import linting | eslint-plugin-boundaries (already configured) | Rules exist, just need modules to exist at `src/features/*` |
| API mocking in tests | Manual mock objects per test | vi.mock('../api') at module level | Single mock point per feature -- the whole purpose of the api.ts layer |
| Import path updates | Manual find-and-replace | IDE refactoring + bulk sed/Python script | Phase 2 proved bulk import updates need atomic application (Python script approach from 02-03) |

## Common Pitfalls

### Pitfall 1: Circular Dependencies Between Trello Files
**What goes wrong:** Trello hooks reference each other extensively (useTrelloCardsManager imports useBreadcrumbsTrelloCards, useTrelloBoard; useTrelloCardSelection imports useTrelloCardDetails). Moving them all into one module is fine, but the api.ts must not import from hooks.
**Why it happens:** api.ts wraps I/O primitives. If hooks import api.ts and api.ts imports hooks, circular dependency.
**How to avoid:** api.ts is strictly a leaf -- it imports only from external packages (@tauri-apps/api/core, @tauri-apps/plugin-fs) and possibly from its own types.ts. Hooks import api.ts, never the reverse.
**Warning signs:** TypeScript circular reference errors, undefined imports at runtime.

### Pitfall 2: useBakerTrelloIntegration Target Mismatch
**What goes wrong:** This hook is tagged `// Target: @features/Baker` in the source but the CONTEXT.md explicitly says it belongs in Trello module.
**Why it happens:** Phase 2 tagging was done before the context discussion resolved ownership.
**How to avoid:** Follow CONTEXT.md (locked decision): `useBakerTrelloIntegration` goes in `@features/Trello`. The `// Target:` comment was advisory.
**Warning signs:** If the hook ends up in Baker, Baker would need to import Trello internals, breaking module boundaries.

### Pitfall 3: usePremiereIntegration Target Mismatch
**What goes wrong:** This hook is tagged `// Target: @features/BuildProject` but it's a Premiere capability.
**Why it happens:** It was tagged based on where it's consumed, not what domain it belongs to.
**How to avoid:** It belongs in `@features/Premiere` module. BuildProject will import it from the barrel when Phase 8 runs.

### Pitfall 4: TrelloCards.tsx Contains Both Types AND a Hook
**What goes wrong:** `src/utils/TrelloCards.tsx` exports interfaces (TrelloCard, TrelloList, TrelloMember), utility functions (fetchTrelloLists, fetchTrelloCards, groupCardsByList, updateCard), AND a hook (useTrelloCardMembers). Naive file move breaks consumers.
**Why it happens:** Legacy code mixed concerns in one file.
**How to avoid:** Split during migration: types go to `types.ts`, fetch/update functions go to `api.ts`, useTrelloCardMembers becomes a separate hook file. groupCardsByList is a pure utility that stays internal.

### Pitfall 5: Import Path Updates Must Be Atomic
**What goes wrong:** Updating imports one-by-one triggers ESLint auto-fix and Prettier, which can revert or corrupt partial changes.
**Why it happens:** IDE save hooks run between manual edits.
**How to avoid:** Phase 2 solved this with bulk Python/sed scripts for atomic import replacement. Use the same approach.

### Pitfall 6: UploadTrello Page Is Both Consumer AND Member
**What goes wrong:** `src/pages/UploadTrello.tsx` is a page component that should arguably live inside the Trello module (it's entirely Trello-specific), but it's also a route target imported by AppRouter.
**Why it happens:** The page is 100% Trello functionality.
**How to avoid:** Move it inside `@features/Trello/components/` and export from the barrel. AppRouter imports it as `import { UploadTrello } from '@features/Trello'`. Same pattern as Login/Register in Auth.

### Pitfall 7: Dynamic Imports in useBakerTrelloIntegration
**What goes wrong:** `useBakerTrelloIntegration` uses `await import('@hooks/useAppendBreadcrumbs')` (dynamic import). After migration, this path breaks.
**Why it happens:** Dynamic imports bypass TypeScript path alias checking at build time.
**How to avoid:** Convert to static imports during migration, or update the dynamic import path. Since useAppendBreadcrumbs may not belong to Trello module, evaluate whether it should be in shared or if the relevant functions should be extracted into Trello's api.ts.

## Code Examples

### Auth API Layer (Complete)

```typescript
// src/features/Auth/api.ts
// Wraps: invoke('add_token'), invoke('check_auth'), localStorage access
import { invoke } from '@tauri-apps/api/core'

export async function addToken(token: string): Promise<void> {
  await invoke('add_token', { token })
}

export async function checkAuth(token: string): Promise<string> {
  return invoke<string>('check_auth', { token })
}

export function getStoredToken(): string | null {
  return localStorage.getItem('access_token')
}

export function getStoredUsername(): string | null {
  return localStorage.getItem('username')
}

export function setStoredCredentials(token: string, username: string): void {
  localStorage.setItem('access_token', token)
  localStorage.setItem('username', username)
}

export function clearStoredCredentials(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('username')
}
```

### Premiere API Layer (Complete)

```typescript
// src/features/Premiere/api.ts
// Wraps: 5 invoke() calls
import { invoke } from '@tauri-apps/api/core'

export interface PluginInfo {
  name: string
  displayName: string
  version: string
  filename: string
  size: number
  installed: boolean
  description: string
  features: string[]
  icon: string
}

export interface InstallResult {
  success: boolean
  message: string
  pluginName: string
  installedPath: string
}

export async function getAvailablePlugins(): Promise<PluginInfo[]> {
  return invoke<PluginInfo[]>('get_available_plugins')
}

export async function installPlugin(
  pluginFilename: string,
  pluginName: string
): Promise<InstallResult> {
  return invoke<InstallResult>('install_plugin', { pluginFilename, pluginName })
}

export async function openCepFolder(): Promise<void> {
  await invoke('open_cep_folder')
}

export async function showConfirmationDialog(
  message: string,
  title: string,
  destination: string
): Promise<void> {
  await invoke('show_confirmation_dialog', { message, title, destination })
}

export async function copyPremiereProject(
  destinationFolder: string,
  newTitle: string
): Promise<string> {
  return invoke<string>('copy_premiere_project', { destinationFolder, newTitle })
}
```

### Trello API Layer (Skeleton -- Claude's Discretion on Split)

```typescript
// src/features/Trello/api.ts
// Wraps: 1 invoke(), 5+ fetch() to Trello REST, readTextFile/writeTextFile
import { invoke } from '@tauri-apps/api/core'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { TrelloBoard } from '@shared/types'

// --- Tauri Commands ---
export async function fetchTrelloBoards(
  apiKey: string,
  apiToken: string
): Promise<TrelloBoard[]> {
  return invoke<TrelloBoard[]>('fetch_trello_boards', { apiKey, apiToken })
}

// --- Trello REST API ---
export async function fetchCardWithMembers(
  cardId: string, apiKey: string, token: string
): Promise<unknown> { /* ... */ }

export async function fetchBoardCards(
  boardId: string, apiKey: string, token: string
): Promise<unknown> { /* ... */ }

export async function fetchBoardLists(
  boardId: string, apiKey: string, token: string
): Promise<unknown> { /* ... */ }

export async function fetchCardMembers(
  cardId: string, apiKey: string, token: string
): Promise<unknown> { /* ... */ }

export async function updateCard(
  cardId: string, updates: Record<string, string>,
  apiKey: string, token: string
): Promise<void> { /* ... */ }

// --- File System ---
export async function readBreadcrumbsFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeBreadcrumbsFile(
  path: string, content: string
): Promise<void> {
  await writeTextFile(path, content)
}
```

### Consumer Import Update Pattern

```typescript
// BEFORE (scattered imports)
import { AuthProvider } from './context/AuthProvider'        // App.tsx
import Login from './pages/auth/Login'                        // AppRouter.tsx
import { useTrelloBoards } from '@hooks/useTrelloBoards'     // Settings.tsx
import PremierePluginManager from './pages/PremierePluginManager/PremierePluginManager'

// AFTER (barrel imports)
import { AuthProvider } from '@features/Auth'
import { Login, Register } from '@features/Auth'
import { useTrelloBoards } from '@features/Trello'
import { PremierePluginManager } from '@features/Premiere'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Files scattered by type (hooks/, components/, utils/) | Deep feature modules with barrel exports | Phase 2 (shared), Phase 3 (features) | All imports go through barrels; internals hidden |
| Direct invoke() in components | api.ts layer per module | Phase 3 (new) | Single mock point for testing; no component touches Tauri directly |
| No contract tests | __contracts__/ per module | Phase 2 (established) | Public API locked down; regression protection |

## Open Questions

1. **useAppendBreadcrumbs ownership**
   - What we know: Used by useBakerTrelloIntegration via dynamic import. Contains `updateTrelloCardWithBreadcrumbs` and `generateBreadcrumbsBlock`.
   - What's unclear: Whether it belongs in Trello module, shared, or Baker.
   - Recommendation: If it's primarily Trello card updating logic, move relevant functions into Trello's api.ts or a Trello internal utility. If it's generic breadcrumb logic, keep in shared.

2. **Baker components consuming Trello**
   - What we know: `src/components/Baker/TrelloCardsManager.tsx`, `TrelloCardItem.tsx`, `TrelloCardUpdateDialog.tsx`, `TrelloCards/AddCardDialog.tsx` are in Baker directory but are Trello-domain.
   - What's unclear: Whether they go into Trello module now or wait for Baker (Phase 7).
   - Recommendation: Per CONTEXT.md, Trello components that Baker consumes should be in the Trello module. Move them to `@features/Trello/components/` and export from barrel. Baker will import from `@features/Trello`.

3. **Trello api.ts size**
   - What we know: Trello has ~10 external call sites (1 invoke, 5 fetch, 4 file operations).
   - What's unclear: Whether a single api.ts will exceed ~200 lines.
   - Recommendation: Start with single file. If it exceeds 200 lines, split into `api/rest.ts`, `api/fs.ts`, `api/commands.ts` with an `api/index.ts` barrel. This is Claude's discretion per CONTEXT.md.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | Inline in vite.config.ts (standard Vitest setup) |
| Quick run command | `bun run test -- --run` |
| Full suite command | `bun run test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Auth barrel exports correct shape | unit | `bun run test -- --run src/features/Auth/__contracts__/auth.contract.test.ts` | Wave 0 |
| AUTH-02 | Auth api.ts wraps invoke/localStorage | unit | Same contract test file | Wave 0 |
| AUTH-03 | Auth contract tests validate public interface behavior | unit | Same contract test file | Wave 0 |
| TREL-01 | Trello barrel exports correct shape | unit | `bun run test -- --run src/features/Trello/__contracts__/trello.contract.test.ts` | Wave 0 |
| TREL-02 | Trello api.ts wraps invoke/fetch/fs | unit | Same contract test file | Wave 0 |
| TREL-03 | Trello contract tests validate public interface behavior | unit | Same contract test file | Wave 0 |
| PREM-01 | Premiere barrel exports correct shape | unit | `bun run test -- --run src/features/Premiere/__contracts__/premiere.contract.test.ts` | Wave 0 |
| PREM-02 | Premiere api.ts wraps invoke calls | unit | Same contract test file | Wave 0 |
| PREM-03 | Premiere contract tests validate public interface behavior | unit | Same contract test file | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- --run src/features/{Module}/__contracts__/`
- **Per wave merge:** `bun run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/Auth/__contracts__/auth.contract.test.ts` -- covers AUTH-01, AUTH-02, AUTH-03
- [ ] `src/features/Premiere/__contracts__/premiere.contract.test.ts` -- covers PREM-01, PREM-02, PREM-03
- [ ] `src/features/Trello/__contracts__/trello.contract.test.ts` -- covers TREL-01, TREL-02, TREL-03

No framework install needed -- Vitest and Testing Library already configured.

## Sources

### Primary (HIGH confidence)
- Project source code: direct file reads of all Auth (6 files), Trello (21+ files), Premiere (2 files)
- Phase 2 contract tests: `src/shared/*/___contracts__/*.contract.test.ts` (8 files examined)
- ESLint boundary config: `eslint.config.js` (boundaries plugin configuration verified)
- CONTEXT.md: locked decisions from discussion phase
- tsconfig.json: `@features/*` and `@shared/*` path aliases verified

### Secondary (MEDIUM confidence)
- Phase 2 STATE.md decisions: bulk import update strategy, no-barrel-in-ui convention

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in project, no new dependencies
- Architecture: HIGH -- Phase 2 established identical patterns for shared modules; feature modules follow same structure
- Pitfalls: HIGH -- all identified from direct code examination of actual import graphs and I/O call sites
- API layer design: HIGH -- complete inventory of all invoke/fetch/file-plugin calls across all three modules

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- structural refactor patterns, no external API changes)
