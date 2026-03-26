# Phase 1: Fix Stall on Scanning During Baker Scan - Research

**Researched:** 2026-03-14
**Domain:** React hook lifecycle + Tauri event listener race condition
**Confidence:** HIGH

## Summary

The Baker scan stall is caused by a classic React useEffect dependency race condition. The `useBakerScan` hook (line 86) has `[currentScanId]` as a dependency for the useEffect that sets up Tauri event listeners. When `startScan` calls `setCurrentScanId(scanId)` (line 101), React tears down the old listeners and creates new ones. During this teardown/setup gap, the backend `baker_scan_complete` event can fire and be lost because no listener exists yet. The fix is straightforward: mount listeners once with `[]` dependency array, and use a `useRef` for `scanId` filtering inside handlers instead of `useState`.

The ScanResult type already has `startTime` and `endTime` fields (types.ts lines 45-46), so elapsed time can be computed from these existing fields. The `ScanResults.tsx` component needs minor additions to display elapsed time. No new types are required for the timer.

**Primary recommendation:** Replace the `[currentScanId]` useEffect dependency with `[]` (mount-once), switch `currentScanId` state to a `scanIdRef` useRef, and add elapsed time display using existing `ScanResult.startTime`/`endTime` fields.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mount-once listeners: attach all Tauri event listeners (`baker_scan_complete`, `baker_scan_progress`, `baker_scan_error`) once on component mount with empty dependency array
- Use a ref (`scanIdRef`) to track the current scan ID, filter events inside handlers by comparing `event.scanId === scanIdRef.current`
- Remove `currentScanId` from the useEffect dependency array entirely -- no listener re-attachment
- No polling fallback -- trust the mount-once pattern to reliably catch all events
- No stale scan detection -- the fix eliminates the root cause
- Add an elapsed timer during scanning (running counter alongside folder counts)
- Show "Scanned X folders in Y seconds" in the results summary after completion
- Instant swap from progress view to results view on completion -- no transition delay
- Keep existing progress display (folder counts, "Scanning in progress..." message)
- On `baker_scan_error`: show error inline in the scan area (not a toast), set `isScanning=false`, display retry button
- Block concurrent scans -- disable scan button while a scan is running
- Zero projects found = valid result, not an error -- show "No projects found" with elapsed time
- Add behavioral contract test that reproduces the original race condition
- Add behavioral contract test for error event path
- Extend Baker no-bypass contract test to verify scan hook has no direct `@tauri-apps/api/event` imports
- Test hook timestamp tracking logic (start/end times for elapsed timer)

### Claude's Discretion
- Exact ref implementation pattern (useRef vs callback ref)
- Timer display formatting (mm:ss vs seconds only)
- Error state visual design within the inline error component
- Cleanup function implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3 | Component framework | Already in project |
| Vitest | 3.2.4 | Test runner | Already configured in vite.config.ts |
| @testing-library/react | (installed) | Hook testing via renderHook | Already used in contract tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | (installed) | Icons (RefreshCw, AlertTriangle) | Already used in ScanResults.tsx |
| TailwindCSS | (installed) | Styling | Already used throughout |

### Alternatives Considered
None -- all tools needed are already in the project.

## Architecture Patterns

### Pattern 1: Mount-Once Listener with Ref Filtering (THE FIX)
**What:** Attach Tauri event listeners once on mount, use `useRef` to track current scan ID, filter events inside handlers
**When to use:** Any time listeners need to correlate events with dynamic state without re-attaching
**Example:**
```typescript
// CURRENT (BROKEN) - listeners re-attach when currentScanId changes
useEffect(() => {
  // setup listeners that check currentScanId...
}, [currentScanId]) // <-- PROBLEM: teardown/setup gap loses events

// FIXED - listeners mount once, ref provides current scanId
const scanIdRef = useRef<string | null>(null)

useEffect(() => {
  const unlistenPromises: Promise<() => void>[] = []

  unlistenPromises.push(
    listenScanComplete((event) => {
      if (event.payload.scanId === scanIdRef.current) {
        setScanResult(event.payload.result)
        setIsScanning(false)
        scanIdRef.current = null
      }
    })
  )
  // ... other listeners same pattern

  return () => {
    Promise.all(unlistenPromises).then((fns) => fns.forEach((fn) => fn()))
  }
}, []) // <-- mount once, never re-attach
```

