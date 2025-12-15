# NPM to Bun Migration Task Tracker

**Branch:** `chore/complete-bun-migration`
**Date Started:** 2025-12-10
**Status:** In Progress

---

## Migration Overview

Complete the transition from npm to Bun across CI/CD workflows, documentation, and project-specific configurations. This follows a conservative 4-phase approach with validation at each step.

---

## Phase 1: CI/CD Workflows (CRITICAL) ✅

**Goal:** Update all GitHub Actions workflows to use Bun instead of npm

### Tasks

- [x] Update `.github/workflows/publish.yml`
  - [x] Replace `actions/setup-node@v4` with `oven-sh/setup-bun@v2`
  - [x] Replace `npm install` with `bun install`
  - [x] Replace `tauriScript: 'npm run tauri'` with `tauriScript: 'bun run tauri'`

- [x] Update `.github/workflows/auto-release-pr.yml`
  - [x] Replace `actions/setup-node@v4` with `oven-sh/setup-bun@v2` (2 instances)
  - [x] Replace all `npm install` with `bun install`
  - [x] Replace `npm run test:run` with `bun run test:run`
  - [x] Replace `npm run build:tauri` with `bun run build:tauri`
  - [x] Replace `npm run test:e2e` with `bun run test:e2e`
  - [x] Update cache key from `package-lock.json` to `bun.lockb`
  - [x] Keep `npx playwright install` (correct usage)

- [x] Update `.github/workflows/update-node-dependencies.yml`
  - [x] Replace `actions/setup-node@v4` with `oven-sh/setup-bun@v2`
  - [x] Replace `npm install` with `bun install`
  - [x] Replace `npm run build` with `bun run build`

### Validation

- [x] Push branch and verify all GitHub Actions pass
- [x] Review workflow run logs for any Bun-specific issues
- [x] Confirm build artifacts are created correctly

**Status:** Complete
**Completed:** 2025-12-10

---

## Phase 2: User-Facing Documentation (HIGH) ✅

**Goal:** Update documentation that users and developers interact with

### Tasks

- [x] Update `README.md`
  - [x] Line 60: Update Prerequisites to emphasize Bun
  - [x] Line 80: Change `npm install` to `bun install`
  - [x] Line 87: Change `npm run build:tauri` to `bun run build:tauri`
  - [x] Line 96: Change `npm run dev:tauri` to `bun run dev:tauri`
  - [x] Remove npm as alternative option

- [x] Update `tests/e2e/playwright.config.ts`
  - [x] Line 48: Change `command: 'npm run dev'` to `command: 'bun run dev'`
  - [x] Lines 52-56: Update comment and remove npm-specific env clearing

- [x] Update `BUILD_PROJECT_FIXES.md`
  - [x] Line 6: Change "verified with npm test" to "verified with bun test"

### Validation

- [x] Run `bun run test:e2e` to verify E2E tests work with new config
- [x] Verify dev server starts correctly via Playwright
- [x] Review documentation for accuracy

**Status:** Complete
**Completed:** 2025-12-10

---

## Phase 3: Internal Documentation (MEDIUM) ✅

**Goal:** Update Serena memory files for AI assistant consistency

### Tasks

- [x] Update `.serena/memories/suggested_commands.md`
  - [x] Replace all `npm run` commands with `bun run`
  - [x] Replace `npm install` with `bun install`
  - [x] Verify all command examples are accurate

- [x] Update `.serena/memories/task_completion_workflow.md`
  - [x] Replace npm command references with bun equivalents
  - [x] Update workflow descriptions

- [x] Update `.serena/memories/tech_stack.md`
  - [x] Change package manager description from npm to Bun
  - [x] Update any npm-specific notes

### Validation

- [x] Review all changes for consistency
- [x] Verify commands match those in CLAUDE.md and README.md

**Status:** Complete (not committed - .serena is gitignored)
**Completed:** 2025-12-10

---

## Phase 4: Project-Specific Skills (MEDIUM) ✅

**Goal:** Update actively-used Claude Code skills to use Bun commands

### Tasks

- [x] Update `.claude/skills/new-frontend-feature/skill.md`
  - [x] Line 452: Change `npm run test` to `bun run test`
  - [x] Verify skill instructions remain accurate

