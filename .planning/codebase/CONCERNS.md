# Codebase Concerns

**Analysis Date:** 2026-03-07

## Tech Debt

**Plaintext Password Storage in localStorage:**
- Issue: User registration stores credentials as plaintext JSON in `localStorage`, including the raw password
- Files: `src/pages/auth/Register.tsx` (line 37), `src/pages/auth/Login.tsx`
- Impact: Any XSS vulnerability or local access exposes user passwords. The comment on line 36 acknowledges this: "simple approach, not secure"
- Fix approach: Use Tauri's stronghold plugin (already a dependency) for credential storage, hash passwords with argon2 (already in Cargo.toml) on the backend before storing

**Auth Token Storage in localStorage:**
- Issue: Access tokens stored in `localStorage` instead of secure storage
- Files: `src/context/AuthProvider.tsx` (lines 20-21), `src/hooks/useAuthCheck.ts` (lines 13-14)
- Impact: Tokens vulnerable to XSS attacks. Tauri's stronghold plugin is already available but not used for auth tokens
- Fix approach: Migrate token storage to `@tauri-apps/plugin-stronghold`

**Excessive Use of Native `alert()` and `confirm()` Dialogs:**
- Issue: 27+ instances of `window.alert()` and 7 instances of `window.confirm()` used for user feedback instead of proper toast/dialog components
- Files: `src/pages/Settings.tsx` (13 instances), `src/pages/Baker/Baker.tsx` (3 instances), `src/hooks/useCreateProject.refactored.ts` (4 instances), `src/hooks/useFileUpload.ts` (3 instances), `src/hooks/useTrelloCardsManager.ts` (2 instances), `src/hooks/useTrelloBreadcrumbs.ts`, `src/hooks/useUploadTrello.ts`
- Impact: Blocks the UI thread, inconsistent UX with the rest of the app (which uses Sonner toasts). Native dialogs cannot be themed
- Fix approach: Replace all `alert()` calls with `toast.success()`/`toast.error()` from Sonner (already installed). Replace `confirm()` with Radix AlertDialog (already installed)

**Dead/Orphaned `.old` Files Committed to Repo:**
- Issue: Superseded component files left in the codebase with `.old.tsx` suffix
- Files: `src/components/Baker/TrelloCards/AddCardDialog.old.tsx`, `src/components/Baker/VideoLinks/AddVideoDialog.old.tsx`
- Impact: Confusing for developers, increases bundle analysis noise
- Fix approach: Delete these files. Git history preserves the originals if needed

**Duplicate/Parallel Implementation Files (`.refactored` suffix):**
- Issue: Refactored hooks exist alongside originals, unclear which is canonical
- Files: `src/hooks/useCreateProject.refactored.ts`, `src/hooks/useUploadTrello.refactored.ts`
- Impact: Ambiguity about which version to import. Both may be in use or one may be dead code
- Fix approach: Determine which version is actively imported, delete the other, and rename if needed

**Stub/Unimplemented Features Shipped in UI:**
- Issue: ThemeImport component is a visible stub that shows `alert('Custom theme import feature coming soon!')`
- Files: `src/components/Settings/ThemeImport.tsx` (line 17-18)
- Impact: Poor user experience - visible button that does nothing useful
- Fix approach: Either implement the feature or hide the component until ready

**Incomplete TODO Comments:**
- Issue: Several TODO items indicate unfinished work
- Files:
  - `src/hooks/useDocxParser.ts:191` - "TODO: Calculate nesting level" (list nesting always hardcoded to 1)
  - `src/hooks/useVideoLinksManager.ts:203` - "TODO: Add Trello Card functionality to be implemented" (empty handler)
- Impact: Missing functionality that may cause incorrect behavior (nesting) or dead UI buttons (Trello card add)
- Fix approach: Implement the TODO items or remove the dead code paths

**Duplicate Logger Import in query-client-config.ts:**
- Issue: Two logger imports on lines 7 and 9 - one generic, one namespaced - the generic one shadows the namespaced one
- Files: `src/lib/query-client-config.ts` (lines 7-9)
- Impact: Potential runtime error or linting issue from duplicate `logger` const declaration
- Fix approach: Remove the unused import on line 7

