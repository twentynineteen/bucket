import { buildProjectMachine } from '@machines/buildProjectMachine'
import { listen } from '@tauri-apps/api/event'
import { useMachine } from '@xstate/react'
import { useEffect, useMemo, useRef } from 'react'

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
    let unlistenError: (() => void) | null = null
    let isMounted = true

    const setupListeners = async () => {
      try {
        // Listen for copy progress events
        unlistenProgress = await listen<number>('copy_progress', (event) => {
          if (!isMounted) return
          send({ type: 'COPY_PROGRESS', progress: event.payload })
        })

        // Listen for copy complete events
        unlistenComplete = await listen<string[]>('copy_complete', (event) => {
          if (!isMounted) return
          send({ type: 'COPY_COMPLETE', movedFiles: event.payload })
        })

        // Listen for copy error events (e.g., timeout errors from backend)
        unlistenError = await listen<string>('copy_error', (event) => {
          if (!isMounted) return
          send({ type: 'COPY_ERROR', error: event.payload })
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
          if (unlistenError) unlistenError()
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
      projectFolder: state.context.projectFolder,
      // File tracking for error display
      expectedFiles: state.context.files,
      movedFiles: state.context.movedFiles
    }),
    [state, send]
  )
}
