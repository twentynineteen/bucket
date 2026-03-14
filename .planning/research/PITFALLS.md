# Domain Pitfalls

**Domain:** TypeScript/React deep module restructuring (flat-to-modular migration)
**Project:** Bucket - Tauri desktop app
**Researched:** 2026-03-07

## Critical Pitfalls

Mistakes that cause rewrites, regressions, or force you to undo the refactor.

### Pitfall 1: Barrel Exports Create Circular Dependencies

**What goes wrong:** When you re-export everything through `index.ts` barrel files, Module A's barrel re-exports a hook that imports a type from Module B, whose barrel re-exports something that imports from Module A. The circular dependency is invisible because developers import from barrels, not from the actual source files. The app works in dev (Vite's HMR handles lazy resolution), then breaks with `undefined is not a function` in production builds or test runners.

**Why it happens:** Bucket's current `src/hooks/index.ts` already re-exports 21 hooks from a flat directory. Moving to deep modules means each feature module gets its own barrel. Cross-feature dependencies (e.g., Baker hooks using breadcrumb hooks, BuildProject using Trello hooks) will create import cycles through barrels unless carefully managed.

**Consequences:** Runtime crashes where imported values are `undefined`. Vite dev server may mask the issue because of module-level HMR, but Vitest and production builds evaluate modules differently. The app works in dev, fails in tests, ships broken.

**Prevention:**
- Separate type-only exports from runtime exports. Use `export type { ... }` in barrels -- TypeScript erases type imports at compile time, breaking the cycle.
- Never re-export from one feature barrel into another feature barrel. Cross-module imports go direct to the source file or through a shared module.
- Add `eslint-plugin-import` with `no-cycle` rule. Configure it during the first migration phase and run it in CI.
- Map the dependency graph before starting. The 80+ hooks have implicit dependencies that must be untangled: which hooks call which hooks, which hooks import which types.

**Detection:**
- `import/no-cycle` ESLint rule catches cycles at lint time
- `madge --circular` CLI tool visualizes circular dependencies
- Vitest failures where imports are `undefined` that pass in `bun run dev`
- Production build crashes that don't reproduce in dev mode

**Confidence:** HIGH -- barrel-induced circular dependencies are the single most documented failure mode for this exact migration pattern. Multiple real-world case studies confirm this.

### Pitfall 2: Deleting All Tests Creates an Unrecoverable Safety Gap

**What goes wrong:** The plan calls for deleting all existing tests and writing fresh contract tests per module. During the gap between deletion and new test completion, you have zero automated regression detection. A subtle behavioral change introduced during file moves goes unnoticed. By the time contract tests are written, the "correct" behavior they lock down is actually the broken behavior.

**Why it happens:** The existing 7 test files are sparse but they do cover some real behavior (Settings, UploadSprout, VideoLinksManager, nav-main, breadcrumbs-trello integration). Deleting them before replacements exist means flying blind during the most structurally dangerous phase.

**Consequences:** Contract tests lock down bugs as "correct behavior." You ship a refactored codebase that passes all new tests but has regressions nobody can trace because the old behavioral baselines are gone.

**Prevention:**
- Do NOT delete existing tests until the module they cover has its contract tests written and passing. Delete per-module, not globally.
- Before deleting any test file, extract the behavioral assertions it makes into a checklist. The new contract tests must cover those same behaviors.
- Keep old tests runnable (even if they use old import paths) by adding temporary path aliases during migration. A test that imports from `@hooks/useBreadcrumbsTrelloCards` should keep working until its replacement exists.
- Git tag the pre-deletion state so you can always diff against the last-known-good behavioral baseline.

**Detection:**
- Manual QA finds regressions that no test catches
- User reports of broken workflows post-refactor
- Contract tests pass but integration behavior differs from pre-refactor

**Confidence:** HIGH -- this is a well-established anti-pattern in test migration literature. The project's existing tests are sparse (7 files), but deleting them all simultaneously still removes the only automated safety net.

### Pitfall 3: Path Alias Explosion During Incremental Migration

**What goes wrong:** During migration, the same code is reachable via multiple import paths: `@hooks/useBreadcrumb`, `@/hooks/useBreadcrumb`, `@/features/Baker/hooks/useBreadcrumb`, and `../hooks/useBreadcrumb`. TypeScript resolves them all, but the bundler may treat them as different modules, causing duplicate instances in the bundle. Zustand stores imported via two different paths create two separate store instances with divergent state.

**Why it happens:** Bucket's `tsconfig.json` defines 11 path aliases (`@components/*`, `@hooks/*`, `@lib/*`, etc.) plus a catch-all `@/*`. During incremental migration, files move from `src/hooks/` to `src/features/Baker/hooks/` but consumers aren't all updated simultaneously. Both paths resolve to the file.