- [x] Update `.claude/skills/test-specialist/SKILL.md`
  - [x] Line 299: Replace `npm test -- --coverage` with `bun test --coverage`
  - [x] Lines 436-448: Update all test command examples
    - [x] `npm test` → `bun test`
    - [x] `npm test -- --coverage` → `bun test --coverage`
    - [x] `npm test -- ExpenseCalculator.test.ts` → `bun test ExpenseCalculator.test.ts`
    - [x] `npm test -- --watch` → `bun test --watch`
    - [x] `npm run test:e2e` → `bun run test:e2e`

### Validation

- [x] Verify skill instructions work with current Bun test setup
- [x] Test-run one skill to ensure commands execute correctly

**Status:** Complete
**Completed:** 2025-12-10

---

## Post-Migration Testing Checklist ✅

**Goal:** Comprehensive validation before merging to release branch

### Core Functionality

- [x] `bun install` installs all dependencies correctly
- [x] `bun run dev:tauri` launches the Tauri app
- [x] `bun run build:tauri` creates DMG in `/target/build/dmg`
- [x] `bun test` runs all Vitest tests and passes
- [x] `bun run prettier:fix` formats code correctly
- [x] `bun run eslint:fix` lints code correctly

### CI/CD Validation

- [x] All GitHub Actions workflows show green checkmarks
- [x] Publish workflow can build release artifacts
- [x] Auto-release-PR workflow runs without errors
- [x] Update-node-dependencies workflow functions correctly

### E2E Testing

- [x] `bun run test:e2e` runs Playwright tests successfully
- [x] Dev server starts correctly for E2E tests
- [x] All E2E tests pass

### Documentation Review

- [x] README.md instructions are accurate and complete
- [x] CLAUDE.md references are still correct
- [x] No broken npm references remain in user-facing docs

**Status:** Complete
**Completed:** 2025-12-10

---

## Final Steps ✅

- [x] Review all changes in git diff
- [x] Commit changes with descriptive message
- [x] Push branch to remote
- [x] Create PR: `chore/complete-bun-migration` → `release`
- [x] Add PR description with migration summary
- [x] Request review if needed
- [ ] Merge PR after approval (awaiting user approval)

**Status:** Complete - PR #66 Created
**Completed:** 2025-12-10
**PR:** https://github.com/twentynineteen/bucket/pull/66

---

## Files Intentionally Excluded

These files contain npm references that should NOT be changed:

### Third-Party/Generated Content
- `node_modules/*` (third-party code)
- `dist/*` (build artifacts)
- `CHANGELOG.md` (historical record)

### Correct NPX Usage
- `CLAUDE.md` line 47-49: `npx npm-check-updates` (npm-specific tool)
- `docs/react-query-patterns.md`: `npx ts-node` (correct usage)
- `scripts/validate-migration.ts`: `npx tsc` (correct usage)

### Package Names (Not Commands)
- `package.json`: `"npm-check-updates": "^19.1.1"` (dependency name)

### Non-Project-Specific Skills
- `.claude/skills/cicd-pipeline-generator/*`
- `.claude/skills/docker-containerization/*`
- `.claude/skills/document-skills/*`
- `.claude/skills/frontend-enhancer/*`
- `.claude/skills/codebase-documenter/*`
- `.claude/skills/tailwind-auditor/*`
- `.claude/skills/ux-animation-guru/*`

---

## Notes & Issues

### Issues Encountered
(None yet)

### Decisions Made
1. Remove npm as fallback option in documentation (user preference)
2. Focus only on project-specific skills, ignore general-purpose skills
3. Conservative 4-phase approach with validation between each phase
4. Keep `.claude/settings.local.json` unchanged (auto-approval rules)

### Command Mapping Reference

| npm Command | Bun Equivalent |
|-------------|----------------|
| `npm install` | `bun install` |
| `npm run <script>` | `bun run <script>` |
| `npm test` | `bun test` |
| `npm run build` | `bun run build` |
| `npm ci` | `bun install --frozen-lockfile` |
| `npx <package>` | `bunx <package>` (or keep npx for compatibility) |

---

## Progress Summary

- **Phase 1 (CI/CD):** 100% complete ✅
- **Phase 2 (User Docs):** 100% complete ✅
- **Phase 3 (Internal Docs):** 100% complete ✅
- **Phase 4 (Skills):** 100% complete ✅
- **Overall:** 100% complete ✅

**Status:** Migration Complete - PR Created (#66)
**Last Updated:** 2025-12-10
