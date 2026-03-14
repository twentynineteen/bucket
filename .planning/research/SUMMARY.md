# Project Research Summary

**Project:** Bucket Deep Module Refactor
**Domain:** TypeScript/React deep module restructuring (flat-to-modular migration) for a Tauri desktop app
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

Bucket's frontend has outgrown its flat directory structure. With 80+ hooks in a single directory, pages split across `pages/`, `components/`, and `hooks/`, and no enforced module boundaries, the codebase resists both human navigation and AI-agent comprehension. The research unanimously recommends a deep module architecture: colocate each feature's components, hooks, types, and API layer under `src/features/`, expose a single barrel `index.ts` as the public interface, and enforce boundaries with `eslint-plugin-boundaries`. This is a well-established pattern with strong community consensus and aligns with the AI Hero "deep modules" philosophy that inspired the project.

The recommended approach is an incremental, dependency-ordered migration: shared infrastructure first, then leaf features (Auth, Trello, Premiere), then features with cross-cutting dependencies (Upload, Baker, BuildProject), and the app shell last. Each feature gets moved as a single PR with its own barrel exports, API layer wrapping Tauri `invoke()` calls, and contract tests that validate behavior through the public interface. No new frameworks are needed -- the entire tooling addition is three dev dependencies (`eslint-plugin-boundaries`, `knip`, `dependency-cruiser`) layered onto the existing ESLint and Vitest setup.

The primary risks are barrel-induced circular dependencies (the most documented failure mode for this migration pattern), losing regression coverage by deleting existing tests before replacements exist, and duplicate module instances from stale path aliases during migration. All three are preventable with disciplined execution: map the dependency graph before starting, delete tests per-module only after contract tests pass, and remove old path aliases as directories empty. The barrel file strategy is specifically calibrated -- one barrel per feature module, no barrels inside features, no barrel for UI primitives, explicit named exports only.

## Key Findings

### Recommended Stack

No framework changes required. The stack additions are purely dev-time enforcement tools on top of existing ESLint and Vitest. See [STACK.md](STACK.md) for full details.

**Core technologies:**
- `eslint-plugin-boundaries` 5.4.0: Lint-time module boundary enforcement -- the 3 critical rules are `entry-point` (force barrel imports), `element-types` (control cross-module deps), and `no-private` (prevent reaching into internals)
- `knip` 5.85.x: Dead code detection during refactor -- finds orphaned files, unused exports, and stale dependencies as modules get reorganized
- `dependency-cruiser` 17.3.x: Ad-hoc dependency graph visualization -- use during planning and post-migration validation, not in CI
- Contract tests via Vitest (existing): Testing pattern, not a library -- `__contracts__/` directories validate public API surfaces

### Expected Features

See [FEATURES.md](FEATURES.md) for full analysis including anti-features.

**Must have (table stakes):**
- Feature-colocated directory structure (files that change together live together)
- Single barrel `index.ts` per module with explicit named exports (no `export *`)
- API layer per module wrapping all Tauri `invoke()` calls (decouples UI from IPC transport)
- Types colocated with owning module (no more split type files)
- Contract tests per module (import only from `index.ts`, test as black box)
- Lint-enforced internal file privacy (convention alone erodes within weeks)
- Hook colocation (most of the 80+ hooks belong to exactly one feature)
- Incremental migration path (old import paths keep working during transition)

**Should have (differentiators -- AI-agent optimization):**
- JSDoc on every public export (AI agents read JSDoc for module capabilities)
- Module header comments in each `index.ts` (3-5 lines explaining responsibility)
- Thin barrel files containing only re-exports (critical for Vite HMR)
- Query key colocation (feature owns its cache keys)
- State machine and Zustand store colocation
- Path alias per feature module (`@features/Baker`)

**Defer (never do):**
- Nested barrel files (barrels importing barrels -- kills Vite HMR, creates circular deps)
- `export *` in barrels (defeats encapsulation, breaks tree-shaking)
- Barrel for `components/ui/` primitives (import leaf nodes directly)
- Deep nesting beyond 2-3 levels inside features
- Abstract "clean architecture" layers (`domain/`, `infrastructure/`, `presentation/`)

