/**
 * BuildProject State Machine (XState v5 Actor Pattern)
 *
 * This state machine orchestrates the complete project creation workflow,
 * managing validation, folder creation, template copying, breadcrumbs saving,
 * and file transfer operations with progress tracking.
 *
 * Uses XState v5 actor pattern with fromPromise for async operations.
 */
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { assign, fromPromise, setup } from 'xstate'

// =============================================================================
// Types
// =============================================================================

/**
 * File representation for footage files with camera assignment
 */
export interface FootageFile {
  file: {
    path: string
    name: string
  }
  camera: number
}

/**
 * Breadcrumb data structure for project metadata
 */
export interface Breadcrumb {
  projectTitle: string
  numberOfCameras: number
  files: Array<{
    camera: number
    name: string
    path: string
  }>
  parentFolder: string
  createdBy: string
  creationDateTime: string
  folderSizeBytes?: number
}

/**
 * Input parameters for starting the build project workflow
 */
export interface BuildProjectInput {
  projectName: string
  destinationPath: string
  files: FootageFile[]
  numCameras: number
  username: string
}

/**
 * Context for the build project state machine
 */
export interface BuildProjectContext {
  // Input configuration
  projectName: string
  destinationPath: string
  files: FootageFile[]
  numCameras: number
  username: string

  // Workflow state
  currentStage:
    | 'idle'
    | 'validating'
    | 'creatingFolders'
    | 'copyingTemplate'
    | 'savingBreadcrumbs'
    | 'transferringFiles'
    | 'success'
    | 'error'
    | 'cancelled'
  progress: number
  operationId: string | null

  // Results
  projectFolder: string | null
  breadcrumbs: Breadcrumb | null

  // Error handling
  error: string | null
  lastFailedStage: string | null
}

/**
 * Events for the build project state machine
 */
export type BuildProjectEvent =
  | { type: 'START'; input: BuildProjectInput }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'PROGRESS_UPDATE'; progress: number }

// =============================================================================
// Actor Input Types
// =============================================================================

interface ValidateInputParams {
  projectName: string
  destinationPath: string
  files: FootageFile[]
}

interface CreateFoldersParams {
  projectFolder: string
  numCameras: number
}

interface CopyTemplateParams {
  projectFolder: string
  projectName: string
}

interface SaveBreadcrumbsParams {
  projectFolder: string
  breadcrumbs: Breadcrumb
}

interface TransferFilesParams {
  files: FootageFile[]
  projectFolder: string
}

// =============================================================================
// Actor Implementations
// =============================================================================

/**
 * Validates input parameters and checks for existing folders
 * Returns the computed project folder path
 */
const validateInput = fromPromise<string, ValidateInputParams>(async ({ input }) => {
  const { projectName, destinationPath, files } = input

  // Validate destination folder
  if (!destinationPath) {
    throw new Error('Please select a destination folder.')
  }

  // Validate project name
  if (!projectName.trim()) {
    throw new Error('Please enter a project title.')
  }

  // Warn about empty files (non-blocking with user confirmation)
  if (files.length === 0) {
    const confirmNoFiles = await confirm(
      'No files have been added to the drag and drop section. Are you sure you want to create the project?'
    )
    if (!confirmNoFiles) {
      throw new Error('Project creation cancelled by user.')
    }
  }

  const projectFolder = `${destinationPath}/${projectName.trim()}`

  // Check if folder exists
  if (await exists(projectFolder)) {
    const overwrite = await confirm(
      `The folder "${projectFolder}" already exists. Do you want to overwrite it?`
    )
    if (!overwrite) {
      throw new Error('Project creation cancelled by user.')
    }
    await remove(projectFolder, { recursive: true })
  }

  return projectFolder
})

/**
 * Creates the project folder structure with camera subfolders
 */
const createFolders = fromPromise<void, CreateFoldersParams>(async ({ input }) => {
  const { projectFolder, numCameras } = input

  // Create main project folder
  await mkdir(projectFolder, { recursive: true })

  // Create camera folders sequentially
  for (let cam = 1; cam <= numCameras; cam++) {
    await mkdir(`${projectFolder}/Footage/Camera ${cam}`, { recursive: true })
  }

  // Create other folders in parallel
  await Promise.all([
    mkdir(`${projectFolder}/Graphics`, { recursive: true }),
    mkdir(`${projectFolder}/Renders`, { recursive: true }),
    mkdir(`${projectFolder}/Projects`, { recursive: true }),
    mkdir(`${projectFolder}/Scripts`, { recursive: true })
  ])
})

/**
 * Copies the Premiere Pro project template to the project folder
 */
