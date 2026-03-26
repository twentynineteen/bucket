# Feature Landscape

**Domain:** Deep module refactoring of a Tauri desktop app (React/TypeScript frontend)
**Researched:** 2026-03-07

## Table Stakes

Features users (developers and AI agents) expect from a deep module refactoring. Missing any of these means the refactor is cosmetic, not structural.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Feature-colocated directory structure | Files that change together live together. Eliminates the "scavenger hunt" across pages/, components/, hooks/ for one feature. | Medium | Move from `src/pages/Baker/ + src/components/Baker/ + src/hooks/useBaker*.ts` to `src/features/Baker/**` |
| Single public entry point per module | Every module has ONE file that defines its public API. Consumers never reach into internals. | Low | Use `index.ts` as the module's public surface. Keep it to explicit named re-exports only -- no `export *`. |
| Explicit named exports (not wildcard) | Wildcard `export *` defeats the purpose of a public interface -- consumers can't tell what's intentional API vs. leaked internal. Also breaks tree-shaking. | Low | `export { BakerPage } from './BakerPage'` not `export * from './BakerPage'` |
| API layer separating Tauri IPC from UI | Components should never call `invoke()` directly. An `api.ts` file per module wraps all Tauri commands into typed async functions. | Medium | This is the biggest boundary win -- it decouples the frontend from the IPC transport. Enables testing without Tauri mocks. |
| Types colocated with module | Each module owns its TypeScript types. Shared types live in a shared module. No more `src/types/baker.ts` + `src/utils/types.ts` split. | Low | Internal types stay private. Only types needed by consumers get re-exported from `index.ts`. |
| Contract tests per module | Tests that validate the public interface works correctly. They import ONLY from `index.ts` and test the module as a black box. | Medium | Use Vitest. Tests exercise the public API, mock the Tauri layer at the `api.ts` boundary. If a test needs to import an internal file, the module boundary is wrong. |
| Internal file privacy convention | Internals must not be imported from outside the module. Without this, the barrel export is decoration. | Medium | Enforce via `eslint-plugin-boundaries` or ESLint `no-restricted-imports`. Convention alone fails over time. |
| Hook colocation | Hooks belong to the feature that uses them, not a global `hooks/` folder. Only truly shared hooks (e.g., `useBreadcrumb`, `useMediaQuery`) stay in `src/shared/hooks/`. | Medium | The 80+ hooks in a flat directory is the #1 navigation problem. Most hooks are used by exactly one feature. |
| Shared module for cross-cutting code | UI primitives (`components/ui/`), global stores, query infrastructure, services -- these need their own module(s) with the same barrel + API pattern. | Medium | Prevents the "everything is shared" anti-pattern where shared/ becomes a dumping ground. Keep it narrow. |
| Incremental migration path | Ability to migrate one feature at a time without breaking others. Old import paths must keep working during migration. | Low | Use TypeScript path aliases. `@features/Baker` points to new location. Old `@pages/Baker` can re-export temporarily. |

## Differentiators

