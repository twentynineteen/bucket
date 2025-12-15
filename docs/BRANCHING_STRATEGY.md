# Branching Strategy

## Overview

This project uses a **Trunk-Based Development with Release Branch** strategy:

- **master** → Integration/staging branch (default)
- **release** → Production-ready code (protected)

## Branch Purposes

### `master` (Default Branch)
- **Purpose**: Integration and staging
- **Source**: All feature branches merge here
- **Target**: PRs from feature branches
- **Deployment**: Optional staging environment
- **Protection**: CI must pass, code review required

### `release` (Production Branch)
- **Purpose**: Production-ready, stable code
- **Source**: Only fast-forward merges from `master`
- **Target**: PRs only from `master` branch
- **Deployment**: Production environment
- **Protection**: Strict - CI must pass, version must be incremented, no direct commits

## Workflow

### 1. Feature Development

```bash
# Start from master
git checkout master
git pull origin master

# Create feature branch
git checkout -b feature/your-feature-name

# Work on your feature
git add .
git commit -m "feat: description"

# Push and create PR to master
git push -u origin feature/your-feature-name
gh pr create --base master --title "feat: Your Feature" --body "Description"
```

### 2. Integration (master)

1. Create PR from feature branch → `master`
2. CI runs automatically (lint, test, build)
3. Code review required
4. Merge when approved and CI passes
5. `master` branch is now updated with your feature

### 3. Release Process

When ready to release to production:

```bash
# Ensure you're on master
git checkout master
git pull origin master

# Increment version (choose one: patch, minor, major)
bun run version:patch   # 0.9.7 → 0.9.8
bun run version:minor   # 0.9.7 → 0.10.0
bun run version:major   # 0.9.7 → 1.0.0

# This updates package.json, Cargo.toml, tauri.conf.json, Cargo.lock
# and creates a commit

# Push version bump
git push origin master

# Create PR to release
gh pr create --base release --head master \
  --title "Release v$(node -p "require('./package.json').version")" \
  --body "Release version $(node -p "require('./package.json').version")

## Changes
- List major features/fixes included in this release
"

# After PR is approved and CI passes, merge to release
# GitHub Actions will automatically build and publish
```

### 4. Post-Release

After merging to `release`:
- GitHub Actions automatically builds the app
- Creates a GitHub release with changelog
- Attaches built artifacts (DMG, etc.)
- Tags the commit with version number

## Branch Protection Rules

### master Branch Protection

**Settings** → **Branches** → **Add rule** for `master`:

- ✅ Require a pull request before merging
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Status checks required:
    - `test` (CI workflow)
    - `lint` (CI workflow)
    - `build` (CI workflow)
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

### release Branch Protection

**Settings** → **Branches** → **Add rule** for `release`:

- ✅ Require a pull request before merging
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Status checks required:
    - `test` (CI workflow)
    - `lint` (CI workflow)
    - `build` (CI workflow)
- ✅ Require conversation resolution before merging
- ✅ Restrict who can push to matching branches
  - Only allow PRs from `master` branch (or specific maintainers)
- ✅ Do not allow bypassing the above settings
- ✅ Require linear history (fast-forward merges only)

## Quick Reference

| Action | Command |
|--------|---------|
| Start new feature | `git checkout master && git pull && git checkout -b feature/name` |
| Create PR to master | `gh pr create --base master` |
| Bump patch version | `bun run version:patch` |
| Bump minor version | `bun run version:minor` |
| Bump major version | `bun run version:major` |
| Create release PR | `gh pr create --base release --head master` |
| View current version | `node -p "require('./package.json').version"` |

## Version Numbering (Semantic Versioning)

- **PATCH** (0.9.**7** → 0.9.**8**): Bug fixes, minor changes
- **MINOR** (0.**9**.0 → 0.**10**.0): New features, backward compatible
- **MAJOR** (**0**.9.0 → **1**.0.0): Breaking changes

## Examples

### Example 1: Bug Fix

```bash
git checkout master && git pull
git checkout -b fix/build-project-crash
# ... make fixes ...
git commit -m "fix: resolve crash when creating project with special characters"
gh pr create --base master --title "fix: Build project crash"
# Wait for approval and CI → Merge
```

### Example 2: New Feature + Release

```bash
# Feature development
git checkout master && git pull
git checkout -b feature/trello-board-selector
# ... implement feature ...
git commit -m "feat: add Trello board selector in settings"
gh pr create --base master
# Wait for approval and CI → Merge to master

# When ready for release
git checkout master && git pull
bun run version:minor  # 0.9.7 → 0.10.0
git push origin master
gh pr create --base release --head master \
  --title "Release v0.10.0" \
  --body "## New Features
- Trello board selector in settings

## Bug Fixes
- ...
"
# Wait for approval and CI → Merge to release → Auto-deploy
```

## Troubleshooting

### "Cannot merge to release - not up to date"
```bash
# Make sure master has all changes from release
git checkout master
git merge release
git push origin master
```

### "CI failing on release PR"
- Ensure all tests pass on master first
- Check that version was incremented properly
- Verify Cargo.lock is updated (run `cargo check` in src-tauri/)

### "Want to hotfix production"
```bash
# Create hotfix branch from release
git checkout release && git pull
git checkout -b hotfix/critical-issue
# ... fix the issue ...
git commit -m "fix: critical production issue"

# Merge back to release AND master
gh pr create --base release --title "hotfix: Critical issue"
# After merging to release, also merge to master:
git checkout master
git merge hotfix/critical-issue
git push origin master
```

## Benefits of This Strategy

1. **Clear separation**: `master` = next release, `release` = current production
2. **Safe releases**: Only tested, approved code reaches production
3. **Easy rollback**: Revert `release` to previous tag if issues found
4. **Version control**: All releases properly versioned and tagged
5. **CI/CD integration**: Automated builds and deployments
6. **Flexibility**: Can do hotfixes, can delay features, can batch releases