### Architecture Approach

The target architecture has three layers: `src/features/` (8 deep modules), `src/shared/` (cross-cutting infrastructure split into sub-modules), and `src/app/` (routing, layout, providers). Each feature module follows an identical internal structure: `index.ts` (barrel), `api.ts` (Tauri IPC + TanStack Query), `types.ts`, `components/`, `hooks/`, `__contracts__/`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full directory structure, hook-to-feature mapping, and data flow diagrams.

**Major components:**
1. `features/BuildProject` -- File ingest, camera assignment, project creation (14 hooks, most complex)
2. `features/Baker` -- Drive scanning, breadcrumbs batch management (7 hooks, depends on Trello)
3. `features/AITools` -- Script formatting via RAG, example embeddings (14 hooks across sub-features, self-contained)
4. `features/Trello` -- Board/card integration (11 hooks, consumed by Baker AND Upload -- must be its own module)
5. `features/Upload` -- Sprout Video, Posterframe, Otter (6 hooks across sub-features)
6. `features/Auth` -- Login, register, auth state (2 hooks, minimal deps)
7. `features/Settings` -- API keys, themes, connected apps (2 hooks, imports from everywhere)
8. `features/Premiere` -- Plugin management, template operations (consumed by BuildProject)
9. `shared/` -- UI primitives, cross-cutting hooks (9), global stores, query infrastructure, constants

**Key architectural decisions:**
- Trello is its own feature module, not split across Baker/Upload/BuildProject
- `useAppStore` stays in `shared/store/` during migration -- store decomposition is a follow-up
- The dependency graph is acyclic: shared <- Auth, Trello, Premiere <- Upload, Settings, AITools <- Baker, BuildProject <- app

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 11 pitfalls with detection strategies.

1. **Barrel-induced circular dependencies** -- Use `export type {}` for type-only exports, add `import/no-cycle` ESLint rule, map dependency graph before starting. This is the #1 documented failure mode.
2. **Test deletion safety gap** -- Delete existing tests per-module ONLY after contract tests for that module pass. Extract behavioral assertions from old tests before deleting. Git tag pre-deletion state.
3. **Path alias duplicate instances** -- When a file moves, update ALL consumers in the same commit. Remove old path aliases as directories empty. Two import paths to the same Zustand store = two store instances = divergent state.
4. **Contract tests that test structure, not behavior** -- Require `renderHook`/`render` in every contract test, not just `expect(typeof X).toBe('function')`. Review question: "If the implementation broke but kept export names, would this test catch it?"
5. **Shared module becomes god module** -- Split `shared/` into sub-modules by domain from the start (hooks, store, lib, ui, services). Cap at 10-15 exports per sub-module.

**Codebase-specific risks:**
- Two `.refactored` files exist alongside originals -- determine canonical version BEFORE migration
- 27 `alert()` calls should be replaced with toasts during each module's migration, not deferred
- Settings page (523 lines) must be decomposed into per-feature settings sections

## Implications for Roadmap

Based on combined research, the migration should follow dependency order across 6 phases. Each phase is a set of PRs that can be reviewed and merged independently.

### Phase 1: Tooling and Prep
**Rationale:** Install enforcement tools and clean up known blockers before moving any code. The `.refactored` file ambiguity and stale code must be resolved first.
**Delivers:** `eslint-plugin-boundaries` configured (warn mode initially), `knip` baseline audit, dependency graph visualization of current state, `.refactored` files resolved, path aliases for `@features/*` and `@shared/*` added to tsconfig/vite
**Addresses:** Incremental migration path, lint enforcement setup
**Avoids:** Pitfall 3 (path alias explosion -- establish new aliases before migration), Pitfall 8 (stale imports -- baseline audit catches pre-existing issues)