## Security Considerations

**Plaintext Credentials in localStorage:**
- Risk: Critical. Passwords stored in plaintext in browser storage. Any extension, XSS, or physical access exposes credentials
- Files: `src/pages/auth/Register.tsx` (line 37: `JSON.stringify({ username, password })`)
- Current mitigation: None
- Recommendations: Hash passwords server-side (argon2 already in Cargo.toml), use Tauri stronghold for token storage, never store raw passwords client-side

**Trello API Credentials Passed in URL Parameters:**
- Risk: API keys and tokens appended to URLs as query parameters, which may be logged in server access logs
- Files: `src-tauri/src/baker/video_links.rs` (lines 243-246, 272-274, 305-306)
- Current mitigation: HTTPS encrypts in transit, but URL parameters may persist in logs
- Recommendations: Use request headers for API credentials instead of URL query parameters

**Auth System Uses Simple Token List (No Expiration):**
- Risk: Tokens never expire - once added via `add_token`, they persist until app restart. No token rotation or expiration
- Files: `src-tauri/src/commands/auth.rs` (entire file), `src-tauri/src/state/auth.rs`
- Current mitigation: Tokens stored in-memory (reset on app restart)
- Recommendations: Add token expiration, implement JWT verification with expiry claims

**Mutex `unwrap()` in Auth Commands Can Panic:**
- Risk: If the mutex is poisoned (another thread panicked while holding it), `unwrap()` will crash the app
- Files: `src-tauri/src/commands/auth.rs` (lines 6, 16)
- Current mitigation: None
- Recommendations: Use `.lock().map_err()` or `.lock().unwrap_or_else()` to handle poisoned mutex gracefully

## Performance Bottlenecks

**JSON.stringify for useMemo Dependencies:**
- Problem: `useFuzzySearch` hook uses `JSON.stringify(items)` and `JSON.stringify(options)` as memo dependencies
- Files: `src/hooks/useFuzzySearch.ts` (lines 16-17)
- Cause: Serializing the entire items array on every render to produce a stable dependency key
- Improvement path: Use a ref-based comparison, `useMemo` with a custom shallow comparison, or track items by a hash/length metric

**Formatting Metadata Extraction Bug (Incorrect Positions):**
- Problem: `extractFormattingMetadata` in `useDocxParser` tracks `currentPosition` but only increments it in the paragraph loop, meaning bold/italic/underline/heading positions are all recorded as 0
- Files: `src/hooks/useDocxParser.ts` (lines 140-206)
- Cause: `currentPosition` is initialized to 0 and only updated in the paragraph `forEach` at the end, after bold/italic ranges have already been recorded
- Improvement path: Rewrite to calculate actual text offsets for each element by walking the DOM tree in order

**Regex Recompilation on Every Trello Card URL Parse:**
- Problem: `extract_trello_card_id` creates a new `Regex` instance on every call
- Files: `src-tauri/src/baker/video_links.rs` (line 11)
- Cause: No regex caching (e.g., `lazy_static!` or `once_cell`)
- Improvement path: Use `lazy_static!` or `std::sync::LazyLock` to compile the regex once

## Fragile Areas

**File Copy Operation with `unwrap()` on `file_name()`:**
- Files: `src-tauri/src/commands/file_ops.rs` (line 45)
- Why fragile: `src_path.file_name().unwrap()` will panic if the path ends with `..` or is a root path
- Safe modification: Use `.file_name().ok_or("Invalid file path")?` instead
- Test coverage: No unit tests for `move_files` command

**Premiere Project Copy with `unwrap()` on Parent Path:**
- Files: `src-tauri/src/commands/premiere.rs` (lines 68, 70)
- Why fragile: `destination_path.parent().unwrap()` will panic if the path has no parent (e.g., root path)
- Safe modification: Use `.parent().ok_or("Invalid destination path")?`
- Test coverage: Unit tests exist in `src-tauri/src/commands/tests/premiere_test.rs` but only test the copy/sync behavior, not edge case paths