const copyTemplate = fromPromise<void, CopyTemplateParams>(async ({ input }) => {
  const { projectFolder, projectName } = input
  const filePath = `${projectFolder}/Projects/`

  await invoke('copy_premiere_project', {
    destinationFolder: filePath,
    newTitle: projectName
  })
})

/**
 * Saves breadcrumbs.json metadata file
 */
const saveBreadcrumbs = fromPromise<void, SaveBreadcrumbsParams>(async ({ input }) => {
  const { projectFolder, breadcrumbs } = input

  await writeTextFile(
    `${projectFolder}/breadcrumbs.json`,
    JSON.stringify(breadcrumbs, null, 2)
  )
})

/**
 * Transfers files to camera folders
 * Note: Progress events are emitted by the Tauri backend and handled separately
 */
const transferFiles = fromPromise<void, TransferFilesParams>(async ({ input }) => {
  const { files, projectFolder } = input

  const filesToMove: [string, number][] = files.map(({ file, camera }) => [
    file.path,
    camera
  ])

  // This invokes the Tauri backend which emits copy_progress and copy_complete events
  await invoke('move_files', {
    files: filesToMove,
    baseDest: projectFolder
  })
})

// =============================================================================
// State Machine Definition
// =============================================================================

/**
 * Build Project State Machine using XState v5 actor pattern
 *
 * States:
 * - idle: Initial state, waiting for START event
 * - validating: Validating input parameters
 * - creatingFolders: Creating project folder structure
 * - copyingTemplate: Copying Premiere Pro template
 * - savingBreadcrumbs: Writing breadcrumbs.json metadata
 * - transferringFiles: File transfer with progress tracking
 * - success: Completed successfully
 * - error: Failed (with retry capability)
 * - cancelled: User cancelled the operation
 */