### Phase 2: Shared Infrastructure
**Rationale:** Every feature depends on shared code. Moving shared first establishes the foundation and validates the barrel export pattern on low-risk code.
**Delivers:** `src/shared/` with sub-modules: `ui/`, `hooks/`, `store/`, `lib/`, `services/`, `utils/`, `types/`, `constants/` -- each with barrel exports
**Addresses:** Shared module for cross-cutting code, hook colocation (9 truly shared hooks)
**Avoids:** Pitfall 5 (god module -- split into sub-modules from day one), Pitfall 6 (Vite HMR -- small batch moves with dev server restarts)

### Phase 3: Leaf Feature Modules
**Rationale:** Auth, Trello, and Premiere have no cross-feature consumers that haven't been migrated yet. They must exist before their consumers (Baker, Upload, BuildProject) migrate.
**Delivers:** `features/Auth`, `features/Trello`, `features/Premiere` -- each with barrel, API layer, types, contract tests
**Addresses:** API layer per module, barrel exports, contract tests, Trello as standalone module
**Avoids:** Pitfall 1 (circular deps -- leaf modules have minimal cross-feature imports), Pitfall 2 (test safety gap -- old tests kept until contract tests pass), Pitfall 4 (structural tests -- behavioral contract tests from the start)

### Phase 4: Mid-Tier Feature Modules
**Rationale:** Upload, Settings, and AITools depend on shared and leaf features but not on each other. Can be migrated in parallel.
**Delivers:** `features/Upload` (Sprout, Posterframe, Otter sub-features), `features/Settings` (decomposed from 523-line monolith), `features/AITools` (ScriptFormatter, ExampleEmbeddings sub-features)
**Addresses:** Settings decomposition, AI tools colocation, upload workflow consolidation
**Avoids:** Pitfall 10 (over-merging hooks -- keep Upload sub-features with distinct hooks), Pitfall 5 (Settings monolith must be decomposed, not just moved)

### Phase 5: Complex Feature Modules
**Rationale:** Baker (depends on Trello) and BuildProject (depends on Premiere, most hooks, XState machine) are the highest-risk migrations. Do them last when the pattern is proven.
**Delivers:** `features/Baker` (7 hooks + breadcrumbs integration), `features/BuildProject` (14 hooks + XState machine + Premiere integration)
**Addresses:** Hook colocation for the two largest features, XState machine colocation, query key colocation
**Avoids:** Pitfall 1 (Baker-breadcrumbs circular deps -- dependency graph mapped in Phase 1), Pitfall 11 (XState breakage -- keep machine + hook + steps in same module), Pitfall 2 (test gap -- existing Baker/BuildProject tests kept until contracts pass)

### Phase 6: App Shell and Enforcement
**Rationale:** After all features are migrated, wire up the app shell with lazy route loading, promote `eslint-plugin-boundaries` from warn to error, remove old path aliases, run final `knip` audit, and write JSDoc on all public exports.
**Delivers:** `src/app/` with lazy routes, boundary rules in error mode, dead old aliases removed, JSDoc on public API, module header comments
**Addresses:** Lazy route loading, JSDoc documentation, lint enforcement promotion, dead code cleanup
**Avoids:** Pitfall 9 (premature JSDoc -- written last after API is locked), Pitfall 3 (stale aliases -- old aliases deleted), Pitfall 7 (Fast Refresh -- accepted tradeoff, documented)

### Phase Ordering Rationale