**Consequences:** Duplicate module instances. Two Zustand store instances means state changes in one don't reflect in the other -- components see stale data. React Query cache keys may also diverge if query key factories are duplicated across paths.

**Prevention:**
- When a file moves, update ALL consumers in the same commit. Use your IDE's "move and update imports" or `find-and-replace` across the codebase.
- Remove old path aliases as modules migrate. When all hooks leave `src/hooks/`, delete the `@hooks/*` alias from tsconfig.json. Don't leave zombie aliases.
- Add a lint rule or CI check that prevents importing from both old and new paths for the same module.
- Migrate one feature module completely before starting the next. Don't leave half-migrated modules.

**Detection:**
- React DevTools showing duplicate providers or stores
- State updates not reflecting across components that should share state
- Bundle analysis showing the same module included twice
- `Zustand` store returning different values depending on which import path a component uses

**Confidence:** HIGH -- this is specific to Bucket's 11 existing path aliases and the incremental migration strategy.

### Pitfall 4: Contract Tests That Test Structure, Not Behavior

**What goes wrong:** Contract tests end up testing "does the barrel export these 12 names" rather than "when I call `useProjectState()`, it returns `{ title, numCameras, files, setNumCameras, handleTitleChange }` with the correct types and behaviors." Structural tests pass even when the underlying behavior breaks.

**Why it happens:** The AI Hero article that inspired this refactor emphasizes "contract tests as behavioral locks." But it's much faster to write `expect(typeof BuildProjectModule.useProjectState).toBe('function')` than to actually render a component, invoke the hook, and assert on behavior. Under time pressure, teams default to the easier structural checks.

**Consequences:** Tests provide false confidence. The barrel exports the right names but a hook returns `undefined` for a field it used to provide. Tests pass, behavior is broken.

**Prevention:**
- Define "contract" as the public API's behavioral guarantees, not its export list. A contract test for `useProjectState` should render it via `renderHook`, call `handleTitleChange('test')`, and assert `title` updates.
- Write one structural test per barrel (does it export the expected names) AND behavioral tests per exported function/hook/component.
- For Tauri command wrappers (the `api.ts` layer), contract tests should mock `invoke()` and verify the correct command name and payload shape are sent.
- Review each contract test against this question: "If the implementation broke but kept the same export names, would this test catch it?" If no, it's a structural test, not a contract test.

**Detection:**
- Test suite passes but manual testing reveals broken workflows
- Tests have no `renderHook`, `render`, or behavioral assertions -- only type/existence checks
- Code coverage is high on barrel files but low on actual hook/component logic

**Confidence:** HIGH -- this distinction is well-documented in testing literature and is the most common failure mode when teams adopt "contract testing" for the first time.

## Moderate Pitfalls

### Pitfall 5: Shared Module Becomes a New God Module

**What goes wrong:** Hooks and utilities that don't clearly belong to one feature (breadcrumb management, fuzzy search, auth, theme, window state) get dumped into a `src/features/shared/` module. This module grows to contain 40+ hooks, becoming the same flat dumping ground the refactor was trying to fix -- just in a new directory.

**Prevention:**
- Split shared code into multiple small modules by domain: `src/features/shared/auth/`, `src/features/shared/theme/`, `src/features/shared/navigation/`.
- Apply the same deep module pattern (barrel + API + contracts) to each shared sub-module.
- A shared module with more than 10-15 exports is a smell. If it's bigger, it should be split.
- Ask: "If I deleted this feature, which shared code would become orphaned?" If the answer is "none," the shared code is correctly scoped.

**Detection:**
- `src/features/shared/index.ts` has 30+ re-exports
- New features keep adding to shared rather than owning their dependencies
- Circular dependencies between shared and feature modules

**Confidence:** MEDIUM -- this is a common pattern in modularization efforts but the severity depends on discipline during migration.

### Pitfall 6: Moving Files Breaks Vite HMR and Dev Experience

**What goes wrong:** Moving dozens of files between directories causes Vite's file watcher to lose track of modules. HMR stops working for moved files, requiring full page reloads. The `vite-tsconfig-paths` plugin may cache stale path resolutions after alias changes. Developer experience degrades significantly during migration.

**Prevention:**
- Restart the Vite dev server after each batch of file moves. Don't assume HMR will pick up new paths.
- Update `tsconfig.json` path aliases and restart the TypeScript language server in your editor after each module migration.
- Move files in small batches (one feature module at a time) rather than bulk-moving dozens of files.
- Clear Vite's `.vite` cache directory if path resolution behaves strangely after moves.

