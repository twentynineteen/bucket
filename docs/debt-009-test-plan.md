# DEBT-009: Test Coverage Improvement Plan

**Status:** In Progress
**Created:** 2025-12-03
**Methodology:** Test-Driven Development (TDD)
**Skill:** test-specialist

## Executive Summary

DEBT-009 addresses the lack of comprehensive test coverage for features added in Phase 003-007. This test plan identifies critical untested code and provides a structured approach to achieving 80% coverage for hooks and utils.

### Current State

- **Total Test Files:** 78
- **Total Tests:** 1,160 passing
- **Test Coverage:** Unknown (coverage tool not installed)
- **Untested Files:** 246 out of 247 source files (0.4% have tests)

### Gap Analysis

Based on automated analysis, the following critical features lack test coverage:

#### Phase 003: Baker Workflow (MERGED)

**Untested Hooks (3):**

- ✅ `useBakerPreferences.ts` - HAS TESTS
- ✅ `useBakerScan.ts` - HAS TESTS
- ❌ `useBakerTrelloIntegration.ts` - **NO TESTS** (HIGH PRIORITY)

**Untested Components (7):**

- ❌ `BatchActions.tsx` - **NO TESTS** (HIGH PRIORITY)
- ❌ `FolderSelector.tsx` - **NO TESTS** (MEDIUM PRIORITY)
- ❌ `ProjectList.tsx` - **NO TESTS** (HIGH PRIORITY)
- ❌ `ScanResults.tsx` - **NO TESTS** (MEDIUM PRIORITY)
- ❌ `TrelloCardItem.tsx` - **NO TESTS** (LOW PRIORITY)
- ❌ `TrelloCardUpdateDialog.tsx` - **NO TESTS** (MEDIUM PRIORITY)
- ❌ `VideoLinkCard.tsx` - **NO TESTS** (LOW PRIORITY)

#### Phase 004: Multiple Video Links and Trello Cards

**Status:** Design complete, implementation has tests
✅ Contract tests exist: `video_link_validation.test.ts`, `trello_card_validation.test.ts`
✅ Component tests exist: `AddVideoDialog.test.tsx`, `AddCardDialog.test.tsx`
✅ Manager tests exist: `VideoLinksManager.test.tsx` (33 tests)

#### Phase 006-007: AI Script Formatting

**Untested Hooks (3):**

- ❌ `useScriptFileUpload.ts` - **NO TESTS** (HIGH PRIORITY)
- ❌ `useScriptFormatterState.ts` - **NO TESTS** (HIGH PRIORITY)
- ❌ `useScriptRetrieval.ts` - **NO TESTS** (MEDIUM PRIORITY)

**Tested Hooks (7):**

- ✅ `useAIModels.ts` - 7 tests
- ✅ `useAIProcessing.tsx` - Tests exist
- ✅ `useScriptDownload.tsx` - Tests exist
- ✅ `useScriptProcessor.test.ts` - 10 tests
- ✅ `useScriptReview.tsx` - Tests exist
- ✅ `useScriptUpload.tsx` - Tests exist
- ✅ `useScriptWorkflow.tsx` - Tests exist

**Example Embeddings Management:**

- ✅ `useExampleManagement.tsx` - HAS TESTS
- ✅ `ExampleEmbeddings.test.tsx` - HAS TESTS (page component)
- ✅ `example-management.test.tsx` - HAS INTEGRATION TESTS (20 tests)

## Prioritization Matrix

### HIGH PRIORITY (Do First)

These are critical business logic components with significant complexity:

1. **useBakerTrelloIntegration.ts** (111-151 lines)
   - Complexity: Medium
   - Business Impact: HIGH (Trello integration)
   - Risk: Data loss if Trello updates fail
   - Estimated Tests: 15-20
   - Effort: 2 hours

2. **useScriptFileUpload.ts** (24-136 lines)
   - Complexity: Medium
   - Business Impact: HIGH (File upload validation)
   - Risk: Invalid files, encoding issues
   - Estimated Tests: 18-22
   - Effort: 2 hours

3. **useScriptFormatterState.ts** (legacy hook, may be deprecated)
   - Complexity: Unknown (needs inspection)
   - Business Impact: HIGH if still used
   - Risk: State management bugs
   - Estimated Tests: 20-30
   - Effort: 3 hours

