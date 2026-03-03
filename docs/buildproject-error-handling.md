# BuildProject Error Handling

This document describes the error handling capabilities in the BuildProject workflow, including what errors are caught, how users are notified, and troubleshooting guidance.

## Overview

The BuildProject workflow includes comprehensive error handling to prevent silent failures and provide users with actionable feedback when issues occur during file copy operations.

## Error Detection Mechanisms

### 1. Pre-flight Disk Space Validation

Before starting any file copy operation, the system checks if sufficient disk space is available.

**How it works:**
- Calculates total size of all files to be copied using `stat()` on each file
- Calls `check_disk_space` Tauri command with destination path and required bytes
- Uses the `fs2` crate to check available space on the target volume

**User Experience:**
- If insufficient space: Copy is blocked before it starts
- Error message shows required space (e.g., "Need 2.5 GB to copy files")
- User can free space or choose a different destination

### 2. Timeout Protection for File Operations

Each file copy operation has a configurable timeout (default: 30 seconds) to prevent indefinite hangs on network drives.

**How it works:**
- A watchdog thread monitors copy progress
- If no progress is made within the timeout period, operation is aborted
- The `copy_error` event is emitted with timeout details
- Partially copied files are tracked for user review

**Configuration:**
- Default timeout: 30 seconds per file operation
- Can be adjusted via `timeout_secs` parameter in `move_files` command

**User Experience:**
- Error message shows which file timed out and elapsed time
- Suggestions include checking network connection and drive accessibility

### 3. Partial Failure Detection

After file copy completes, the system validates that all expected files were successfully copied.

**How it works:**
- Backend emits `copy_complete` event with array of successfully copied files
- State machine compares `movedFiles.length` against `expectedFiles.length`
- If counts don't match, transitions to error state with partial failure message

**User Experience:**
- Error section shows file statistics (Total / Succeeded / Failed)
- List of failed files displayed with names and camera assignments
- "Try Again" button to reset and retry

## Error Events

The following Tauri events are used for error handling:

| Event | Payload | Description |
|-------|---------|-------------|
| `copy_progress` | `number` (0-100) | Progress percentage during copy |
| `copy_complete` | `string[]` | Array of successfully copied file paths |
| `copy_error` | `string` | Error message (e.g., timeout, permission denied) |

## User Interface

### Error Section Component

When an error occurs, the ErrorSection component displays:

1. **Error Icon & Message**: Clear indication of what went wrong
2. **File Statistics**: Visual grid showing Total / Succeeded / Failed counts
3. **Failed Files List**: Scrollable list with file names and camera numbers
4. **Remediation Suggestions**: Context-aware tips based on error type
5. **Try Again Button**: Reset workflow to retry operation

### Toast Notifications

Brief toast notification appears when error occurs, directing user to detailed error section below.

## Troubleshooting Guide

### Permission Errors

**Symptoms:**
- Error message mentions "permission denied" or "access denied"
- Some or all files fail to copy

**Solutions:**
1. Check file permissions on source files
2. Ensure source files are not open in another application
3. Verify write permissions on destination folder
4. On macOS, check System Preferences > Security & Privacy > Files and Folders

### Disk Space Errors

**Symptoms:**
- Error before copy starts: "Insufficient disk space"
- Error during copy: "Disk full" or similar

**Solutions:**
1. Check available space on destination drive
2. Free up space by removing unnecessary files
3. Choose a different destination with more available space
4. For large projects, consider copying in batches

### Network Drive Timeouts

**Symptoms:**
- Error message mentions "timeout"
- Copy hangs then fails after 30 seconds
- Happens intermittently with network/external drives

**Solutions:**
1. Check network connection stability
2. Verify the network drive is mounted and accessible
3. Try copying to a local drive first, then moving to network
4. Check if drive went to sleep (especially for external USB drives)
5. For WiFi-connected NAS: try wired Ethernet connection

### Partial Copy Failures

**Symptoms:**
- "Partial copy failure: only X of Y files were copied"
- Some files in the failed files list

**Solutions:**
1. Check individual file permissions on failed files
2. Ensure no files are locked by other applications
3. Verify file names don't contain unsupported characters
4. Try copying failed files manually to identify specific issues
5. Check if source media (SD card, external drive) has read errors

## Architecture

### Backend Components

- **`file_copy.rs`**: Core copy logic with timeout mechanism
  - `CopyError` enum with `Io` and `Timeout` variants
  - `copy_file_with_timeout()` function with watchdog thread
  - `DEFAULT_TIMEOUT_SECS` constant (30 seconds)

- **`file_ops.rs`**: Tauri commands
  - `check_disk_space()`: Pre-flight disk space validation
  - `move_files()`: Main copy command with optional timeout parameter

### Frontend Components

- **`buildProjectMachine.ts`**: XState state machine
  - `movedFiles` context for tracking successful copies
  - `allFilesCopied` guard for validation
  - `storePartialCopyError` action for detailed error messages

- **`useBuildProjectMachine.ts`**: React hook
  - Event listeners for `copy_progress`, `copy_complete`, `copy_error`
  - Exposes `expectedFiles` and `movedFiles` for UI

- **`ErrorSection.tsx`**: Error display component
  - File statistics grid
  - Failed files list
  - Context-aware remediation suggestions

## Testing

E2E tests for error scenarios are in `tests/e2e/buildproject/partial-failures.spec.ts`:

- Partial failure detection (7 of 10 files)
- Complete failure (all files fail)
- Success case validation
- Edge cases (first file, last file, scattered failures)

Run tests with:
```bash
bun run test:e2e:buildproject
```