Features that elevate the refactoring from "well-organized" to "AI-agent optimized" -- the codebase becomes self-documenting and navigable by automated tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| JSDoc on every public export | AI agents read JSDoc to understand module capabilities without reading implementation. Progressive disclosure: the barrel tells you WHAT, JSDoc tells you WHY, internals tell you HOW. | Medium | Use TSDoc-style (`@param`, `@returns`, `@example`). Skip type annotations in JSDoc (TypeScript already has them). Focus on purpose and usage context. |
| Module README or header comment | A 3-5 line comment at the top of each `index.ts` explaining the module's responsibility, boundaries, and key exports. AI agents read this first. | Low | Not a separate file -- a comment block in `index.ts`. Keeps it colocated and always up to date. |
| Thin barrel files (re-exports only) | Barrel files that contain ZERO logic -- only `export { X } from './Y'` statements. This is critical for Vite HMR performance. Vite's official docs warn against barrel files that contain any non-re-export code. | Low | The `api.ts` layer handles logic. The `index.ts` handles surface area. Never mix them. |
| Query key colocation | Move query keys from the global `src/lib/query-keys.ts` factory into each feature module's `api.ts` or `queries.ts`. Feature owns its cache keys. | Low | Keep a thin shared `queryKeys` namespace for cross-feature invalidation patterns, but the key definitions live with the feature. |
| State machine colocation | Move `buildProjectMachine.ts` into the BuildProject feature module. The machine IS the feature's core logic -- it shouldn't live in a separate `machines/` directory. | Low | Only BuildProject uses XState currently. If more features adopt it, each owns its machine. |
| Zustand store scoping | Feature-specific store slices colocated with the feature. Only the global app store (`useAppStore`) stays shared. | Low | Baker doesn't need BuildProject's state. Scoped stores reduce cognitive load and prevent accidental coupling. |
| Contract test as living documentation | Tests double as usage examples. Each contract test file shows how to import from the module, what functions are available, and expected behavior. | Medium | Name tests descriptively: `it('exports BakerPage component for routing')`, `it('scanDrive returns project folders with breadcrumbs status')`. |
| Lint rule enforcement of boundaries | `eslint-plugin-boundaries` configured to error on cross-module internal imports. Without lint enforcement, conventions erode within weeks. | Medium | Configure element types for `features/*`, `shared/*`. Rule: features can import from shared and from other features' `index.ts` only. |
| Path alias per feature module | `@features/Baker` resolves to `src/features/Baker/index.ts`. Clean imports, easy to find, grep-friendly. | Low | Add to `tsconfig.json` paths and `vite.config.ts` resolve aliases. |

## Anti-Features

Things to deliberately NOT do during this refactoring. Each is tempting but counterproductive.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Nested barrel files (barrels importing barrels) | Creates circular dependency chains, exponentially inflates module graph, murders Vite HMR performance. Atlassian saw 75% build time reduction by removing nested barrels. | One barrel per feature module. No barrel inside `components/` inside a feature -- just direct imports internally. |
| `export *` in barrel files | Leaks every internal as "public API." Defeats the entire purpose of the refactoring. Breaks tree-shaking. Makes it impossible to know what's intentional API. | Explicit named exports only. If it's not in `index.ts` by name, it's private. |
| Barrel files for `components/ui/` primitives | UI primitives are leaf nodes imported individually. A barrel file for 30+ UI components forces loading ALL of them when you need one Button. TKDodo, Vite docs, and Atlassian all warn against this. | Import directly: `import { Button } from '@components/ui/button'`. No barrel for UI primitives. |
| Deep nesting (more than 2-3 levels) | Feature modules should be flat-ish internally. Deep nesting (`features/Baker/components/panels/left/items/`) defeats navigation. | Max 2 levels inside a feature: `features/Baker/components/ScanResults.tsx`, not deeper. |
| Abstract "layers" or "clean architecture" folders | Don't create `domain/`, `infrastructure/`, `presentation/` folders inside each feature. This is a desktop app, not a microservice. Over-abstraction adds navigation cost with no benefit. | Keep it simple: `index.ts`, `api.ts`, `types.ts`, `components/`, `hooks/`, `__contracts__/`. |
| Moving EVERYTHING at once (big bang migration) | High risk, impossible to review, guaranteed to introduce regressions. One bad merge conflicts with weeks of parallel work. | Feature-by-feature migration. Each feature module is a single PR. Old code keeps working until migrated. |
| Re-exporting Tauri commands directly | `export { invoke } from '@tauri-apps/api/core'` in a feature barrel defeats the API layer boundary. External dependencies should be wrapped. | Wrap in `api.ts`: `export async function scanDrive(path: string): Promise<ScanResult[]> { return invoke('baker_start_scan', { path }) }` |
| Creating a shared module for "everything that's used twice" | The shared module becomes a junk drawer. Two features using the same utility doesn't make it shared infrastructure. | A utility is "shared" only if 3+ features use it AND it has no feature-specific logic. Be aggressive about keeping things feature-local. |
| Deleting and rewriting tests simultaneously with restructuring | Mixing structural changes with test rewrites makes it impossible to verify nothing broke. You can't trust new tests to catch regressions in code you just moved. | Phase 1: Move files, update imports, verify existing tests still pass. Phase 2: Delete old tests, write contract tests. Separate PRs. |
| Over-documenting internals | JSDoc on every private helper function adds noise without value. AI agents don't need documentation on internal implementation details. | JSDoc on public exports only. Internal code should be self-documenting through good naming. |