### Pattern 2: Elapsed Timer via Component-Level State
**What:** Track `scanStartTime` in the hook, compute elapsed in the component via `Date.now() - startTime` with a 1s interval
**When to use:** Displaying a running counter during async operations
**Example:**
```typescript
// In useBakerScan hook - add scanStartTime to state
const [scanStartTime, setScanStartTime] = useState<number | null>(null)

// In startScan:
setScanStartTime(Date.now())

// In completion handler:
setScanStartTime(null) // clear to stop timer

// In component - use setInterval for live counter
useEffect(() => {
  if (!scanStartTime) return
  const id = setInterval(() => setElapsed(Math.floor((Date.now() - scanStartTime) / 1000)), 1000)
  return () => clearInterval(id)
}, [scanStartTime])
```

### Pattern 3: Contract Test for Race Condition
**What:** Mock `listenScanComplete` to capture the callback, then simulate delayed event delivery
**When to use:** Proving the mount-once pattern catches events that the old pattern would miss
**Example:**
```typescript
it('handles scan_complete event arriving after scanId is set (race condition regression)', async () => {
  let capturedCompleteCallback: Function
  vi.mocked(listenScanComplete).mockImplementation(async (cb) => {
    capturedCompleteCallback = cb
    return () => {}
  })

  const { result } = renderHook(() => useBakerScan())

  await act(async () => {
    await result.current.startScan('/test', defaultOptions)
  })

  // Simulate event arriving - with mount-once, listener is still active
  act(() => {
    capturedCompleteCallback({ payload: { scanId: 'scan-id', result: mockResult } })
  })

  expect(result.current.isScanning).toBe(false)
  expect(result.current.scanResult).toEqual(mockResult)
})
```

### Anti-Patterns to Avoid
- **Re-attaching listeners on state change:** The root cause of this bug. Never put dynamic state in a listener useEffect's dependency array.
- **Using useState for values only needed inside callbacks:** scanId is only compared inside event handlers -- useRef avoids unnecessary re-renders and the dependency problem.
- **Polling as a "safety net":** Adds complexity, masks the real bug, and introduces timing issues.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Elapsed timer formatting | Manual string formatting | Simple `Math.floor(seconds / 60)` + modulo | Straightforward enough, but don't over-engineer it |
| Event listener lifecycle | Custom event bus | Tauri's built-in `listen()` with mount-once pattern | Tauri handles native event bridge correctly |

## Common Pitfalls

### Pitfall 1: Forgetting to Update scanIdRef Before Listeners Need It
**What goes wrong:** If `scanIdRef.current` is set after `bakerStartScan` resolves, but the backend fires events before the ref is updated, events are filtered out
**Why it happens:** `bakerStartScan` is async -- the backend could theoretically fire progress events before the `await` returns
**How to avoid:** Set `scanIdRef.current = scanId` immediately after `bakerStartScan` resolves, before any other state updates. The Tauri event bridge is async (events come through the webview bridge), so in practice the ref will be set before events arrive, but ordering the code correctly makes it explicit.
**Warning signs:** First progress event sometimes missed

### Pitfall 2: Cleanup Race with Async Unlisten
**What goes wrong:** The `Promise.all(unlistenPromises)` in cleanup might resolve after the component has already remounted
**Why it happens:** `listen()` returns a Promise, and cleanup is called synchronously
**How to avoid:** This is the existing pattern and works fine for mount-once (cleanup only runs on unmount). No change needed. Just don't add logic that depends on cleanup completing synchronously.
**Warning signs:** Console warnings about state updates on unmounted components

### Pitfall 3: UseBakerScanResult Type Needs Updating
**What goes wrong:** Adding `scanStartTime` to the hook return breaks the `UseBakerScanResult` interface in types.ts
**Why it happens:** The interface is explicitly defined (types.ts line 146-158) and contract tests verify its shape
**How to avoid:** Update `UseBakerScanResult` interface AND the contract test shape check simultaneously
**Warning signs:** TypeScript errors, contract test failures