**Video Links `unwrap()` After None Check:**
- Files: `src-tauri/src/baker/video_links.rs` (lines 88, 193)
- Why fragile: Pattern of `if x.is_none() { x = Some(Vec::new()) }` followed by `x.as_mut().unwrap()` works but is not idiomatic Rust
- Safe modification: Use `.get_or_insert_with(Vec::new)` which is safe and cleaner

**Settings Page Monolith:**
- Files: `src/pages/Settings.tsx` (523 lines)
- Why fragile: Single component handles AI models, appearance, backgrounds, SproutVideo, and Trello settings. Many local state variables and handlers
- Safe modification: Extract each settings section into its own component (similar to how Baker components are organized)
- Test coverage: Has test file `src/pages/Settings.test.tsx`

## Test Coverage Gaps

**Rust Backend Has Minimal Test Coverage:**
- What's not tested: `file_ops.rs` (move_files), `auth.rs`, `sprout_upload.rs`, `plugins.rs`, `premiere.rs` (only partial), `system.rs`, `docx.rs`, `ai_provider.rs`
- Files: `src-tauri/src/commands/` (all files), `src-tauri/src/baker/` (all files)
- Risk: File operations, API integrations, and plugin installation have no automated tests. Bugs in file copying/moving could cause data loss
- Priority: High - file operations are critical and currently only tested manually

**Frontend Test Coverage is Sparse:**
- What's not tested: Only 7 test files exist across the entire `src/` directory for dozens of components and hooks
- Files: `src/__tests__/hooks/useBreadcrumbsTrelloCards.test.tsx`, `src/components/Baker/VideoLinksManager.test.tsx`, `src/components/nav-main.test.tsx`, `src/pages/Settings.test.tsx`, `src/pages/UploadSprout.test.tsx`, `src/app/dashboard/__tests__/` (2 files)
- Risk: Most hooks, pages, and components have zero test coverage. Regressions can go undetected
- Priority: High - critical workflow paths (BuildProject, Baker, file upload) have no tests

**RAG Tests Are Mostly Commented Out:**
- What's not tested: The majority of test cases in `rag_tests.rs` are commented out (lines 123-404), including tests for upload, replace, and delete operations
- Files: `src-tauri/src/commands/tests/rag_tests.rs`
- Risk: RAG example management (upload, replace, delete) has no working automated tests
- Priority: Medium - feature works but regressions could go unnoticed

**No E2E Tests in CI:**
- What's not tested: Playwright config and scripts exist but there is no evidence of E2E test files or CI integration
- Files: `package.json` (test:e2e scripts defined)
- Risk: End-to-end user workflows are not verified automatically
- Priority: Medium

## Dependencies at Risk

**`@xenova/transformers` (v2.17.2):**
- Risk: This package is large (ML inference runtime) and the `@xenova` namespace has been superseded by `@huggingface/transformers`
- Impact: May not receive updates, potential security vulnerabilities in unmaintained package
- Migration plan: Migrate to `@huggingface/transformers` (official successor)

**`next-themes` (v0.4.6):**
- Risk: This package is designed for Next.js, not Vite/React. Using it in a non-Next.js app adds unnecessary complexity
- Impact: May have SSR-related code that is dead weight in a Tauri desktop app
- Migration plan: Consider a lightweight custom theme provider or a Vite-compatible alternative

**`ai-labs-claude-skills` (v2.0.1):**
- Risk: Unclear provenance - this appears to be a development-only concern rather than a runtime dependency, but it is listed in `dependencies` not `devDependencies`
- Impact: Adds to production bundle size unnecessarily
- Migration plan: Move to `devDependencies` if it is only used during development

## Missing Critical Features

**No Offline Support Strategy:**
- Problem: External API calls (Trello, SproutVideo) have no offline fallback or queue mechanism
- Blocks: Users cannot work reliably without internet connectivity for features that could cache locally

**No Error Recovery for Background File Operations:**
- Problem: `move_files` in `file_ops.rs` spawns a thread and returns `Ok(())` immediately. If the thread panics, the frontend receives no notification
- Files: `src-tauri/src/commands/file_ops.rs` (lines 18-89)
- Blocks: Users may think files were copied successfully when they were not

---

*Concerns audit: 2026-03-07*
