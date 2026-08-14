/**
 * ProjectDetailPanel tests - issue #168
 *
 * Paths read out of breadcrumbs.json were rendered as current state behind a
 * string-truthiness gate, with no check that they still resolve. Because
 * breadcrumbs round-trip through Trello card descriptions they are routinely
 * authored on another machine, so they are often not merely stale but
 * structurally meaningless locally.
 *
 * Covers B2 (recorded location in the header), B3 (copy to clipboard) and
 * B4 (footage file paths).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@testing-library/jest-dom'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as bakerApi from '../api'
import type { BreadcrumbsFile, ProjectFolder } from '../types'
import { ProjectDetailPanel } from './ProjectDetailPanel'

vi.mock('../api')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))
vi.mock('@features/Trello', () => ({
  TrelloCardsManager: () => null,
  useTrelloCardsManager: () => ({
    trelloCards: [],
    cardUrl: '',
    setCardUrl: vi.fn(),
    handleFetchAndAdd: vi.fn(),
    isFetchingCard: false
  }),
  useTrelloSelfAssignment: () => ({
    canAssign: false,
    isAssigned: () => false,
    isCardLoading: () => false,
    isToggling: () => false,
    toggleAssignment: vi.fn()
  })
}))
vi.mock('./VideoLinksManager', () => ({ VideoLinksManager: () => null }))

const NOT_FOUND_LABEL = 'Not found on this machine'

const PROJECT_PATH = '/Volumes/Media/Shoots/Project A'
const RECORDED_PARENT = '/Volumes/Media/Shoots'

const FILE_A = `${PROJECT_PATH}/Footage/Camera 1/A001.mov`
const FILE_B = `${PROJECT_PATH}/Footage/Camera 1/A002.mov`
const FILE_C = `${PROJECT_PATH}/Footage/Camera 2/B001.mov`

const project: ProjectFolder = {
  path: PROJECT_PATH,
  name: 'Project A',
  isValid: true,
  hasBreadcrumbs: true,
  staleBreadcrumbs: false,
  invalidBreadcrumbs: false,
  lastScanned: '2026-01-01T00:00:00Z',
  cameraCount: 2,
  validationErrors: []
}

const breadcrumbs: BreadcrumbsFile = {
  projectTitle: 'Project A',
  numberOfCameras: 2,
  parentFolder: RECORDED_PARENT,
  createdBy: 'Someone Else',
  creationDateTime: '2026-01-01T00:00:00Z',
  files: [
    { camera: 1, name: 'A001.mov', path: FILE_A },
    { camera: 1, name: 'A002.mov', path: FILE_B },
    { camera: 2, name: 'B001.mov', path: FILE_C }
  ]
}

const writeText = vi.fn()

const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return render(
    <QueryClientProvider client={client}>
      <ProjectDetailPanel
        selectedProject={PROJECT_PATH}
        project={project}
        breadcrumbs={breadcrumbs}
        isLoadingBreadcrumbs={false}
        breadcrumbsError={null}
        preview={null}
        isGeneratingPreview={false}
        onGeneratePreview={vi.fn()}
      />
    </QueryClientProvider>
  )
}

/** Resolve the probe by answering `present` for each path it is handed. */
const answerProbe = (present: (path: string) => boolean) => {
  vi.mocked(bakerApi.pathsExist).mockImplementation(async (paths: string[]) =>
    paths.map(present)
  )
}

const openFilesTab = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: /Files/ }))
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true
  })
})

describe('B2 - recorded location in the detail header', () => {
  it('B2.1 renders the recorded location unmarked when it resolves', async () => {
    answerProbe(() => true)
    renderPanel()

    await waitFor(() => expect(bakerApi.pathsExist).toHaveBeenCalled())

    expect(screen.getByText(RECORDED_PARENT)).not.toHaveClass('line-through')
    expect(screen.queryByText('Location not found')).not.toBeInTheDocument()
  })

  it('B2.2 strikes the location through and shows a pill when it does not resolve', async () => {
    answerProbe(() => false)
    renderPanel()

    expect(await screen.findByText('Location not found')).toBeInTheDocument()
    expect(screen.getByText(RECORDED_PARENT)).toHaveClass('line-through')
  })

  it('B2.3 asserts nothing while the probe is still in flight', async () => {
    vi.mocked(bakerApi.pathsExist).mockReturnValue(new Promise(() => {}))
    renderPanel()

    await waitFor(() => expect(bakerApi.pathsExist).toHaveBeenCalled())

    expect(screen.queryByText('Location not found')).not.toBeInTheDocument()
    expect(screen.getByText(RECORDED_PARENT)).not.toHaveClass('line-through')
  })

  it('B2.4 never rewrites the stored breadcrumbs when a path does not resolve', async () => {
    answerProbe(() => false)
    renderPanel()

    await screen.findByText('Location not found')

    expect(breadcrumbs.parentFolder).toBe(RECORDED_PARENT)
    expect(bakerApi.bakerUpdateBreadcrumbs).not.toHaveBeenCalled()
    expect(bakerApi.writeTextFileContents).not.toHaveBeenCalled()
  })
})

