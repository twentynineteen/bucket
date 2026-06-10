/**
 * Integration Test: US-02 — Build Project Happy Path
 *
 * As a video editor, when I navigate to /ingest/build, select footage files,
 * assign camera numbers, enter a project title, choose a destination folder,
 * and click "Create Project", then the XState machine progresses through all
 * stages and a complete project folder structure is created on disk.
 *
 * Tests the actor-based BuildProject state machine (@features/build-project)
 * and the useBuildProject hook that drives it. The legacy manual-event machine
 * in @features/BuildProject was removed by the throttled native transfer
 * rework (#112), so this suite targets the replacement pipeline.
 *
 * Mocking strategy: mock the Tauri plugin layer (fs, dialog, core, event) the
 * stage actors call into, mirroring the machine unit tests.
 */

import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { createActor } from 'xstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBuildProject } from '../../src/features/build-project/hooks/useBuildProject'
import {
  buildProjectMachine,
  type BuildProjectInput
} from '../../src/features/build-project/machine/buildProjectMachine'

// Mock Tauri APIs used by the stage actors
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  writeTextFile: vi.fn()
}))

// Simulate transfer completion events firing immediately. Both the legacy
// `copy_complete` event and the throttled `file-transfer-complete` event are
// fired so the same mock works for the full pipeline.
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event: string, callback: (event: { payload: unknown }) => void) => {
    if (event === 'copy_complete') {
      setTimeout(() => callback({ payload: [] }), 10)
    }
    if (event === 'file-transfer-complete') {
      setTimeout(
        () =>
          callback({
            payload: {
              operationId: undefined,
              success: true,
              filesTransferred: 0,
              error: null
            }
          }),
        10
      )
    }
    return Promise.resolve(() => {})
  })
}))

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'us02-test-uuid')
})

const createValidInput = (overrides?: Partial<BuildProjectInput>): BuildProjectInput => ({
  projectName: 'Test Project',
  destinationPath: '/output/path',
  files: [{ file: { path: '/source/video.mp4', name: 'video.mp4' }, camera: 1 }],
  numCameras: 2,
  username: 'testuser',
  ...overrides
})

const mockSuccessfulPipeline = () => {
  vi.mocked(exists).mockResolvedValue(false)
  vi.mocked(mkdir).mockResolvedValue(undefined)
  vi.mocked(remove).mockResolvedValue(undefined)
  vi.mocked(invoke).mockResolvedValue(undefined)
  vi.mocked(writeTextFile).mockResolvedValue(undefined)
  vi.mocked(confirm).mockResolvedValue(true)
}

