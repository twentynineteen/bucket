# Phase 1: Fix Stall on Scanning During Baker Scan - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the Baker scan stall where `baker_scan_complete` events are lost due to a race condition in listener lifecycle management. The scan starts but never registers completion, leaving the UI stuck in "Scanning in progress..." state. Scope: fix the listener pattern, add elapsed timer UX, and add contract tests. No new scan features or backend changes.

</domain>

<decisions>
## Implementation Decisions

### Fix strategy
- Mount-once listeners: attach all Tauri event listeners (`baker_scan_complete`, `baker_scan_progress`, `baker_scan_error`) once on component mount with empty dependency array
- Use a ref (`scanIdRef`) to track the current scan ID, filter events inside handlers by comparing `event.scanId === scanIdRef.current`
- Remove `currentScanId` from the useEffect dependency array entirely — no listener re-attachment
- No polling fallback — trust the mount-once pattern to reliably catch all events
- No stale scan detection — the fix eliminates the root cause

### Scan feedback UX
- Add an elapsed timer during scanning (running counter alongside folder counts)
- Show "Scanned X folders in Y seconds" in the results summary after completion
- Instant swap from progress view to results view on completion — no transition delay
- Keep existing progress display (folder counts, "Scanning in progress..." message)

### Error resilience
- On `baker_scan_error`: show error inline in the scan area (not a toast), set `isScanning=false`, display retry button
- Block concurrent scans — disable scan button while a scan is running
- Zero projects found = valid result, not an error — show "No projects found" with elapsed time

### Regression safety
- Add behavioral contract test that reproduces the original race condition: mock Tauri `listen()` to simulate events arriving before listeners are attached, verify mount-once pattern handles it
- Add behavioral contract test for error event path (`baker_scan_error` flows correctly)
- Extend Baker no-bypass contract test to verify scan hook has no direct `@tauri-apps/api/event` imports
- Test hook timestamp tracking logic (start/end times for elapsed timer) — verify hook returns correct values, don't test visual rendering

### Claude's Discretion
- Exact ref implementation pattern (useRef vs callback ref)
- Timer display formatting (mm:ss vs seconds only)
- Error state visual design within the inline error component
- Cleanup function implementation details

</decisions>

<specifics>
## Specific Ideas

- v1.0 milestone alignment: fix must maintain api.ts I/O boundary, all Tauri event listener wrappers stay in Baker's api.ts, hook only calls barrel-exported functions
- Mount-once pattern chosen specifically because it's the simplest approach that aligns with v1.0's "simple public interface" principle

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useBakerScan.ts` (src/features/Baker/hooks/): Hook that manages scan lifecycle — this is the primary file to modify
- Baker `api.ts`: Already wraps `listenScanComplete`, `listenScanProgress`, `listenScanError` as I/O boundary functions
- `ScanResults.tsx` (src/features/Baker/components/): Displays scan results — needs elapsed time addition
- Baker `__contracts__/`: Existing shape + behavioral + no-bypass tests to extend

### Established Patterns
- Tauri event listeners wrapped in api.ts returning `Promise<() => void>` unlisten functions
- Contract test structure: shape (export counts), behavioral (hook return shapes), no-bypass (grep for direct imports)
- Progress tracking pattern exists in other features (BuildProject uses ProgressTracker service)

### Integration Points
- `useBakerScan` hook is used by `BakerPage.tsx` — changes to hook API (adding elapsed time) need to flow through
- `ScanResults.tsx` receives `scanResult` prop — needs new timestamp fields for elapsed display
- Backend scan logic (`breadcrumbs.rs`, `scanning.rs`) is NOT being modified — fix is frontend-only

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-fix-stall-on-scanning-during-baker-scan-not-registering-scan-complete*
*Context gathered: 2026-03-14*
