/**
 * Integration Test: US-02 — Build Project Happy Path
 *
 * As a video editor, when I navigate to /ingest/build, select footage files,
 * assign camera numbers, enter a project title, choose a destination folder,
 * and click "Create Project", then the XState machine progresses through all
 * stages and a complete project folder structure is created on disk.
 *
 * Tests the BuildProject state machine and useBuildProjectMachine hook.
 * Mocking strategy: mock the BuildProject api.ts layer; no direct @tauri-apps imports.
 */

import { buildProjectMachine } from '../../src/features/BuildProject/buildProjectMachine'
import { useBuildProjectMachine } from '../../src/features/BuildProject/hooks/useBuildProjectMachine'
import { act, renderHook } from '@testing-library/react'
import { createActor } from 'xstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the BuildProject api.ts — the hook imports from here for event listeners
vi.mock('../../src/features/BuildProject/api', () => ({
  listenCopyProgress: vi.fn().mockResolvedValue(vi.fn()),
  listenCopyComplete: vi.fn().mockResolvedValue(vi.fn()),
  listenCopyFileError: vi.fn().mockResolvedValue(vi.fn()),
  listenCopyCompleteWithErrors: vi.fn().mockResolvedValue(vi.fn()),
  moveFiles: vi.fn().mockResolvedValue(undefined),
  getFolderSize: vi.fn().mockResolvedValue(0),
  copyPremiereProject: vi.fn().mockResolvedValue(undefined),
  showConfirmationDialog: vi.fn().mockResolvedValue(undefined),
  openFileDialog: vi.fn().mockResolvedValue(null),
  openFolderDialog: vi.fn().mockResolvedValue(null),
  confirmDialog: vi.fn().mockResolvedValue(true),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(false),
  removePath: vi.fn().mockResolvedValue(undefined),
  writeTextFileContents: vi.fn().mockResolvedValue(undefined)
}))

// ============================================================================
// US-02: Machine State Transitions
// ============================================================================

