import { buildProjectMachine } from '../buildProjectMachine'
import { useMachine } from '@xstate/react'
import { useEffect, useMemo, useRef } from 'react'

import {
  listenCopyProgress,
  listenCopyComplete,
  listenCopyFileError,
  listenCopyCompleteWithErrors
} from '../api'

import type { CopyCompleteWithErrors } from '../types'

/**
 * Hook that manages the BuildProject state machine and connects it to Tauri events
 */
export function useBuildProjectMachine() {
  const [state, send] = useMachine(buildProjectMachine)
  const listenersSetup = useRef(false)

  // Set up Tauri event listeners to feed events into the state machine

  useEffect(() => {
    if (listenersSetup.current) return
    listenersSetup.current = true

    let unlistenProgress: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null
    let unlistenFileError: (() => void) | null = null
    let unlistenCompleteWithErrors: (() => void) | null = null
    let isMounted = true

    const setupListeners = async () => {
      try {
        // Listen for copy progress events
        unlistenProgress = await listenCopyProgress((event) => {
          if (!isMounted) return
          send({ type: 'COPY_PROGRESS', progress: event.payload })
        })

        // Listen for individual file copy errors
        // Individual errors are logged by the backend; the final error state
        // will be set by copy_complete_with_errors
        unlistenFileError = await listenCopyFileError(() => {
          // Event received - errors accumulated and reported in copy_complete_with_errors
        })

        // Listen for copy complete with errors (partial failure)
        unlistenCompleteWithErrors = await listenCopyCompleteWithErrors((event) => {
          if (!isMounted) return
          const { failure_count, success_count, total_files, failed_files } =
            event.payload as CopyCompleteWithErrors

          // Build descriptive error message
          const failedFileNames = failed_files
            .map((f) => f.file.split('/').pop())
            .join(', ')

          const errorMessage =
            `Copy completed with errors: ${failure_count} of ${total_files} files failed. ` +
            `Successfully copied: ${success_count}. ` +
            `Failed files: ${failedFileNames}`

          send({ type: 'COPY_ERROR', error: errorMessage })
        })

        // Listen for copy complete events (full success)
        unlistenComplete = await listenCopyComplete(() => {
          if (!isMounted) return
          send({ type: 'COPY_COMPLETE' })
        })
      } catch {
        // Silently handle listener setup errors
      }
    }

    setupListeners()

    return () => {
      isMounted = false
      listenersSetup.current = false

      setTimeout(() => {
        try {
          if (unlistenProgress) unlistenProgress()
          if (unlistenComplete) unlistenComplete()
          if (unlistenFileError) unlistenFileError()
          if (unlistenCompleteWithErrors) unlistenCompleteWithErrors()
        } catch {
          // Silently handle cleanup errors
        }
      }, 0)
    }
  }, [])

  return useMemo(
    () => ({
      state,
      send,
      // Derived state for convenience
      isIdle: state.matches('idle'),
      isValidating: state.matches('validating'),
      isCreatingFolders: state.matches('creatingFolders'),
      isSavingBreadcrumbs: state.matches('savingBreadcrumbs'),
      isCopyingFiles: state.matches('copyingFiles'),
      isCreatingTemplate: state.matches('creatingTemplate'),
      isShowingSuccess: state.matches('showingSuccess'),
      isCompleted: state.matches('completed'),
      isError: state.matches('error'),
      // Loading states - don't include creatingTemplate so success card can show
      isLoading:
        state.matches('validating') ||
        state.matches('creatingFolders') ||
        state.matches('savingBreadcrumbs') ||
        state.matches('copyingFiles'),
      // Context accessors
      copyProgress: state.context.copyProgress,
      error: state.context.error,
      projectFolder: state.context.projectFolder
    }),
    [state, send]
  )
}
