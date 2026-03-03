/**
 * useBuildProject Hook
 *
 * Main orchestration hook for the BuildProject workflow using XState v5.
 * Manages the state machine lifecycle, Tauri event listeners, and provides
 * a clean API for components to interact with the build process.
 *
 * @example
 * const {
 *   state,
 *   context,
 *   progress,
 *   startBuild,
 *   cancel,
 *   reset,
 *   isBuilding,
 *   isComplete,
 *   hasError
 * } = useBuildProject()
 *
 * // Start a build
 * startBuild({
 *   projectName: 'My Project',
 *   destinationPath: '/Users/john/Videos',
 *   files: footageFiles,
 *   numCameras: 3,
 *   username: 'john'
 * })
 *
 * // Cancel the current operation
 * cancel()
 *
 * // Reset to initial state
 * reset()
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useMachine } from '@xstate/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { logger } from '@/utils/logger'

import {
  buildProjectMachine,
  type BuildProjectContext,
  type BuildProjectInput
} from '../machine/buildProjectMachine'
import type {
  BreadcrumbsStageData,
  FileTransferProgress,
  FileTransferStageData,
  FoldersStageData,
  StageName,
  StageResult,
  TemplateStageData,
  ValidationStageData
} from '../types'

// =============================================================================
// Types
// =============================================================================

/**
 * Stage results collected during the build process
 */
export interface StageResults {
  validation?: StageResult<ValidationStageData>
  folders?: StageResult<FoldersStageData>
  template?: StageResult<TemplateStageData>
  breadcrumbs?: StageResult<BreadcrumbsStageData>
  'file-transfer'?: StageResult<FileTransferStageData>
}

/**
 * Progress information for the current build operation
 */
export interface BuildProgress {
  /** Current stage being executed */
  currentStage: StageName | 'idle' | 'success' | 'error' | 'cancelled'

  /** Overall progress percentage (0-100) */
  percentage: number

  /** File transfer specific progress (only during file-transfer stage) */
  fileTransfer?: FileTransferProgress

  /** Number of completed stages */
  completedStages: number

  /** Total number of stages */
  totalStages: number
}

/**
 * Return type of the useBuildProject hook
 */
export interface UseBuildProjectReturn {
  /** Current XState machine state */
  state: ReturnType<typeof useMachine<typeof buildProjectMachine>>[0]

  /** Machine context with all workflow data */
  context: BuildProjectContext

  /** Progress information for UI display */
  progress: BuildProgress

  /** Start the build workflow with given configuration */
  startBuild: (config: BuildProjectInput) => void

  /** Cancel the current operation */
  cancel: () => void

  /** Reset the machine to idle state */
  reset: () => void

  /** Retry after an error (only for recoverable errors) */
  retry: () => void

  /** Stage results collected during execution */
  stageResults: StageResults

  // Convenience boolean flags
  /** True if the workflow is currently executing */
  isBuilding: boolean

  /** True if the workflow completed successfully */
  isComplete: boolean

  /** True if the workflow encountered an error */
  hasError: boolean

  /** True if the workflow was cancelled */
  isCancelled: boolean

  /** True if the machine is in idle state */
  isIdle: boolean

  /** True if the current error can be retried */
  canRetry: boolean
}

// =============================================================================
// Constants
// =============================================================================

/** Number of stages in the workflow */
const TOTAL_STAGES = 5

/** Stage order for progress calculation */
const STAGE_ORDER: StageName[] = [
  'validation',
  'folders',
  'template',
  'breadcrumbs',
  'file-transfer'
]