describe('US-02 — BuildProject State Machine', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // US-02a — Full successful project creation flow
  describe('US-02a — Full successful project creation', () => {
    it('should start in idle state', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })

    it('should transition from idle to validating on START_PROJECT', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START_PROJECT' })

      expect(actor.getSnapshot().value).toBe('validating')
      actor.stop()
    })

    it('should progress through all stages on full successful workflow', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      // Start the project creation
      actor.send({ type: 'START_PROJECT' })
      expect(actor.getSnapshot().value).toBe('validating')

      // Validation succeeds → creatingFolders
      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/My Project' })
      expect(actor.getSnapshot().value).toBe('creatingFolders')
      expect(actor.getSnapshot().context.projectFolder).toBe('/projects/My Project')

      // Folders created → savingBreadcrumbs
      actor.send({ type: 'FOLDERS_CREATED' })
      expect(actor.getSnapshot().value).toBe('savingBreadcrumbs')

      // Breadcrumbs saved → copyingFiles
      actor.send({ type: 'BREADCRUMBS_SAVED' })
      expect(actor.getSnapshot().value).toBe('copyingFiles')

      // Files copied → creatingTemplate
      actor.send({ type: 'COPY_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('creatingTemplate')

      // Template created → showingSuccess
      actor.send({ type: 'TEMPLATE_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('showingSuccess')

      actor.stop()
    })

    it('should store project folder path in context during creatingFolders', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/output/Test Project' })

      expect(actor.getSnapshot().context.projectFolder).toBe('/output/Test Project')
      actor.stop()
    })

    it('should allow RESET from showingSuccess back to idle', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      // Progress to success
      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      actor.send({ type: 'FOLDERS_CREATED' })
      actor.send({ type: 'BREADCRUMBS_SAVED' })
      actor.send({ type: 'COPY_COMPLETE' })
      actor.send({ type: 'TEMPLATE_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('showingSuccess')

      // Reset back to idle
      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('idle')
      expect(actor.getSnapshot().context.projectFolder).toBeNull()
      expect(actor.getSnapshot().context.error).toBeNull()
      expect(actor.getSnapshot().context.copyProgress).toBe(0)

      actor.stop()
    })
  })

  // US-02b — Existing project folder (overwrite confirmation)
  describe('US-02b — Existing project folder overwrite', () => {
    it('should support VALIDATION_SUCCESS from idle (skip validating)', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      // Direct VALIDATION_SUCCESS from idle allows bypassing the validation state
      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Existing Project' })

      expect(actor.getSnapshot().value).toBe('creatingFolders')
      expect(actor.getSnapshot().context.projectFolder).toBe('/projects/Existing Project')
      actor.stop()
    })

    it('should support starting new project from showingSuccess state', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      // Reach success state
      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/First' })
      actor.send({ type: 'FOLDERS_CREATED' })
      actor.send({ type: 'BREADCRUMBS_SAVED' })
      actor.send({ type: 'COPY_COMPLETE' })
      actor.send({ type: 'TEMPLATE_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('showingSuccess')

      // Start a new project without resetting first
      actor.send({
        type: 'VALIDATION_SUCCESS',
        projectFolder: '/projects/Second'
      })
      expect(actor.getSnapshot().value).toBe('creatingFolders')
      expect(actor.getSnapshot().context.projectFolder).toBe('/projects/Second')
      expect(actor.getSnapshot().context.error).toBeNull()

      actor.stop()
    })
  })

  // US-02d — Missing destination folder (validation error)
  describe('US-02d — Validation error handling', () => {
    it('should transition to error state on VALIDATION_ERROR', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START_PROJECT' })
      actor.send({
        type: 'VALIDATION_ERROR',
        error: 'Please select a destination folder.'
      })

      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.error).toBe('Please select a destination folder.')
      actor.stop()
    })

    it('should transition to error state on FOLDERS_ERROR', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      actor.send({ type: 'FOLDERS_ERROR', error: 'Permission denied creating folders' })

      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.error).toBe('Permission denied creating folders')
      actor.stop()
    })

    it('should transition to error state on BREADCRUMBS_ERROR', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      actor.send({ type: 'FOLDERS_CREATED' })
      actor.send({ type: 'BREADCRUMBS_ERROR', error: 'Failed to write breadcrumbs.json' })

      expect(actor.getSnapshot().value).toBe('error')
      expect(actor.getSnapshot().context.error).toBe('Failed to write breadcrumbs.json')
      actor.stop()
    })

    it('should reset from error state on RESET', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START_PROJECT' })
      actor.send({ type: 'VALIDATION_ERROR', error: 'Missing destination' })
      expect(actor.getSnapshot().value).toBe('error')

      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('idle')
      expect(actor.getSnapshot().context.error).toBeNull()
      actor.stop()
    })

    it('should not transition from idle on invalid events', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'COPY_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('idle')

      actor.send({ type: 'FOLDERS_CREATED' })
      expect(actor.getSnapshot().value).toBe('idle')

      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })
  })

  // US-02 — UPDATE_CONFIG while idle
  describe('UPDATE_CONFIG — configuration updates', () => {
    it('should update context config fields while in idle', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({
        type: 'UPDATE_CONFIG',
        config: { title: 'My Documentary', numCameras: 3 }
      })

      expect(actor.getSnapshot().context.title).toBe('My Documentary')
      expect(actor.getSnapshot().context.numCameras).toBe(3)
      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })
  })
})

// ============================================================================
// US-02 — useBuildProjectMachine Hook Integration
// ============================================================================