describe('B3 - copy project path', () => {
  it('B3.1 confirms without qualification when the copied path resolves', async () => {
    const user = userEvent.setup()
    answerProbe(() => true)
    renderPanel()

    await waitFor(() => expect(bakerApi.pathsExist).toHaveBeenCalled())
    await user.click(screen.getByTitle('Copy project path'))

    expect(writeText).toHaveBeenCalledWith(PROJECT_PATH)
    expect(toast.success).toHaveBeenCalledWith('Project path copied')
  })

  it('B3.2 still copies but says so when the copied path does not resolve', async () => {
    const user = userEvent.setup()
    answerProbe(() => false)
    renderPanel()

    await screen.findByText('Location not found')
    await user.click(screen.getByTitle('Copy project path'))

    expect(writeText).toHaveBeenCalledWith(PROJECT_PATH)
    expect(toast.warning).toHaveBeenCalledWith(
      'Project path copied, but it was not found on this machine'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('B3.3 makes no claim when the probe has not answered yet', async () => {
    const user = userEvent.setup()
    vi.mocked(bakerApi.pathsExist).mockReturnValue(new Promise(() => {}))
    renderPanel()

    await waitFor(() => expect(bakerApi.pathsExist).toHaveBeenCalled())
    await user.click(screen.getByTitle('Copy project path'))

    expect(writeText).toHaveBeenCalledWith(PROJECT_PATH)
    expect(toast.info).toHaveBeenCalledWith(
      'Project path copied. Bucket has not checked whether it still exists.'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('B3.4 never disables the copy button, in any probe state', async () => {
    answerProbe(() => false)
    renderPanel()

    await screen.findByText('Location not found')

    expect(screen.getByTitle('Copy project path')).toBeEnabled()
  })

  it('B3.5 reports the verification of the copied path, not of the displayed one', async () => {
    const user = userEvent.setup()
    // The live project path resolves; the location recorded in breadcrumbs
    // does not. The toast must speak for the string the button copies.
    answerProbe((path) => path === PROJECT_PATH)
    renderPanel()

    await screen.findByText('Location not found')
    await user.click(screen.getByTitle('Copy project path'))

    expect(writeText).toHaveBeenCalledWith(PROJECT_PATH)
    expect(toast.success).toHaveBeenCalledWith('Project path copied')
  })
})

describe('B4 - footage file paths', () => {
  it('B4.1 marks nothing when every recorded file resolves', async () => {
    const user = userEvent.setup()
    answerProbe(() => true)
    renderPanel()
    await openFilesTab(user)

    await waitFor(() =>
      expect(vi.mocked(bakerApi.pathsExist).mock.calls.length).toBeGreaterThan(1)
    )

    expect(screen.queryByLabelText(NOT_FOUND_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(/not found on this machine/)).not.toBeInTheDocument()
  })

  it('B4.2 strikes through each unresolved row and summarises the count', async () => {
    const user = userEvent.setup()
    answerProbe((path) => path !== FILE_B)
    renderPanel()
    await openFilesTab(user)

    expect(
      await screen.findByText('1 of 3 files not found on this machine')
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText(NOT_FOUND_LABEL)).toHaveLength(1)
    expect(screen.getByText(FILE_B)).toHaveClass('line-through')
    expect(screen.getByText(FILE_A)).not.toHaveClass('line-through')
  })

  it('B4.3 marks nothing while the probe is in flight', async () => {
    const user = userEvent.setup()
    vi.mocked(bakerApi.pathsExist).mockReturnValue(new Promise(() => {}))
    renderPanel()
    await openFilesTab(user)

    await screen.findByText(FILE_A)

    expect(screen.queryByLabelText(NOT_FOUND_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(/not found on this machine/)).not.toBeInTheDocument()
    expect(screen.getByText(FILE_A)).not.toHaveClass('line-through')
  })

  it('B4.4 hands every file path to one batched probe, never one per row', async () => {
    const user = userEvent.setup()
    answerProbe(() => true)
    renderPanel()
    await openFilesTab(user)

    await waitFor(() =>
      expect(vi.mocked(bakerApi.pathsExist).mock.calls.length).toBeGreaterThan(1)
    )

    const filesCall = vi
      .mocked(bakerApi.pathsExist)
      .mock.calls.map(([paths]) => paths)
      .find((paths) => paths.includes(FILE_A))

    expect(filesCall).toEqual(expect.arrayContaining([FILE_A, FILE_B, FILE_C]))
  })
})