- **Dependency-driven:** Each phase only depends on the previous phase. Shared must exist before features. Leaf features must exist before their consumers. App shell wires everything together last.
- **Risk escalation:** Start with the lowest-risk migrations (shared utilities, Auth) to validate the pattern before tackling the highest-risk modules (BuildProject with 14 hooks and XState).
- **Safety-first:** Existing tests are preserved until per-module replacements exist. Boundary enforcement starts in warn mode and promotes to error only after all migrations complete.
- **Barrel strategy validated early:** Phase 2 (shared) proves the barrel pattern works with Vite before applying it to complex feature modules.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Baker + BuildProject):** Baker's breadcrumb hook dependency graph is complex. BuildProject's XState machine migration needs careful analysis of event/context wiring. Run `dependency-cruiser` on both before starting.
- **Phase 4 (Settings decomposition):** The 523-line Settings monolith imports from every domain. Decomposition strategy needs per-feature settings component design.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Tooling):** Well-documented tool installation, config examples in STACK.md
- **Phase 2 (Shared):** Standard barrel export pattern, low risk
- **Phase 3 (Leaf features):** Auth and Premiere are small and self-contained. Trello is well-bounded.
- **Phase 6 (App shell):** React.lazy() routing is standard React pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools verified against official docs. `eslint-plugin-boundaries` flat config support confirmed. `knip` Vite/Vitest plugins confirmed. No novel or experimental dependencies. |
| Features | HIGH | Feature list derived from established patterns (AI Hero deep modules, Feature-Sliced Design, Vite performance docs). Anti-features backed by real-world case studies (Atlassian barrel file removal). |
| Architecture | HIGH | Target structure derived from direct codebase analysis (80+ hooks mapped to features) combined with established React modularization patterns. Hook-to-feature mapping is the most detailed and valuable artifact. |
| Pitfalls | HIGH | All critical pitfalls documented in multiple independent sources. Codebase-specific risks (`.refactored` files, `alert()` calls, Settings monolith) identified through direct inspection. |

**Overall confidence:** HIGH

### Gaps to Address

- **Hook ownership for 14 "unclear" hooks:** The ARCHITECTURE.md identifies hooks like `useAppendBreadcrumbs`, `useBreadcrumbsVideoLinks`, and `useVideoLinksManager` whose feature ownership is ambiguous. Decision: assign based on primary consumer, re-evaluate if multiple features equally depend on them.
- **`useAppStore` decomposition timing:** Research recommends deferring store decomposition to after structural migration. This means the Zustand god store persists through the entire refactor. Validate that this doesn't create testing problems for contract tests that need to mock store state.
- **Vite barrel performance impact:** The barrel strategy (one per feature, no nesting, explicit exports) should avoid the Vite HMR penalty documented by Atlassian and TKDodo. Validate with real dev server performance after Phase 2.
- **Cross-feature query invalidation:** Moving query keys into feature modules raises the question of how Baker invalidates Trello's cache. The shared `lib/query-keys.ts` can serve as a re-export aggregator, but the pattern needs validation during Phase 3.

## Sources

### Primary (HIGH confidence)
- [AI Hero: How to Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love) -- Deep module philosophy, contract tests, barrel export pattern
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) -- v5.4.0, entry-point/element-types/no-private rules
- [Knip](https://knip.dev/) -- v5.85.x, dead code detection with Vite/Vitest plugins
- [Vite Performance Guide](https://vite.dev/guide/performance) -- Official barrel file warning
- Current codebase analysis -- 80+ hooks mapped, 11 path aliases documented, dependency graph traced

### Secondary (MEDIUM confidence)
- [Please Stop Using Barrel Files (TKDodo)](https://tkdodo.eu/blog/please-stop-using-barrel-files) -- Nuanced anti-barrel argument with library entry point exception
- [How We Achieved 75% Faster Builds by Removing Barrel Files (Atlassian)](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) -- Real-world performance data
- [Feature-Sliced Design](https://feature-sliced.design/) -- Layered architecture methodology
- [Modularizing React Applications (Martin Fowler)](https://martinfowler.com/articles/modularizing-react-apps.html) -- React module patterns
- [Frontend Migration Guide](https://frontendmastery.com/posts/frontend-migration-guide/) -- Incremental migration anti-patterns
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) -- v17.3.x, dependency graph validation

### Tertiary (LOW confidence)
- [React Architecture Patterns 2026](https://www.bacancytechnology.com/blog/react-architecture-patterns-and-best-practices) -- General overview of current trends

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