4. **BatchActions.tsx**
   - Complexity: Medium
   - Business Impact: HIGH (bulk operations)
   - Risk: Data corruption on batch updates
   - Estimated Tests: 12-15
   - Effort: 2 hours

5. **ProjectList.tsx**
   - Complexity: Medium
   - Business Impact: HIGH (main UI component)
   - Risk: UI bugs, data display issues
   - Estimated Tests: 15-20
   - Effort: 2.5 hours

### MEDIUM PRIORITY (Do Second)

Supporting components and features:

6. **useScriptRetrieval.ts**
   - Complexity: Low-Medium
   - Business Impact: MEDIUM (AI script retrieval)
   - Estimated Tests: 10-12
   - Effort: 1.5 hours

7. **FolderSelector.tsx**
   - Complexity: Low-Medium
   - Business Impact: MEDIUM (folder selection UI)
   - Estimated Tests: 8-10
   - Effort: 1.5 hours

8. **ScanResults.tsx**
   - Complexity: Medium
   - Business Impact: MEDIUM (results display)
   - Estimated Tests: 10-12
   - Effort: 2 hours

9. **TrelloCardUpdateDialog.tsx**
   - Complexity: Medium
   - Business Impact: MEDIUM (Trello card editing)
   - Estimated Tests: 12-15
   - Effort: 2 hours

### LOW PRIORITY (Consider Later)

Simple presentational components:

10. **TrelloCardItem.tsx**
    - Complexity: Low
    - Business Impact: LOW (display component)
    - Estimated Tests: 6-8
    - Effort: 1 hour

11. **VideoLinkCard.tsx**
    - Complexity: Low
    - Business Impact: LOW (display component)
    - Estimated Tests: 6-8
    - Effort: 1 hour

## Test Plan Details

### Phase 1: High-Priority Hooks (6 hours)

#### Test 1: useBakerTrelloIntegration.ts

**File:** `tests/unit/hooks/useBakerTrelloIntegration.test.tsx`

**Test Categories:**

1. **Initialization** (3 tests)
   - Returns correct interface
   - Handles missing API credentials
   - Initializes with valid credentials

2. **updateTrelloCards - Happy Path** (4 tests)
   - Successfully updates single project
   - Successfully updates multiple projects
   - Skips update when no API credentials
   - Returns empty errors array on success

3. **updateTrelloCards - Error Handling** (5 tests)
   - Handles invalid breadcrumbs.json path
   - Handles malformed JSON in breadcrumbs
   - Handles missing trelloCards array
   - Handles Trello API errors
   - Collects multiple errors for batch operations

4. **Edge Cases** (5 tests)
   - Handles empty project paths array
   - Handles projects without breadcrumbs.json
   - Handles network errors
   - Handles invalid Trello card URLs
   - Handles partial success (some projects fail)

**Mocks Required:**

- `@tauri-apps/plugin-fs`: `readTextFile`
- `src/hooks/useBakerTrelloIntegration`: `updateProjectTrelloCards`
- `src/utils/logger`: `logger.warn`

**Total Estimated Tests:** 17

---

#### Test 2: useScriptFileUpload.ts

**File:** `tests/unit/hooks/useScriptFileUpload.test.tsx`

**Test Categories:**

1. **Initialization** (2 tests)
   - Returns correct interface
   - Initializes with isReading=false and error=null

2. **selectFile** (5 tests)
   - Opens file dialog with correct filters
   - Returns selected file path
   - Returns null when dialog cancelled
   - Handles file dialog errors
   - Sets error state on failure

3. **readFileContent** (6 tests)
   - Reads file content successfully
   - Sets isReading=true during read
   - Sets isReading=false after read
   - Throws error on read failure
   - Sets error state on failure
   - Clears previous errors on new read

4. **validateFile** (10 tests)
   - Accepts valid .txt file with valid content
   - Rejects non-.txt file extensions
   - Rejects content below MIN_CONTENT_LENGTH
   - Rejects content above MAX_CONTENT_LENGTH
   - Trims whitespace before validation
   - Detects invalid UTF-8 encoding (\\uFFFD)
   - Clears error on successful validation
   - Sets appropriate error types
   - Case-insensitive extension check (.TXT, .Txt)
   - Handles edge case: exactly MIN_CONTENT_LENGTH