**Detection:**
- HMR updates stop working after file moves
- TypeScript language server shows red squiggles on valid imports
- `bun run dev:tauri` shows stale module errors

**Confidence:** MEDIUM -- Vite handles file moves reasonably well but `vite-tsconfig-paths` has documented caching issues with path changes.

### Pitfall 7: Barrel Re-exports Break React Fast Refresh

**What goes wrong:** Vite's React Fast Refresh (via `@vitejs/plugin-react`) requires that files export only React components for HMR to work. A barrel file that re-exports both components and hooks/utilities loses Fast Refresh for the entire file. Editing a component re-exported through the barrel triggers a full page reload instead of an in-place update.

**Prevention:**
- Barrel files should re-export components and non-components separately if Fast Refresh matters during development.
- Accept that barrel files will trigger full reloads during dev. This is a known limitation of React Fast Refresh with re-export files.
- During active development on a module, import directly from source files rather than through the barrel. Use barrel imports in consuming modules only.
- The ESLint `react-refresh` plugin (already configured in the project) will warn about non-component exports from component files -- but barrel files are inherently mixed.

**Detection:**
- Console message: `[vite] page reload` instead of `[vite] hmr update` when editing components
- Development feels sluggish with frequent full-page reloads
- `react-refresh` ESLint warnings on barrel files

**Confidence:** HIGH -- this is documented behavior of `@vitejs/plugin-react` and is confirmed by the project's existing ESLint config which includes `react-refresh` plugin.

### Pitfall 8: Stale Imports From Old Structure Linger Undetected

**What goes wrong:** After moving Baker hooks from `src/hooks/useBakerScan.ts` to `src/features/Baker/hooks/useBakerScan.ts`, some files still import from the old location. TypeScript doesn't error because the old path alias (`@hooks/useBakerScan`) still resolves -- the original file was moved but the alias path still matches other files in the directory. The import silently resolves to a different file or fails at runtime.