const waitForState = async (
  actor: ReturnType<typeof createActor<typeof buildProjectMachine>>,
  targetState: string,
  timeout = 5000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Timeout waiting for state "${targetState}". Current state: ${actor.getSnapshot().value}`
        )
      )
    }, timeout)

    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.value === targetState) {
        clearTimeout(timeoutId)
        subscription.unsubscribe()
        resolve()
      }
    })

    if (actor.getSnapshot().value === targetState) {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
      resolve()
    }
  })
}

// ============================================================================
// US-02: Machine Workflow Integration
// ============================================================================

describe('US-02 — BuildProject State Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // US-02a — Full successful project creation flow
  describe('US-02a — Full successful project creation', () => {
    it('should start in idle state', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('idle')
      actor.stop()
    })

    it('should progress through all stages to success on START', async () => {
      mockSuccessfulPipeline()

      const actor = createActor(buildProjectMachine)
      actor.start()

      const visited: string[] = []
      actor.subscribe((snapshot) => {
        const state = String(snapshot.value)
        if (visited[visited.length - 1] !== state) {
          visited.push(state)
        }
      })

      actor.send({ type: 'START', input: createValidInput() })

      await waitForState(actor, 'success')

      const finalState = actor.getSnapshot()
      expect(finalState.value).toBe('success')
      expect(finalState.context.currentStage).toBe('success')
      expect(finalState.context.progress).toBe(100)
      expect(finalState.context.error).toBeNull()

      // The pipeline must pass through every workflow stage in order
      expect(visited).toContain('validating')
      expect(visited).toContain('creatingFolders')
      expect(visited).toContain('savingBreadcrumbs')
      expect(visited.indexOf('validating')).toBeLessThan(
        visited.indexOf('creatingFolders')
      )

      actor.stop()
    })

    it('should derive projectFolder from destination and project name', async () => {
      mockSuccessfulPipeline()

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({
        type: 'START',
        input: createValidInput({
          projectName: 'My Project',
          destinationPath: '/projects'
        })
      })

      await waitForState(actor, 'creatingFolders')
      expect(actor.getSnapshot().context.projectFolder).toBe('/projects/My Project')

      actor.stop()
    })

    it('should write breadcrumbs with project metadata', async () => {
      mockSuccessfulPipeline()

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({
        type: 'START',
        input: createValidInput({
          username: 'john_doe',
          projectName: 'Breadcrumb Test',
          numCameras: 2
        })
      })

      await waitForState(actor, 'success')

      const breadcrumbs = actor.getSnapshot().context.breadcrumbs
      expect(breadcrumbs).not.toBeNull()
      expect(breadcrumbs?.projectTitle).toBe('Breadcrumb Test')
      expect(breadcrumbs?.numberOfCameras).toBe(2)
      expect(breadcrumbs?.createdBy).toBe('john_doe')
      expect(writeTextFile).toHaveBeenCalled()

      actor.stop()
    })

    it('should allow RESET from success back to idle', async () => {
      mockSuccessfulPipeline()

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START', input: createValidInput() })
      await waitForState(actor, 'success')

      actor.send({ type: 'RESET' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('idle')
      expect(snapshot.context.error).toBeNull()
      expect(snapshot.context.progress).toBe(0)

      actor.stop()
    })
  })

  // US-02b — Sequential project creation (new project after success)
  describe('US-02b — Sequential project creation', () => {
    it('should support a second build after RESET', async () => {
      mockSuccessfulPipeline()

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({
        type: 'START',
        input: createValidInput({ projectName: 'First', destinationPath: '/projects' })
      })
      await waitForState(actor, 'success')

      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('idle')

      actor.send({
        type: 'START',
        input: createValidInput({ projectName: 'Second', destinationPath: '/projects' })
      })
      await waitForState(actor, 'success')

      expect(actor.getSnapshot().context.projectFolder).toBe('/projects/Second')
      expect(actor.getSnapshot().context.error).toBeNull()

      actor.stop()
    })
  })

  // US-02d — Validation / stage error handling
  describe('US-02d — Error handling', () => {
    it('should transition to error when validation fails', async () => {
      vi.mocked(exists).mockRejectedValue(new Error('Path check failed'))

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START', input: createValidInput() })
      await waitForState(actor, 'error')

      const context = actor.getSnapshot().context
      expect(context.currentStage).toBe('error')
      expect(context.error).toBeDefined()
      expect(context.lastFailedStage).toBe('validating')

      actor.stop()
    })

    it('should transition to error when folder creation fails', async () => {
      vi.mocked(exists).mockResolvedValue(false)
      vi.mocked(mkdir).mockRejectedValue(new Error('Permission denied'))

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START', input: createValidInput() })
      await waitForState(actor, 'error')

      expect(actor.getSnapshot().context.lastFailedStage).toBe('creatingFolders')

      actor.stop()
    })

    it('should reset from error state back to idle on RESET', async () => {
      vi.mocked(exists).mockRejectedValue(new Error('Disk unavailable'))

      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'START', input: createValidInput() })
      await waitForState(actor, 'error')

      actor.send({ type: 'RESET' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('idle')
      expect(snapshot.context.error).toBeNull()

      actor.stop()
    })

    it('should ignore workflow events while idle', () => {
      const actor = createActor(buildProjectMachine)
      actor.start()

      actor.send({ type: 'CANCEL' })
      expect(actor.getSnapshot().value).toBe('idle')

      actor.send({ type: 'RESET' })
      expect(actor.getSnapshot().value).toBe('idle')

      actor.stop()
    })
  })
})

// ============================================================================
// US-02 — useBuildProject Hook Integration
// ============================================================================

describe('US-02 — useBuildProject Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with idle state and expected derived booleans', () => {
    const { result } = renderHook(() => useBuildProject())

    expect(result.current.state.value).toBe('idle')
    expect(result.current.isIdle).toBe(true)
    expect(result.current.isBuilding).toBe(false)
    expect(result.current.isComplete).toBe(false)
    expect(result.current.hasError).toBe(false)
  })

  it('should expose the workflow control surface', () => {
    const { result } = renderHook(() => useBuildProject())

    expect(typeof result.current.startBuild).toBe('function')
    expect(typeof result.current.cancel).toBe('function')
    expect(typeof result.current.reset).toBe('function')
    expect(typeof result.current.retry).toBe('function')
    expect(result.current.context).toBeDefined()
    expect(result.current.progress).toBeDefined()
  })

  it('should run the full pipeline to success via startBuild', async () => {
    mockSuccessfulPipeline()

    const { result } = renderHook(() => useBuildProject())

    act(() => {
      result.current.startBuild(createValidInput())
    })

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true)
    })

    expect(result.current.isBuilding).toBe(false)
    expect(result.current.hasError).toBe(false)
    expect(result.current.context.progress).toBe(100)
  })

  it('should surface stage errors through isError and context', async () => {
    vi.mocked(exists).mockRejectedValue(new Error('Validation exploded'))

    const { result } = renderHook(() => useBuildProject())

    act(() => {
      result.current.startBuild(createValidInput())
    })

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })

    expect(result.current.context.error).toBeDefined()
    expect(result.current.context.lastFailedStage).toBe('validating')
  })

  it('should reset back to idle after a completed build', async () => {
    mockSuccessfulPipeline()

    const { result } = renderHook(() => useBuildProject())

    act(() => {
      result.current.startBuild(createValidInput())
    })

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.state.value).toBe('idle')
    expect(result.current.isComplete).toBe(false)
  })
})