**Mocks Required:**

- `@tauri-apps/plugin-dialog`: `open`
- `@tauri-apps/plugin-fs`: `readTextFile`

**Total Estimated Tests:** 23

---

#### Test 3: useScriptFormatterState.ts

**File:** `tests/unit/hooks/useScriptFormatterState.test.tsx`

**Note:** This hook may be deprecated (DEBT-001 refactored it). Need to check if still in use.

**Action Plan:**

1. Check if hook is still imported/used in codebase
2. If deprecated, document and remove from test plan
3. If still used, create comprehensive test suite (20-30 tests)

**Estimated Tests:** 0-30 (pending investigation)

---

### Phase 2: High-Priority Components (4.5 hours)

#### Test 4: BatchActions.tsx

**File:** `tests/unit/components/BatchActions.test.tsx`

**Test Categories:**

1. **Rendering** (3 tests)
   - Renders with no selected projects
   - Renders with selected projects
   - Shows correct button states

2. **Apply Changes** (4 tests)
   - Triggers applyChanges callback
   - Disabled when no changes to apply
   - Shows confirmation dialog
   - Handles apply errors

3. **Update Trello Cards** (3 tests)
   - Triggers updateTrelloCards callback
   - Disabled when no Trello credentials
   - Shows progress during update

4. **Accessibility** (2 tests)
   - Has proper ARIA labels
   - Keyboard navigation works

**Total Estimated Tests:** 12

---

#### Test 5: ProjectList.tsx

**File:** `tests/unit/components/ProjectList.test.tsx`

**Test Categories:**

1. **Rendering** (4 tests)
   - Renders empty state
   - Renders list of projects
   - Shows loading state
   - Shows error state

2. **Selection** (3 tests)
   - Selects single project
   - Selects multiple projects
   - Deselects projects

3. **Filtering** (3 tests)
   - Filters by project name
   - Filters by status
   - Clears filters

4. **Sorting** (3 tests)
   - Sorts by name
   - Sorts by date
   - Sorts by status

5. **Actions** (3 tests)
   - Opens project details
   - Triggers edit action
   - Triggers delete action

**Total Estimated Tests:** 16

---

### Phase 3: Medium-Priority Items (7 hours)

#### Test 6-9: Remaining Components and Hooks

- **useScriptRetrieval.ts**: 12 tests (1.5 hours)
- **FolderSelector.tsx**: 10 tests (1.5 hours)
- **ScanResults.tsx**: 12 tests (2 hours)
- **TrelloCardUpdateDialog.tsx**: 15 tests (2 hours)

**Total Estimated Tests:** 49

---

### Phase 4: Low-Priority Components (2 hours)

#### Test 10-11: Display Components

- **TrelloCardItem.tsx**: 8 tests (1 hour)
- **VideoLinkCard.tsx**: 8 tests (1 hour)

**Total Estimated Tests:** 16

---

## Test Coverage Targets

### By Category

- **Hooks**: 90% coverage (critical business logic)
- **Components**: 80% coverage (user-facing features)
- **Utils**: 85% coverage (shared functionality)
- **Services**: 85% coverage (infrastructure)

### By Priority

- **HIGH**: 90%+ coverage required
- **MEDIUM**: 80%+ coverage required
- **LOW**: 70%+ coverage acceptable

## Implementation Strategy

### TDD Workflow (RED → GREEN → REFACTOR)

1. **RED Phase** (Write Failing Tests)
   - Write test file skeleton
   - Write all test cases expecting correct behavior
   - Mock all external dependencies
   - Run tests → all should fail (no implementation yet)
   - Verify tests fail for the right reason

2. **GREEN Phase** (Make Tests Pass)
   - **IMPORTANT:** Do NOT implement production code
   - Verify existing implementation passes tests
   - If tests fail, implementation has bugs → file bug tickets
   - Only fix obvious issues in test setup/mocking

3. **REFACTOR Phase** (Improve Code)
   - Run full test suite → verify no regressions
   - Check coverage report
   - Document any discovered bugs
   - Update TECHNICAL_DEBT.md

### Test Quality Standards

**Every test must:**

- Follow AAA pattern (Arrange-Act-Assert)
- Have descriptive name explaining scenario
- Be independent (no shared state)
- Test behavior, not implementation
- Use realistic test data
- Mock external dependencies
- Clean up after itself