describe('US-02 — useBuildProjectMachine Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with idle state and expected derived booleans', () => {
    const { result } = renderHook(() => useBuildProjectMachine())

    expect(result.current.isIdle).toBe(true)
    expect(result.current.isValidating).toBe(false)
    expect(result.current.isCreatingFolders).toBe(false)
    expect(result.current.isCopyingFiles).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.isShowingSuccess).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('should expose state, send function, and derived state properties', () => {
    const { result } = renderHook(() => useBuildProjectMachine())

    expect(typeof result.current.send).toBe('function')
    expect(result.current.state).toBeDefined()
    expect(result.current.copyProgress).toBe(0)
    expect(result.current.error).toBeNull()
    expect(result.current.projectFolder).toBeNull()
  })

  it('should transition to validating when START_PROJECT is sent', () => {
    const { result } = renderHook(() => useBuildProjectMachine())

    act(() => {
      result.current.send({ type: 'START_PROJECT' })
    })

    expect(result.current.isValidating).toBe(true)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isIdle).toBe(false)
  })

  it('should set up Tauri event listeners on mount', async () => {
    const { listenCopyProgress, listenCopyComplete, listenCopyFileError, listenCopyCompleteWithErrors } =
      await import('../../src/features/BuildProject/api')

    const { unmount } = renderHook(() => useBuildProjectMachine())

    // Give effect time to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(listenCopyProgress).toHaveBeenCalled()
    expect(listenCopyComplete).toHaveBeenCalled()
    expect(listenCopyFileError).toHaveBeenCalled()
    expect(listenCopyCompleteWithErrors).toHaveBeenCalled()

    unmount()
  })

  it('should handle COPY_COMPLETE event and transition to creatingTemplate', async () => {
    const { listenCopyComplete } = await import('../../src/features/BuildProject/api')

    let completeCb: ((event: any) => void) | undefined

    vi.mocked(listenCopyComplete).mockImplementation((cb: any) => {
      completeCb = cb
      return Promise.resolve(vi.fn())
    })

    const { result } = renderHook(() => useBuildProjectMachine())

    // Progress machine to copyingFiles
    act(() => {
      result.current.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      result.current.send({ type: 'FOLDERS_CREATED' })
      result.current.send({ type: 'BREADCRUMBS_SAVED' })
    })

    expect(result.current.isCopyingFiles).toBe(true)

    // Simulate copy_complete Tauri event
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (completeCb) {
        completeCb({ payload: [] })
      }
    })

    expect(result.current.isCreatingTemplate).toBe(true)
  })

  it('should update copyProgress context when COPY_PROGRESS events arrive', async () => {
    const { listenCopyProgress } = await import('../../src/features/BuildProject/api')

    let progressCb: ((event: any) => void) | undefined

    vi.mocked(listenCopyProgress).mockImplementation((cb: any) => {
      progressCb = cb
      return Promise.resolve(vi.fn())
    })

    const { result } = renderHook(() => useBuildProjectMachine())

    // Progress machine to copyingFiles
    act(() => {
      result.current.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      result.current.send({ type: 'FOLDERS_CREATED' })
      result.current.send({ type: 'BREADCRUMBS_SAVED' })
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (progressCb) {
        progressCb({ payload: 65 })
      }
    })

    expect(result.current.copyProgress).toBe(65)
  })

  it('should handle COPY_ERROR and transition to error state', async () => {
    const { listenCopyCompleteWithErrors } = await import('../../src/features/BuildProject/api')

    let errorCb: ((event: any) => void) | undefined

    vi.mocked(listenCopyCompleteWithErrors).mockImplementation((cb: any) => {
      errorCb = cb
      return Promise.resolve(vi.fn())
    })

    const { result } = renderHook(() => useBuildProjectMachine())

    // Progress machine to copyingFiles
    act(() => {
      result.current.send({ type: 'VALIDATION_SUCCESS', projectFolder: '/projects/Proj' })
      result.current.send({ type: 'FOLDERS_CREATED' })
      result.current.send({ type: 'BREADCRUMBS_SAVED' })
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (errorCb) {
        errorCb({
          payload: {
            failure_count: 2,
            success_count: 1,
            total_files: 3,
            failed_files: [{ file: '/source/video1.mp4' }, { file: '/source/video2.mp4' }]
          }
        })
      }
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toContain('2 of 3 files failed')
  })
})
