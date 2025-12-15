import type { FootageFile } from '@hooks/useCameraAutoRemap'
import { assign, setup } from 'xstate'

// Context type - data that persists through state transitions
export interface BuildProjectContext {
  // Project configuration
  title: string
  numCameras: number
  files: FootageFile[]
  selectedFolder: string
  username: string

  // Progress tracking
  copyProgress: number

  // Project paths
  projectFolder: string | null

  // Error handling
  error: string | null
}

// Event types - all possible events that can occur
export type BuildProjectEvent =
  | { type: 'START_PROJECT' }
  | { type: 'VALIDATION_SUCCESS'; projectFolder: string }
  | { type: 'VALIDATION_ERROR'; error: string }
  | { type: 'FOLDERS_CREATED' }
  | { type: 'FOLDERS_ERROR'; error: string }
  | { type: 'BREADCRUMBS_SAVED' }
  | { type: 'BREADCRUMBS_ERROR'; error: string }
  | { type: 'FILES_MOVING' }
  | { type: 'COPY_PROGRESS'; progress: number }
  | { type: 'COPY_COMPLETE' }
  | { type: 'COPY_ERROR'; error: string }
  | { type: 'TEMPLATE_COMPLETE' }
  | { type: 'TEMPLATE_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'UPDATE_CONFIG'; config: Partial<BuildProjectContext> }

// State machine definition
export const buildProjectMachine = setup({
  types: {
    context: {} as BuildProjectContext,
    events: {} as BuildProjectEvent
  },
  actions: {
    // Update copy progress in context
    updateProgress: assign({
      copyProgress: ({ event }) => (event.type === 'COPY_PROGRESS' ? event.progress : 0)
    }),

    // Store project folder path
    storeProjectFolder: assign({
      projectFolder: ({ event }) =>
        event.type === 'VALIDATION_SUCCESS' ? event.projectFolder : null
    }),

    // Store error message
    storeError: assign({
      error: ({ event }) => {
        if (
          event.type === 'VALIDATION_ERROR' ||
          event.type === 'FOLDERS_ERROR' ||
          event.type === 'BREADCRUMBS_ERROR' ||
          event.type === 'COPY_ERROR' ||
          event.type === 'TEMPLATE_ERROR'
        ) {
          return event.error
        }
        return null
      }
    }),

    // Reset progress state (preserves project configuration like title, files, etc.)
    resetContext: assign({
      copyProgress: 0,
      projectFolder: null,
      error: null
    }),

    // Update configuration (title, files, etc.)
    updateConfig: assign(({ event, context }) => {
      if (event.type === 'UPDATE_CONFIG') {
        return { ...context, ...event.config }
      }
      return context
    })
  }
}).createMachine({
  id: 'buildProject',
  initial: 'idle',
  context: {
    title: '',
    numCameras: 1,
    files: [],
    selectedFolder: '',
    username: '',
    copyProgress: 0,
    projectFolder: null,
    error: null
  },
  states: {
    idle: {
      on: {
        START_PROJECT: 'validating',
        UPDATE_CONFIG: {
          actions: 'updateConfig'
        },
        // Allow direct workflow entry from idle (when createProject is called directly)
        VALIDATION_SUCCESS: {
          target: 'creatingFolders',
          actions: 'storeProjectFolder'
        }
      }
    },

    validating: {
      on: {
        VALIDATION_SUCCESS: {
          target: 'creatingFolders',
          actions: 'storeProjectFolder'
        },
        VALIDATION_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },

    creatingFolders: {
      on: {
        FOLDERS_CREATED: 'savingBreadcrumbs',
        FOLDERS_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },

    savingBreadcrumbs: {
      on: {
        BREADCRUMBS_SAVED: 'copyingFiles',
        BREADCRUMBS_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },

    copyingFiles: {
      on: {
        COPY_PROGRESS: {
          actions: 'updateProgress'
        },
        COPY_COMPLETE: {
          target: 'creatingTemplate'
        },
        COPY_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },

    creatingTemplate: {
      on: {
        TEMPLATE_COMPLETE: {
          target: 'showingSuccess'
        },
        TEMPLATE_ERROR: {
          target: 'error',
          actions: 'storeError'
        }
      }
    },

    showingSuccess: {
      // Success card is visible in this state
      // Stays in this state until user manually resets
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        },
        // Allow starting a new project from showingSuccess state
        VALIDATION_SUCCESS: {
          target: 'creatingFolders',
          actions: ['resetContext', 'storeProjectFolder']
        }
      }
    },

    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetContext'
        }
      }
    }
  }
})
