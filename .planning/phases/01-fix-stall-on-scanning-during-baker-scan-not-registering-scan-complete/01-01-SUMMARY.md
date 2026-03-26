---
phase: 01-fix-stall-on-scanning-during-baker-scan-not-registering-scan-complete
plan: 01
subsystem: ui
tags: [react, hooks, useRef, race-condition, tauri, event-listeners]

# Dependency graph
requires: []
provides:
  - "Fixed useBakerScan hook with mount-once listener pattern"
  - "scanStartTime field for elapsed timer UX"
  - "Contract tests for race condition, error path, no-bypass, timestamps, concurrency"
affects: [01-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["mount-once event listener pattern with useRef for ID filtering"]

key-files:
  created: []
  modified:
    - src/features/Baker/hooks/useBakerScan.ts
    - src/features/Baker/types.ts
    - src/features/Baker/__contracts__/baker.contract.test.ts

key-decisions:
  - "Used useRef for scanId instead of useState to avoid listener teardown gaps"
  - "Mount-once pattern (empty dependency array) eliminates race condition root cause"
  - "scanStartTime is frontend epoch ms (Date.now()), distinct from backend ISO timestamp"

patterns-established:
  - "Mount-once listeners: attach Tauri event listeners on mount, filter by ref inside handlers"

requirements-completed: [RACE-01, ERROR-01, NOBYPASS-01, TIMER-01]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 01 Plan 01: Fix useBakerScan Race Condition Summary

**Mount-once event listener pattern with useRef scanId filtering, replacing useState dependency that caused listener teardown gaps losing baker_scan_complete events**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T12:52:21Z
- **Completed:** 2026-03-14T12:54:36Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Fixed race condition where useEffect dependency on `[currentScanId]` caused listener teardown/setup gaps, losing `baker_scan_complete` events and leaving UI stuck in "Scanning in progress..."
- Replaced `useState` scanId tracking with `useRef` so listeners stay mounted and filter events by ref value
- Added `scanStartTime` (epoch ms) to hook return for elapsed timer UX
- Added 6 new behavioral contract tests covering race condition regression, error path, no-bypass, timestamp tracking, and concurrent scan blocking

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing contract tests** - `d32c047` (test)
2. **Task 1 (GREEN): Fix useBakerScan mount-once pattern** - `e23331f` (feat)

_TDD task with RED (failing tests) and GREEN (implementation) commits._

## Files Created/Modified
- `src/features/Baker/types.ts` - Added `scanStartTime: number | null` to `UseBakerScanResult` interface
- `src/features/Baker/hooks/useBakerScan.ts` - Replaced `useState` scanId with `useRef`, changed useEffect to mount-once `[]`, added `scanStartTime` state
- `src/features/Baker/__contracts__/baker.contract.test.ts` - Added 6 behavioral tests in `useBakerScan - Behavior` describe block

## Decisions Made
- Used `useRef` for scanId instead of `useState` to avoid re-render-triggered listener teardown
- Set `scanIdRef.current` before state updates after `bakerStartScan` resolves, ensuring ref is ready before any async Tauri events arrive
- `cancelScan` useCallback has empty deps since it only uses `scanIdRef` (ref, not state)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hook fix is complete, ready for Plan 02 (UI elapsed timer display and scan results enhancements)
- `scanStartTime` is exposed from hook, available for UI consumption

## Self-Check: PASSED

- FOUND: src/features/Baker/hooks/useBakerScan.ts
- FOUND: src/features/Baker/types.ts
- FOUND: src/features/Baker/__contracts__/baker.contract.test.ts
- FOUND: 01-01-SUMMARY.md
- FOUND: commit d32c047 (test RED)
- FOUND: commit e23331f (feat GREEN)

---
*Phase: 01-fix-stall-on-scanning-during-baker-scan-not-registering-scan-complete*
*Completed: 2026-03-14*