**Mock Strategy:**

- Mock Tauri APIs (`@tauri-apps/*`)
- Mock external HTTP calls
- Mock file system operations
- Use `vi.mock()` for module mocks
- Use `vi.fn()` for function mocks
- Reset mocks in `beforeEach`

## Success Criteria

### Quantitative

- [ ] All HIGH priority items have ≥15 tests each
- [ ] All MEDIUM priority items have ≥10 tests each
- [ ] All LOW priority items have ≥6 tests each
- [ ] **Total new tests: ~133**
- [ ] All 1,160+ existing tests still pass
- [ ] Zero regressions introduced

### Qualitative

- [ ] Tests are maintainable and readable
- [ ] Tests catch real bugs (verify with intentional bugs)
- [ ] Mocks are realistic and accurate
- [ ] Edge cases are covered
- [ ] Error handling is tested
- [ ] Tests run quickly (<30s for full suite)

## Timeline Estimate

### Phase 1: High-Priority Hooks (6 hours)

- Test 1: useBakerTrelloIntegration (2 hours)
- Test 2: useScriptFileUpload (2 hours)
- Test 3: useScriptFormatterState (2 hours, may skip if deprecated)

### Phase 2: High-Priority Components (4.5 hours)

- Test 4: BatchActions (2 hours)
- Test 5: ProjectList (2.5 hours)

### Phase 3: Medium-Priority Items (7 hours)

- Test 6-9: Four items × 1.5-2 hours each

### Phase 4: Low-Priority Components (2 hours)

- Test 10-11: Two items × 1 hour each

### Phase 5: Integration & Documentation (2 hours)

- Run full test suite
- Generate coverage report
- Document findings
- Update TECHNICAL_DEBT.md

**Total Estimated Effort:** 21.5 hours (~3 days)

## Risk Mitigation

### Risks

1. **Existing code has bugs** → Tests will fail
   - Mitigation: Document bugs, create tickets, focus on test quality
2. **Mocking complexity** → Hard to mock Tauri APIs
   - Mitigation: Use existing test patterns, reference working tests
3. **Scope creep** → Find more untested code
   - Mitigation: Stick to prioritized list, defer discoveries
4. **Time overrun** → Tests take longer than estimated
   - Mitigation: Focus on HIGH priority first, defer LOW priority

## Dependencies

### Required Tools

- ✅ Vitest (installed)
- ✅ @testing-library/react (installed)
- ✅ @testing-library/user-event (installed)
- ❌ @vitest/coverage-v8 (needs installation)

### Required Mocks

- ✅ Tauri APIs (patterns exist in current tests)
- ✅ React Query (patterns exist)
- ✅ File system operations (patterns exist)

## Next Steps

1. **Immediate:** Investigate if `useScriptFormatterState.ts` is deprecated
2. **Start Phase 1:** Begin with `useBakerTrelloIntegration.ts` tests
3. **Install coverage:** `npm install -D @vitest/coverage-v8`
4. **Baseline coverage:** Run coverage on current codebase
5. **Track progress:** Update this document after each test file

## Appendix A: Test File Template

```typescript
import { useTargetHook } from '@/hooks/useTargetHook'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock external dependencies
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn()
}))

describe('useTargetHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    test('returns correct interface', () => {
      // Arrange & Act
      const { result } = renderHook(() => useTargetHook())

      // Assert
      expect(result.current).toEqual({
        someProperty: expect.any(Function),
        anotherProperty: expect.any(Boolean)
      })
    })
  })

  describe('Feature Name', () => {
    test('does something correctly', async () => {
      // Arrange
      const mockData = { foo: 'bar' }
      const { result } = renderHook(() => useTargetHook())

      // Act
      await act(async () => {
        await result.current.someMethod(mockData)
      })

      // Assert
      expect(result.current.someState).toBe('expected')
    })
  })
})
```

## Appendix B: Coverage Analysis Command

```bash
# Install coverage tool
npm install -D @vitest/coverage-v8

# Run tests with coverage
npm test -- --coverage

# Analyze coverage gaps
python3 .claude/skills/test-specialist/scripts/analyze_coverage.py coverage/coverage-final.json
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-03
**Owner:** test-specialist skill
**Status:** Ready for Implementation