### Pitfall 4: ScanResult.startTime vs Hook's scanStartTime
**What goes wrong:** Confusion between `ScanResult.startTime` (ISO string from backend, set when result arrives) and the hook's `scanStartTime` (epoch ms, set when scan starts on frontend)
**Why it happens:** Two different time concepts with similar names
**How to avoid:** The hook's `scanStartTime` is for the running timer. `ScanResult.startTime`/`endTime` are backend timestamps in the final result. For the "Scanned X folders in Y seconds" summary, compute from `ScanResult.startTime` and `ScanResult.endTime`. For the running counter, use the hook's `scanStartTime`.

## Code Examples

### Current Bug Location (useBakerScan.ts)
```typescript
// Line 86 - THIS IS THE BUG:
}, [currentScanId])
// When startScan sets currentScanId, React tears down old listeners
// and sets up new ones. During the gap, baker_scan_complete fires
// and is lost.
```

### Files to Modify
1. **`src/features/Baker/hooks/useBakerScan.ts`** -- Primary fix (mount-once + ref + scanStartTime)
2. **`src/features/Baker/types.ts`** -- Update `UseBakerScanResult` interface (add scanStartTime)
3. **`src/features/Baker/components/ScanResults.tsx`** -- Add elapsed timer display + elapsed summary
4. **`src/features/Baker/BakerPage.tsx`** -- Pass new hook fields through to ScanResults (if API changes)
5. **`src/features/Baker/__contracts__/baker.contract.test.ts`** -- Add race condition + error + no-bypass tests

### Elapsed Time Display Pattern
```typescript
// For results summary (after scan completes):
// ScanResult already has startTime and endTime as ISO strings
const elapsedSeconds = scanResult.endTime
  ? Math.round((new Date(scanResult.endTime).getTime() - new Date(scanResult.startTime).getTime()) / 1000)
  : null

// Display: "Scanned 42 folders in 3.2 seconds"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useEffect with state deps for listeners | Mount-once with useRef for filtering | React best practice since hooks introduction | Eliminates listener teardown/setup race conditions |
| State for values only used in callbacks | useRef for callback-only values | React docs recommendation | Avoids unnecessary re-renders and dependency issues |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vite.config.ts` (test section, line 60-66) |
| Quick run command | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts` |
| Full suite command | `bun run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RACE-01 | Mount-once listeners catch events after scanId set | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "race condition"` | No -- Wave 0 |
| ERROR-01 | baker_scan_error sets error inline, isScanning=false | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "error event"` | No -- Wave 0 |
| NOBYPASS-01 | useBakerScan has no direct @tauri-apps/api/event imports | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "no-bypass"` | Partial -- existing no-bypass test covers module, needs scan hook specificity |
| TIMER-01 | Hook tracks scanStartTime correctly (set on start, cleared on complete) | unit | `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts -t "timestamp"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test -- src/features/Baker/__contracts__/baker.contract.test.ts`
- **Per wave merge:** `bun run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/features/Baker/__contracts__/baker.contract.test.ts` -- race condition regression, error path, timestamp tracking
- [ ] No new test files needed -- extend existing contract test file

## Open Questions

1. **Does the backend guarantee scanId in all events?**
   - What we know: Types define `scanId` on `ScanProgressEvent`, `ScanCompleteEvent`, and `ScanErrorEvent`
   - What's unclear: Whether the Rust backend always populates this field (but types suggest it does)
   - Recommendation: Trust the types; if a runtime issue surfaces, add defensive check in handler

2. **Should elapsed timer use frontend time or backend startTime/endTime?**
   - What we know: `ScanResult.startTime` is an ISO string set by backend when scan starts; hook needs a separate frontend timestamp for the running counter
   - Recommendation: Use `Date.now()` in the hook for the live counter; use `ScanResult.startTime`/`endTime` for the final summary. This avoids clock sync issues.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis: `useBakerScan.ts`, `api.ts`, `types.ts`, `ScanResults.tsx`, `BakerPage.tsx`, `baker.contract.test.ts`
- React docs: useRef for mutable values in callbacks (well-established pattern)

### Secondary (MEDIUM confidence)
- Tauri `listen()` API returns `Promise<UnlistenFn>` -- verified from api.ts wrapper signatures

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- bug cause is clear from source code, fix pattern is well-established React
- Pitfalls: HIGH -- identified from direct code analysis of the specific files being modified

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- React patterns don't change frequently)