## Feature Dependencies

```
Feature colocation ──> Barrel exports (need the structure before defining the public surface)
Barrel exports ──> API layer (barrel re-exports the API layer's public functions)
API layer ──> Contract tests (tests exercise the API, mock at the invoke boundary)
Barrel exports ──> Lint enforcement (need barrels to exist before enforcing boundaries)
Lint enforcement ──> JSDoc (document what the linter protects)
Incremental migration ──> All other features (migration path must exist before moving code)

Independent (can happen in any order):
- Query key colocation
- State machine colocation
- Zustand store scoping
- Path aliases
```

## MVP Recommendation

**Phase 1 -- Foundation (do first, enables everything else):**
1. Feature-colocated directory structure -- move files into `src/features/`
2. Barrel exports with explicit named re-exports -- define public surfaces
3. API layer per module -- wrap all `invoke()` calls
4. Path aliases -- `@features/*` in tsconfig
5. Incremental migration path -- old imports temporarily re-export from new locations

**Phase 2 -- Enforcement (lock down boundaries):**
1. `eslint-plugin-boundaries` configuration
2. Internal file privacy convention enforced by lint
3. Contract tests per module (importing only from `index.ts`)

**Phase 3 -- Polish (AI-agent optimization):**
1. JSDoc on public exports
2. Module header comments
3. Query key colocation
4. State machine and store colocation

**Defer:**
- Nested barrel files: Never do this
- Abstract layer folders: Never do this
- UI primitive barrel: Never do this

## Barrel File Strategy: The Critical Nuance

This deserves special attention because the AI Hero article recommends barrel files while Vite's official documentation, TKDodo, and Atlassian all warn against them.

**The resolution:** Barrel files are appropriate at the MODULE boundary (one `index.ts` per feature) but harmful WITHIN modules and for leaf-node libraries (UI primitives). The key constraint is:

1. **ONE barrel per feature module** -- `src/features/Baker/index.ts`
2. **No barrels inside features** -- internal files import each other directly
3. **No barrel for `components/ui/`** -- import primitives directly
4. **Barrels contain ONLY re-exports** -- zero logic, zero side effects
5. **Explicit named exports** -- never `export *`

This gives you the deep module benefit (simple public interface) without the Vite performance penalty (barrel files that inflate the module graph).

**Confidence: HIGH** -- This reconciles the conflicting advice. Module-boundary barrels are the one case where even barrel-file critics agree they're appropriate (TKDodo explicitly exempts library entry points, and a feature module IS a library to its consumers).

## Sources

- [How To Make Codebases AI Agents Love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love~npyke) -- Deep module philosophy, AI-agent optimization
- [Vite Performance Guide](https://vite.dev/guide/performance) -- Official Vite warning against barrel files
- [Please Stop Using Barrel Files (TKDodo)](https://tkdodo.eu/blog/please-stop-using-barrel-files) -- Nuanced anti-barrel argument with library exception
- [How We Achieved 75% Faster Builds by Removing Barrel Files (Atlassian)](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) -- Real-world performance data
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) -- Lint enforcement of module boundaries
- [Scalable React Projects with Feature-Based Architecture](https://dev.to/naserrasouli/scalable-react-projects-with-feature-based-architecture-117c) -- Feature colocation patterns
- [Modularizing React Applications (Martin Fowler)](https://martinfowler.com/articles/modularizing-react-apps.html) -- Established UI patterns for modular React
- [TSDoc](https://tsdoc.org/) -- Documentation standard for TypeScript
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) -- Official JSDoc support in TypeScript
