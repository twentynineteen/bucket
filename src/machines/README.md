# BuildProject State Machine

This directory contains the XState state machine that manages the BuildProject workflow.

## Overview

The BuildProject flow has been refactored to use XState for predictable, race-condition-free state management. Previously, the success card wouldn't appear due to timing issues between `loading` and `completed` states. The state machine eliminates this by making state transitions explicit and sequential.

## State Flow

```
idle
  ↓ (START_PROJECT event)
validating (check inputs)
  ↓ (VALIDATION_SUCCESS)
creatingFolders (mkdir project structure)
  ↓ (FOLDERS_CREATED)
savingBreadcrumbs (write breadcrumbs.json)
  ↓ (BREADCRUMBS_SAVED)
copyingFiles (move files with progress tracking)
  ↓ (COPY_COMPLETE from Tauri event)
creatingTemplate (copy premiere template)
  ↓ (TEMPLATE_COMPLETE)
showingSuccess (SUCCESS CARD APPEARS HERE ✓)
  ↓ (DIALOG_COMPLETE)
completed
  ↓ (RESET event)
idle
```

## Key Files

### `buildProjectMachine.ts`

State machine definition with:

- **States**: All possible states the project creation can be in
- **Events**: Triggers for state transitions
- **Context**: Data that persists (title, files, progress, etc.)
- **Actions**: Functions that run during transitions (updateProgress, storeError, etc.)

### `useBuildProjectMachine.ts`

React hook that:

- Creates a machine instance with `useMachine()`
- Sets up Tauri event listeners (`copy_progress`, `copy_complete`)
- Feeds Tauri events into the machine via `send()`
- Exports convenient state checks (`isShowingSuccess`, `isLoading`, etc.)

### `useCreateProjectWithMachine.ts`

Refactored project creation hook that:

- Sends events to the machine instead of managing state
- Executes each step (validation, folders, breadcrumbs, file moving)
- NO duplicate event listeners (unlike old `useCreateProject`)

### `usePostProjectCompletion.ts`

Handles post-completion tasks:

- Watches for `isCreatingTemplate` state → creates premiere template
- Watches for `isShowingSuccess` state → shows dialog
- Uses `useEffect` with state flags to prevent duplicate execution

## Why This Fixes the Success Card Bug

**Old approach:**

1. Two separate hooks listening to `copy_complete` event
2. `useCreateProject` runs template creation (sets `loading = true`)
3. `useCopyProgress` updates `completed = true`
4. `useProjectCompletion` checks `completed && !loading` → **FAILS because loading = true**
5. Success card never appears

**New approach (XState):**

1. Single event listener in `useBuildProjectMachine`
2. `copy_complete` → machine transitions to `creatingTemplate` state
3. Template creation finishes → machine transitions to `showingSuccess` state
4. Success card appears because `isShowingSuccess = true` (atomic state check)
5. No race conditions, no timing issues

## Debugging

To visualize the state machine in development:

1. Install [@xstate/inspect](https://stately.ai/docs/inspector)
2. Add to `main.tsx`:

   ```ts
   import { inspect } from '@xstate/inspect'

   inspect({ iframe: false })
   ```

3. Open browser devtools → XState tab
4. See real-time state transitions

## Migration Notes

- **Old hooks still present** for other pages (Baker, UploadSprout, etc.)
- `BuildProject.old.tsx` contains the previous implementation
- Can gradually migrate other workflows to XState if beneficial
- Keep `useCopyProgress` for backward compatibility with other pages
