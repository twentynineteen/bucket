# Phase 2: Shared Infrastructure - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract all cross-cutting code into `src/shared/` sub-modules (hooks, ui, store, lib, services, utils, types, constants) with barrel exports and contract tests. This phase creates the stable foundation that all feature modules (Phases 3-8) will import from. No feature module creation happens here — only shared infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Hook ownership classification
- **Rule: 2+ feature consumers = shared.** Any hook imported by more than one feature module goes to `@shared/hooks`. Single-consumer hooks stay in `src/hooks/` for their feature phase.
- **Move, don't re-export.** Physically move shared hooks to `src/shared/hooks/`. Update all imports. No backward-compat bridges.
- **Resolve all 14 ambiguous hooks now.** Use import graph analysis during research to classify every hook with unclear ownership. Force decisions upfront so feature phases have a clean foundation.
- **Tag remaining feature hooks.** Add a comment (e.g., `// Target: @features/Baker`) to each hook that stays in `src/hooks/`, indicating which feature module will claim it in Phases 3-8.
- **No invoke() in shared hooks.** Shared hooks must be pure logic/state — no direct Tauri `invoke()` calls. Hooks that currently call invoke() get split: logic part → shared, invoke part → stays for the consuming feature's `api.ts` layer. This eliminates the need for Tauri mocking in shared contract tests.

### UI primitives boundary
- **Move entire `src/components/ui/` to `src/shared/ui/`.** All Radix-based primitives are inherently shared — they're the design system. Move the whole directory.
- **Move misplaced components too.** React components currently in `src/utils/` (ApiKeyInput, FormattedDate, ExternalLink, TrelloCards) and layout components in `src/components/` (app-sidebar, TitleBar, ErrorBoundary, nav-main, nav-user, team-switcher) all go to `src/shared/ui/`.
- **Allow nested sub-directories.** Complex UI modules keep their internal structure: `shared/ui/sidebar/`, `shared/ui/theme/`, etc. Import via `@shared/ui/sidebar/Sidebar`.
- **Theme system coalesces into `shared/ui/theme/`.** All theme-related code (constants/themes.ts, utils/themeMapper.ts, utils/themeLoader.ts, hooks/useThemePreview.ts, components/theme-toggle.tsx, types/customTheme.ts) consolidates into one cohesive sub-module rather than scattering across type-based sub-modules.
- **No barrel files anywhere in `shared/ui/`.** Direct imports only: `@shared/ui/Button`, `@shared/ui/sidebar/Sidebar`, `@shared/ui/theme/ThemeSelector`. This applies to the entire ui tree including nested sub-modules.

### Barrel export scope
- **Export everything.** Every public file in a sub-module gets a named export in its barrel. Simpler to maintain — add a file, add an export.
- **Named re-exports only.** Use `export { useBreadcrumb } from './useBreadcrumb'` — no wildcard `export *`. Acts as documentation, prevents accidental internal leaking, and contract tests verify specific names.
- **Single `@shared/lib` barrel.** All 5 lib files (query-keys, query-client-config, query-utils, performance-monitor, prefetch-strategies) export through one barrel. Not worth splitting for 5 files.
- **Barrels exist for:** hooks, store, lib, services, utils, types, constants.
- **No barrels for:** ui (direct imports per roadmap requirement SHRD-02).

### Contract test depth
- **Full behavioral tests.** Contract tests verify both export shape AND behavior. Not just "barrel exports useBreadcrumb" but "useBreadcrumb returns a breadcrumbs array and updates on navigation."
- **Use renderHook from Testing Library.** Test hooks as React consumers use them — with state, effects, and re-renders. Already in the project's test stack.
- **`__contracts__/` directory per sub-module.** E.g., `src/shared/hooks/__contracts__/hooks.contract.test.ts`. Colocated with the module, consistent with feature module pattern from PROJECT.md.
- **No mocking needed for shared hooks.** Because shared hooks have no invoke() calls (pure logic/state), contract tests are straightforward with no Tauri mock infrastructure.

### Claude's Discretion
- Exact classification of each of the 87 hooks (shared vs feature-specific) based on import graph analysis
- Internal file organization within each shared sub-module
- Which utils are truly shared vs feature-specific (apply same 2+ consumer rule)
- How to handle the breadcrumbs utility barrel (src/utils/breadcrumbs/index.ts) during migration
- Services sub-module structure (AI services may be feature-specific)
- How to split hooks that currently call invoke() into logic + api parts

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **src/components/ui/**: ~20 Radix-based primitives (Button, Card, Dialog, Input, etc.) — move as-is to shared/ui
- **src/components/ui/sidebar/**: Multi-file sub-module with own hook — move as nested directory
- **src/hooks/index.ts**: Existing partial barrel exporting ~21 of 87 hooks — replace with new shared/hooks barrel
- **src/utils/breadcrumbs/index.ts**: Existing barrel for breadcrumbs utilities — may move to shared/utils
- **src/constants/index.ts**: Existing minimal barrel (timing only) — expand for shared/constants
- **src/lib/**: 5 TanStack Query infrastructure files — move as-is to shared/lib

### Established Patterns
- **Path aliases**: `@features/*` and `@shared/*` already configured in tsconfig + Vite (Phase 1)
- **ESLint boundaries**: Zones defined for @features/* and @shared/* with warning-level enforcement (Phase 1)
- **Import sorting**: Prettier plugin handles import order — new @shared imports will auto-sort
- **Vitest + Testing Library**: Already configured for testing — renderHook available

### Integration Points
- **87 hooks in src/hooks/**: Need import graph analysis to classify shared vs feature-specific
- **80+ components in src/components/**: UI primitives + layout + feature-specific all mixed
- **6 type files in src/types/**: Some shared (media.ts), some feature-specific (baker.ts, scriptFormatter.ts)
- **40+ utility files in src/utils/**: Includes misplaced React components and feature-specific utils
- **2 Zustand stores in src/store/**: useAppStore (global state), useBreadcrumbStore (nav state)
- **6 service files in src/services/**: ProgressTracker, UserFeedbackService, cache-invalidation + AI services
- **All existing imports from old paths**: Must be updated to new @shared/* paths after moves

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for module extraction and organization.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-shared-infrastructure*
*Context gathered: 2026-03-08*
