# Phase 9: App Shell & Enforcement - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Final cleanup phase completing the deep module refactor. Delivers: lazy-loaded routes with Suspense boundaries, ESLint boundary rules promoted to errors, old path aliases removed, JSDoc on all public barrel exports, and all native alert()/confirm() calls replaced. No new features — purely enforcement, documentation, and polish.

</domain>

<decisions>
## Implementation Decisions

### Lazy Route Loading
- All 13 feature routes wrapped with React.lazy() in AppRouter
- Single shared Suspense fallback wrapping all lazy routes — minimal centered spinner
- Spinner appears in content area only — sidebar and title bar remain visible during route loads
- Error boundary with retry button for failed chunk loads (network issues, etc.)

### Alert/Confirm Replacement
- 5 remaining alert() calls replaced with Sonner error toasts (red-styled, auto-dismiss)
- 2 browser confirm() calls (Trello remove card, remove video link) replaced with Radix AlertDialog (Cancel/Confirm buttons)
- ThemeImport stub alert → Sonner info toast (blue, non-disruptive)
- Baker/BuildProject api.ts confirmDialog() wrappers KEPT as Tauri native OS dialogs — already abstracted through api.ts, appropriate for file system operations

### CLAUDE.md Restructuring
- Primary emphasis: module map + dev workflows for the new @features/* and @shared/* structure
- Include ASCII dependency diagram showing feature → shared relationships
- Remove all old phase history (Phases 002-009) entirely — module structure IS the documentation now
- Add step-by-step "how to add a new feature module" workflow section
- Update all path references to reflect new aliases

### JSDoc Documentation
- One-liner purpose statement per export (brief, scannable, sufficient for AI agents)
- Apply to ALL barrel exports: components, hooks, AND types
- Cover both feature barrels (8 modules) and shared barrels (@shared/hooks, @shared/store, etc.)
- JSDoc placed on barrel re-export lines in index.ts — keeps all public API docs in one scannable file

### ESLint Boundary Promotion
- Promote all 3 boundary rules from warn to error: boundaries/element-types, boundaries/no-unknown-files, boundaries/no-unknown

### Old Path Alias Removal
- Remove all legacy aliases from tsconfig: @components/*, @hooks/*, @lib/*, @utils/*, @constants/*, @store/*, @services/*, @pages/*, @context/*, @/*
- Update all 48 remaining old-alias imports across 42 files to use @features/* or @shared/*
- Migrate @components/lib/utils (cn() utility) references to @shared equivalent

### Claude's Discretion
- Spinner component design and animation
- Error boundary retry UX details
- Exact JSDoc wording for each export
- Import update order/batching strategy
- CLAUDE.md section ordering and formatting

</decisions>

<specifics>
## Specific Ideas

- Sidebar + title bar stability during route loads is important — the app should feel like a native desktop app, not a web page reloading
- Tauri native dialogs for file operations feel right — keep the OS-native UX there
- CLAUDE.md should help AI agents navigate the codebase quickly — the ASCII module map is key

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Sonner toast: `src/shared/ui/sonner.tsx` — fully configured with theme integration, used in 9 files
- Radix AlertDialog: `src/shared/ui/alert-dialog.tsx` — complete component suite, used in 6 feature dialogs
- Radix Dialog: `src/shared/ui/dialog.tsx` — for non-destructive confirmations
- QueryErrorBoundary: Already in App.tsx provider stack — pattern for error boundaries

### Established Patterns
- Toast usage: `import { toast } from 'sonner'` then `toast.error('message')` — established in Phase 4 (useFileUpload)
- Dialog usage: Import from `@shared/ui/alert-dialog` — established in Trello, Baker, AITools modules
- Tauri dialog wrappers: `confirmDialog()` in Baker/BuildProject api.ts — wraps `@tauri-apps/plugin-dialog`
- Barrel convention: No index.ts in shared/ui/ tree (locked in Phase 2)

### Integration Points
- AppRouter.tsx: Where React.lazy() wrapping happens (lines 11-20 imports, route definitions below)
- App.tsx: Provider stack where Suspense boundary should be placed (between Router and AppRouter)
- eslint.config.js: Boundary rule severity settings (lines 94-115)
- tsconfig.json: Path alias definitions (lines 14-31)
- vite.config.ts: Uses tsconfigPaths() plugin — alias removal cascades from tsconfig

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-app-shell-enforcement*
*Context gathered: 2026-03-09*