/** Map machine state names to stage names */
const STATE_TO_STAGE_MAP: Record<string, StageName | null> = {
  idle: null,
  validating: 'validation',
  creatingFolders: 'folders',
  copyingTemplate: 'template',
  savingBreadcrumbs: 'breadcrumbs',
  transferringFiles: 'file-transfer',
  success: null,
  error: null,
  cancelled: null
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useBuildProject(): UseBuildProjectReturn {
  // Initialize the XState machine
  const [state, send] = useMachine(buildProjectMachine)

  // Track event listeners for cleanup
  const listenersRef = useRef<{
    progress: UnlistenFn | null
    complete: UnlistenFn | null
  }>({
    progress: null,
    complete: null
  })

  // Track if listeners are set up
  const isListenerSetup = useRef(false)

  // Track stage results using state to avoid ref access during render
  const [stageResults, setStageResults] = useState<StageResults>({})

  // ==========================================================================
  // Tauri Event Listeners
  // ==========================================================================

  useEffect(() => {
    // Prevent duplicate listener setup
    if (isListenerSetup.current) return
    isListenerSetup.current = true

    let isMounted = true
    // Store listeners locally for cleanup access
    let progressUnlisten: UnlistenFn | null = null
    let completeUnlisten: UnlistenFn | null = null

    const setupListeners = async () => {
      try {
        // Listen for file transfer progress events from Tauri backend
        progressUnlisten = await listen<number>('copy_progress', (event) => {
          if (!isMounted) return
          send({ type: 'PROGRESS_UPDATE', progress: event.payload })
        })
        listenersRef.current.progress = progressUnlisten

        // Listen for file transfer completion events
        // Note: The machine handles completion via the promise resolution
        // This listener is for additional side effects if needed
        completeUnlisten = await listen<string[]>('copy_complete', () => {
          if (!isMounted) return
          // The transferFiles actor will complete and transition the machine
        })
        listenersRef.current.complete = completeUnlisten
      } catch (error) {
        // Log but don't throw - listeners are optional enhancement
        logger.warn('[useBuildProject] Failed to setup Tauri listeners:', error)
      }
    }

    setupListeners()

    // Cleanup listeners on unmount
    return () => {
      isMounted = false
      isListenerSetup.current = false

      // Defer cleanup to avoid race conditions
      setTimeout(() => {
        try {
          progressUnlisten?.()
          completeUnlisten?.()
        } catch {
          // Silently ignore cleanup errors
        }
      }, 0)
    }
  }, [send])

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  /**
   * Start the build workflow with the given configuration
   */
  const startBuild = useCallback(
    (config: BuildProjectInput) => {
      // Reset stage results for new build
      setStageResults({})

      send({
        type: 'START',
        input: config
      })
    },
    [send]
  )

  /**
   * Cancel the current operation
   */
  const cancel = useCallback(() => {
    send({ type: 'CANCEL' })
  }, [send])

  /**
   * Reset the machine to idle state
   */
  const reset = useCallback(() => {
    // Clear stage results
    setStageResults({})

    send({ type: 'RESET' })
  }, [send])

  /**
   * Retry after an error (only works for recoverable errors)
   */
  const retry = useCallback(() => {
    send({ type: 'RETRY' })
  }, [send])

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  /**
   * Calculate progress information from current state
   */
  const progress = useMemo((): BuildProgress => {
    const context = state.context
    const currentStateValue = state.value as string

    // Map state to stage
    const currentStage = STATE_TO_STAGE_MAP[currentStateValue]
    const displayStage: BuildProgress['currentStage'] =
      currentStage || (currentStateValue as 'idle' | 'success' | 'error' | 'cancelled')

    // Calculate completed stages based on current state
    let completedStages = 0
    if (currentStage) {
      const currentIndex = STAGE_ORDER.indexOf(currentStage)
      completedStages = currentIndex >= 0 ? currentIndex : 0
    } else if (currentStateValue === 'success') {
      completedStages = TOTAL_STAGES
    }

    // Calculate overall percentage
    let percentage = 0
    if (currentStateValue === 'success') {
      percentage = 100
    } else if (currentStage) {
      const baseProgress = (completedStages / TOTAL_STAGES) * 100

      // Add partial progress for file transfer stage
      if (currentStage === 'file-transfer' && context.progress > 0) {
        const stageContribution = (1 / TOTAL_STAGES) * context.progress
        percentage = Math.min(99, baseProgress + stageContribution)
      } else {
        percentage = baseProgress
      }
    }

    return {
      currentStage: displayStage,
      percentage: Math.round(percentage),
      completedStages,
      totalStages: TOTAL_STAGES,
      // Include file transfer progress if available
      fileTransfer:
        currentStage === 'file-transfer'
          ? {
              operationId: context.operationId || '',
              currentFile: '',
              filesCompleted: 0,
              totalFiles: context.files.length,
              bytesTransferred: 0,
              totalBytes: 0,
              percentage: context.progress,
              bytesPerSecond: 0,
              estimatedTimeRemaining: 0
            }
          : undefined
    }
  }, [state])

  /**
   * Boolean convenience flags for UI state
   */
  const isBuilding = useMemo(() => {
    const buildingStates = [
      'validating',
      'creatingFolders',
      'copyingTemplate',
      'savingBreadcrumbs',
      'transferringFiles'
    ]
    return buildingStates.includes(state.value as string)
  }, [state.value])

  const isComplete = state.matches('success')
  const hasError = state.matches('error')
  const isCancelled = state.matches('cancelled')
  const isIdle = state.matches('idle')

  /**
   * Check if current error can be retried
   */
  const canRetry = useMemo(() => {
    if (!hasError) return false
    const error = state.context.error
    // User cancellation errors are not retryable
    return error !== null && error !== 'Project creation cancelled by user.'
  }, [hasError, state.context.error])

  // ==========================================================================
  // Return Hook API
  // ==========================================================================

  return useMemo(
    () => ({
      state,
      context: state.context,
      progress,
      startBuild,
      cancel,
      reset,
      retry,
      stageResults,
      isBuilding,
      isComplete,
      hasError,
      isCancelled,
      isIdle,
      canRetry
    }),
    [
      state,
      progress,
      startBuild,
      cancel,
      reset,
      retry,
      stageResults,
      isBuilding,
      isComplete,
      hasError,
      isCancelled,
      isIdle,
      canRetry
    ]
  )
}