**Prevention:**
- Delete the source file from the old location after moving (don't copy). If the old `@hooks/*` alias resolves to a non-existent file, TypeScript will error immediately.
- Run `bun run build` (not just the dev server) after each module migration. Production builds are stricter about resolution.
- Use `tsc --noEmit` as a CI check -- it catches import resolution failures that the dev server masks.
- After all files leave a directory, delete the directory and remove its path alias.

**Detection:**
- `tsc --noEmit` errors that don't appear in the Vite dev server
- Runtime errors in production builds but not in dev
- `bun run build` failures after file moves

**Confidence:** HIGH -- this is a direct consequence of Bucket's 11 path aliases and the `vite-tsconfig-paths` plugin's resolution behavior.

## Minor Pitfalls

### Pitfall 9: JSDoc Documentation Written Before API Stabilizes

**What goes wrong:** The plan includes "Add JSDoc on all public API surfaces." If JSDoc is written early in the migration, the API surfaces change as subsequent modules are migrated and shared boundaries shift. Documentation goes stale within weeks.

**Prevention:**
- Write JSDoc as the last step for each module, after its contract tests pass and its public API is locked.
- Don't write JSDoc for internal (non-exported) functions -- they're implementation details that change freely.
- Keep JSDoc to type-level documentation only (parameter descriptions, return types, usage examples). Don't document implementation.

**Detection:**
- JSDoc describes parameters or return values that no longer exist
- PR reviews keep finding stale documentation

**Confidence:** MEDIUM -- standard documentation timing issue.

### Pitfall 10: Over-Aggressive Consolidation Merges Distinct Concerns

**What goes wrong:** During migration, two hooks that seem related get merged into one. For example, `useTrelloBoard` and `useTrelloBoardSearch` are combined because "they both deal with Trello boards." But they serve different consumers with different lifecycle needs. The merged hook becomes complex, harder to test, and harder to tree-shake.

**Prevention:**
- If two hooks have different consumers (different components import them), they should remain separate even if they share a domain.
- Merge only when hooks share both domain AND consumers AND lifecycle.
- The goal is module boundaries, not fewer files. A module with 8 focused hooks is better than one with 3 god-hooks.

**Detection:**
- Hook parameter counts increasing after consolidation
- Hooks returning values that some consumers ignore
- Complexity warnings from ESLint (`complexity > 15`)

**Confidence:** MEDIUM -- specific to Bucket's 80+ hooks which will create pressure to "simplify" by merging.

### Pitfall 11: XState Machine Migration Breaks Step Workflows

**What goes wrong:** BuildProject uses XState for multi-step workflow orchestration (`useBuildProjectMachine`). Moving the machine, its hook, and the step components into a deep module may break the event/context wiring if the machine definition and its consumers end up in different module scopes or get duplicated by the bundler.

**Prevention:**
- Keep the XState machine definition, its hook wrapper, and all step components in the same feature module.
- The machine is an implementation detail of BuildProject -- it should NOT be exported through the barrel.
- Contract tests for BuildProject should test the workflow transitions (idle -> configuring -> creating -> success) through the public hook interface, not by importing the machine directly.

**Detection:**
- State transitions stop working after migration
- XState devtools show the machine but events don't trigger transitions
- Step components render but can't advance the workflow

**Confidence:** MEDIUM -- specific to this project's XState usage in BuildProject.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Shared modules first | Pitfall 5 (god module) | Split shared into sub-modules by domain from the start |
| BuildProject module | Pitfall 11 (XState breakage) | Keep machine + hook + steps in same module, test transitions |
| Baker module | Pitfall 1 (circular deps with breadcrumbs) | Baker heavily depends on breadcrumb hooks -- map dependency graph first |
| Path alias cleanup | Pitfall 3 (dual import paths), Pitfall 8 (stale imports) | Delete old files on move, remove aliases as directories empty |
| Barrel export creation | Pitfall 1 (circular deps), Pitfall 7 (Fast Refresh) | Separate type exports, accept dev reload cost |
| Test deletion | Pitfall 2 (safety gap) | Delete per-module AFTER contract tests exist, not globally upfront |
| Contract test writing | Pitfall 4 (structural not behavioral) | Require renderHook/render in every test, not just export checks |
| Documentation phase | Pitfall 9 (premature JSDoc) | Write JSDoc last, after API is locked by contract tests |
| Hook consolidation | Pitfall 10 (over-merging) | Keep hooks separate if they have different consumers |
| AI Tools module | Pitfall 1 (circular deps with embeddings/RAG) | Embedding hooks depend on AI provider hooks -- clean layering needed |

## Codebase-Specific Risk Areas

These are pitfalls unique to Bucket's current state, not general advice:

### The `.refactored` File Problem
Two hooks (`useCreateProject.refactored.ts`, `useUploadTrello.refactored.ts`) exist alongside their originals. During migration, you must determine which version is canonical BEFORE moving either into a deep module. Moving the wrong one locks in the wrong behavior through contract tests.

**Action:** Check which version is actually imported by components. Delete the unused one. Do this in a prep phase before any module migration.

### The 27 `alert()` Calls
Native `alert()` calls are scattered across Settings (13), Baker (3), and various hooks. If these files move into deep modules without fixing the alerts, the contract tests will need to either mock `window.alert` or test with it. Neither is good.

**Action:** Replace `alert()` with `toast` calls as part of each module's migration, not as a separate cleanup phase. This prevents encoding bad UX into contract tests.

### Settings Monolith (523 lines)
The Settings page handles 5 different concerns (AI models, appearance, backgrounds, SproutVideo, Trello). It must be decomposed before or during module migration. If it stays monolithic, it becomes an obstacle to clean module boundaries because it imports from every feature domain.

**Action:** Decompose Settings into sub-components during the Upload/Integrations module phase. Each settings section should live in its feature module and be composed in a thin Settings shell.

## Sources

- [Taming Circular Dependencies in TypeScript](https://medium.com/inkitt-tech/taming-circular-dependencies-in-typescript-d63df1ec8c80) - Barrel-specific circular dependency patterns
- [How to Fix Circular Dependencies Once and For All](https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de) - Type-only export separation strategy
- [Barrel Files and Why You Should Stop Using Them](https://dev.to/tassiofront/barrel-files-and-why-you-should-stop-using-them-now-bc4) - Performance and tree-shaking issues
- [The Barrel Trap](https://dev.to/elmay/the-barrel-trap-how-i-learned-to-stop-re-exporting-and-love-explicit-imports-3872) - Real-world barrel migration failures
- [The Index.ts Dilemma](https://krishnavadlamudi44.medium.com/the-index-ts-dilemma-balancing-convenience-and-performance-in-typescript-projects-85e9dd4fc18f) - Performance tradeoffs of barrel files
- [Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html) - Martin Fowler on React module patterns
- [Frontend Migration Guide](https://frontendmastery.com/posts/frontend-migration-guide/) - Incremental migration anti-patterns
- [How Teams Incrementally Modernize Large Frontend Codebases](https://altersquare.io/how-teams-incrementally-modernize-large-frontend-codebases/) - Dual maintenance and pattern replication risks
- [Contract Testing in the Frontend](https://matthias-kainer.de/blog/posts/contract-testing-in-the-frontend/) - Frontend contract test patterns

---

*Pitfalls audit: 2026-03-07*