export const buildProjectMachine = setup({
  types: {} as {
    context: BuildProjectContext
    events: BuildProjectEvent
  },
  actors: {
    validateInput,
    createFolders,
    copyTemplate,
    saveBreadcrumbs,
    transferFiles
  },
  actions: {
    // Initialize context with input parameters
    initializeContext: assign(({ event }) => {
      if (event.type !== 'START') return {}
      const { input } = event
      return {
        projectName: input.projectName,
        destinationPath: input.destinationPath,
        files: input.files,
        numCameras: input.numCameras,
        username: input.username,
        currentStage: 'validating' as const,
        progress: 0,
        operationId: crypto.randomUUID(),
        error: null,
        lastFailedStage: null
      }
    }),

    // Store project folder path after validation
    storeProjectFolder: assign({
      projectFolder: (_, params: { projectFolder: string }) => params.projectFolder,
      currentStage: 'creatingFolders' as const
    }),

    // Update current stage
    setStage: assign({
      currentStage: (_, params: { stage: BuildProjectContext['currentStage'] }) =>
        params.stage
    }),

    // Update progress during file transfer
    updateProgress: assign({
      progress: ({ event }) => (event.type === 'PROGRESS_UPDATE' ? event.progress : 0)
    }),

    // Create breadcrumbs data
    createBreadcrumbs: assign(({ context }) => {
      const now = new Date()
      const breadcrumbs: Breadcrumb = {
        projectTitle: context.projectName.trim(),
        numberOfCameras: context.numCameras,
        files: context.files.map((f) => ({
          camera: f.camera,
          name: f.file.name,
          path: f.file.path
        })),
        parentFolder: context.destinationPath,
        createdBy: context.username || 'Unknown User',
        creationDateTime: now.toISOString()
      }
      return { breadcrumbs }
    }),

    // Store error and failed stage for retry
    storeError: assign({
      error: (_, params: { error: string }) => params.error,
      currentStage: 'error' as const,
      lastFailedStage: ({ context }) => context.currentStage
    }),

    // Mark as cancelled
    markCancelled: assign({
      currentStage: 'cancelled' as const,
      error: 'Operation cancelled by user'
    }),

    // Mark as success
    markSuccess: assign({
      currentStage: 'success' as const,
      progress: 100
    }),

    // Reset context for retry (preserves input configuration)
    resetForRetry: assign(({ context }) => ({
      currentStage: context.lastFailedStage || ('validating' as const),
      progress: 0,
      error: null
    })),

    // Full reset to initial state
    resetContext: assign({
      projectName: '',
      destinationPath: '',
      files: [] as FootageFile[],
      numCameras: 1,
      username: '',
      currentStage: 'idle' as const,
      progress: 0,
      operationId: null,
      projectFolder: null,
      breadcrumbs: null,
      error: null,
      lastFailedStage: null
    })
  },
  guards: {
    hasRetryableError: ({ context }) =>
      context.error !== null && context.error !== 'Project creation cancelled by user.'
  }
}).createMachine({
  id: 'buildProject',
  initial: 'idle',
  context: {
    projectName: '',
    destinationPath: '',
    files: [],
    numCameras: 1,
    username: '',
    currentStage: 'idle',
    progress: 0,
    operationId: null,
    projectFolder: null,
    breadcrumbs: null,
    error: null,
    lastFailedStage: null
  },

  states: {
    idle: {
      on: {
        START: {
          target: 'validating',
          actions: 'initializeContext'
        }
      }
    },

    validating: {
      invoke: {
        id: 'validateInput',
        src: 'validateInput',
        input: ({ context }) => ({
          projectName: context.projectName,
          destinationPath: context.destinationPath,
          files: context.files
        }),
        onDone: {
          target: 'creatingFolders',
          actions: assign({
            projectFolder: ({ event }) => event.output,
            currentStage: 'creatingFolders' as const
          })
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            currentStage: 'error' as const,
            lastFailedStage: 'validating' as const
          })
        }
      },
      on: {
        CANCEL: {
          target: 'cancelled',
          actions: 'markCancelled'
        }
      }
    },

    creatingFolders: {
      entry: assign({ currentStage: 'creatingFolders' as const }),
      invoke: {
        id: 'createFolders',
        src: 'createFolders',
        input: ({ context }) => ({
          projectFolder: context.projectFolder!,
          numCameras: context.numCameras
        }),
        onDone: {
          target: 'copyingTemplate',
          actions: assign({ currentStage: 'copyingTemplate' as const })
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            currentStage: 'error' as const,
            lastFailedStage: 'creatingFolders' as const
          })
        }
      },
      on: {
        CANCEL: {
          target: 'cancelled',
          actions: 'markCancelled'
        }
      }
    },

    copyingTemplate: {
      entry: assign({ currentStage: 'copyingTemplate' as const }),
      invoke: {
        id: 'copyTemplate',
        src: 'copyTemplate',
        input: ({ context }) => ({
          projectFolder: context.projectFolder!,
          projectName: context.projectName
        }),
        onDone: {
          target: 'savingBreadcrumbs',
          actions: [
            'createBreadcrumbs',
            assign({ currentStage: 'savingBreadcrumbs' as const })
          ]
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            currentStage: 'error' as const,
            lastFailedStage: 'copyingTemplate' as const
          })
        }
      },
      on: {
        CANCEL: {
          target: 'cancelled',
          actions: 'markCancelled'
        }
      }
    },

    savingBreadcrumbs: {
      entry: assign({ currentStage: 'savingBreadcrumbs' as const }),
      invoke: {
        id: 'saveBreadcrumbs',
        src: 'saveBreadcrumbs',
        input: ({ context }) => ({
          projectFolder: context.projectFolder!,
          breadcrumbs: context.breadcrumbs!
        }),
        onDone: {
          target: 'transferringFiles',
          actions: assign({ currentStage: 'transferringFiles' as const })
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            currentStage: 'error' as const,
            lastFailedStage: 'savingBreadcrumbs' as const
          })
        }
      },
      on: {
        CANCEL: {
          target: 'cancelled',
          actions: 'markCancelled'
        }
      }
    },

    transferringFiles: {
      entry: assign({ currentStage: 'transferringFiles' as const }),
      invoke: {
        id: 'transferFiles',
        src: 'transferFiles',
        input: ({ context }) => ({
          files: context.files,
          projectFolder: context.projectFolder!
        }),
        onDone: {
          target: 'success',
          actions: 'markSuccess'
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => String(event.error),
            currentStage: 'error' as const,
            lastFailedStage: 'transferringFiles' as const
          })
        }
      },
      on: {
        PROGRESS_UPDATE: {
          actions: 'updateProgress'
        },
        CANCEL: {
          target: 'cancelled',
          actions: 'markCancelled'
        }
      }
    },

    success: {
      entry: assign({
        currentStage: 'success' as const,
        progress: 100
      }),
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        },
        // Allow starting a new project from success state
        START: {
          target: 'validating',
          actions: 'initializeContext'
        }
      }
    },

    error: {
      entry: assign({ currentStage: 'error' as const }),
      on: {
        RETRY: {
          target: 'validating',
          guard: 'hasRetryableError',
          actions: 'resetForRetry'
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        },
        // Allow starting fresh from error state
        START: {
          target: 'validating',
          actions: 'initializeContext'
        }
      }
    },

    cancelled: {
      entry: assign({ currentStage: 'cancelled' as const }),
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        },
        // Allow starting a new project from cancelled state
        START: {
          target: 'validating',
          actions: 'initializeContext'
        }
      }
    }
  }
})

// Export the machine type for use with useMachine hook
export type BuildProjectMachine = typeof buildProjectMachine
