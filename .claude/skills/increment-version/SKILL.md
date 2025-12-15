---
name: increment-version
description: 'Use this skill when the user wants to increment or bump the project version number. This skill reads the current semantic version, increments it (patch/minor/major), updates package.json, Cargo.toml, and tauri.conf.json, runs cargo check to update Cargo.lock, and commits all changes to git with an appropriate commit message.'
---

# Increment Version Skill

## Overview

This skill automates the process of incrementing the project's semantic version number across all configuration files and committing the changes to git. It handles version updates in package.json, Cargo.toml, tauri.conf.json, and Cargo.lock.

## When to Use This Skill

Invoke this skill when:

- User asks to increment, bump, or update the version number
- Preparing for a new release
- Need to update version across multiple files consistently

## Core Capabilities

### 1. Version Increment Types

Supports semantic versioning with three increment types:

- **patch** (default): 0.9.5 → 0.9.6 (bug fixes, small changes)
- **minor**: 0.9.5 → 0.10.0 (new features, backward compatible)
- **major**: 0.9.5 → 1.0.0 (breaking changes)

### 2. Files Updated

Automatically updates version in:

1. `package.json` (line 3)
2. `src-tauri/Cargo.toml` (line 3)
3. `src-tauri/tauri.conf.json` (line 4)
4. `src-tauri/Cargo.lock` (via cargo check)

## Workflow

### Step 1: Determine Increment Type

Check if user specified an increment type in their message:

- If they said "patch" or nothing specific → use **patch**
- If they said "minor" → use **minor**
- If they said "major" → use **major**

Default to **patch** if unclear.

### Step 2: Read Current Version

Read the current version from package.json:

```bash
node -p "require('./package.json').version"
```

This will output something like: `0.9.5`

### Step 3: Calculate New Version

Parse the version string (format: X.Y.Z) and increment appropriately:

- **patch**: increment Z (e.g., 0.9.5 → 0.9.6)
- **minor**: increment Y, reset Z to 0 (e.g., 0.9.5 → 0.10.0)
- **major**: increment X, reset Y and Z to 0 (e.g., 0.9.5 → 1.0.0)

Calculate the new version before making any file changes.

### Step 4: Update Configuration Files

Use the Edit tool to update each file precisely:

**File 1: package.json (line 3)**

```json
"version": "NEW_VERSION"
```

**File 2: src-tauri/Cargo.toml (line 3)**

```toml
version = "NEW_VERSION"
```

**File 3: src-tauri/tauri.conf.json (line 4)**

```json
"version": "NEW_VERSION"
```

### Step 5: Verify Changes

After editing, read back the version from each file to confirm the update was successful.

### Step 6: Update Cargo.lock

Run cargo check to update Cargo.lock with the new version:

```bash
cd src-tauri && cargo check
```

This ensures Cargo.lock reflects the new version from Cargo.toml.

### Step 7: Stage and Commit Changes

Stage all modified files:

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock
```

Create commit with descriptive message:

```bash
git commit -m "bump version to NEW_VERSION"
```

### Step 8: Confirm Completion

Display a success message showing:

- **Old version**: e.g., 0.9.5
- **New version**: e.g., 0.9.6
- **Files updated**: All 4 files
- **Commit hash**: Short SHA from git log

Example output:

```
✓ Version bumped successfully!

Old version: 0.9.5
New version: 0.9.6

Files updated:
- package.json
- src-tauri/Cargo.toml
- src-tauri/tauri.conf.json
- src-tauri/Cargo.lock

Committed: abc1234 "bump version to 0.9.6"
```

## Error Handling

### Version Parsing Errors

If the current version cannot be read or parsed:

- Show clear error message with the invalid version string
- Do not proceed with any file updates
- Suggest manual verification of package.json

### File Update Errors

If any file update fails:

- Stop immediately (do not proceed to git operations)
- Show which file failed and why
- List files that were already modified (need manual revert)

### Git Operation Errors

If staging or committing fails:

- Show the git error message
- Explain what state the files are in
- Suggest next steps (e.g., check git status, resolve conflicts)

### Cargo Check Errors

If cargo check fails:

- Show the cargo error output
- Note that Cargo.lock may not be updated
- Suggest running `cargo check` manually to diagnose

## Best Practices

1. **Always verify** current version before calculating new version
2. **Never guess** version numbers - always read from package.json
3. **Update files atomically** - if one fails, don't commit partial changes
4. **Run cargo check** before committing to ensure Cargo.lock is consistent
5. **Use meaningful commit messages** that clearly state the new version

## Example Usage

**User request**: "increment version"

- Read current: 0.9.5
- Calculate new: 0.9.6 (patch)
- Update all files
- Commit: "bump version to 0.9.6"

**User request**: "bump minor version"

- Read current: 0.9.5
- Calculate new: 0.10.0 (minor)
- Update all files
- Commit: "bump version to 0.10.0"

**User request**: "increment-version major"

- Read current: 0.9.5
- Calculate new: 1.0.0 (major)
- Update all files
- Commit: "bump version to 1.0.0"
