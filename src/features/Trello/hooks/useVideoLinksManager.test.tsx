/**
 * UPLOAD-04 / UPLOAD-05 — a stale upload message must never survive into the
 * next visit to the Add Video dialog.
 *
 * `useUploadEvents` is deliberately left un-mocked so the assertions run
 * against the real React Query cache entry under `queryKeys.upload.events()`;
 * everything else useVideoLinksManager depends on is stubbed.
 */

import '@testing-library/jest-dom'

import { queryKeys } from '@shared/lib'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as apiKeysModule from '@shared/hooks'
import * as bakerModule from '@features/Baker'
import * as uploadModule from '@features/Upload'

import * as trelloCardsModule from './useBreadcrumbsTrelloCards'
import * as cardPosterFrameModule from './useCardPosterFrame'
import { useVideoLinksManager } from './useVideoLinksManager'

vi.mock('../api', () => ({
  bakerReadBreadcrumbs: vi.fn().mockResolvedValue({}),
  fetchTrelloCardById: vi.fn().mockResolvedValue({}),
  updateTrelloCard: vi.fn().mockResolvedValue({})
}))

vi.mock('./useBreadcrumbsTrelloCards')
vi.mock('./useCardPosterFrame')

vi.mock('@shared/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/hooks')>()),
  useSproutVideoApiKey: vi.fn(),
  useTrelloApiKeys: vi.fn()
}))

vi.mock('@features/Baker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/Baker')>()),
  useBreadcrumbsVideoLinks: vi.fn(),
  generateBreadcrumbsBlock: vi.fn(() => ''),
  updateTrelloCardWithBreadcrumbs: vi.fn()
}))

// Partial mock: useUploadEvents stays real so it keeps writing to the cache.
vi.mock('@features/Upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/Upload')>()),
  useFileUpload: vi.fn(),
  usePosterFrameForUpload: vi.fn(),
  useSproutVideoApi: vi.fn(),
  useSproutVideoProcessor: vi.fn()
}))

const STALE_MESSAGE = {
  text: 'Sprout rejected the upload: HTTP 413 — <html>',
  severity: 'error' as const
}

const uploadEventsKey = queryKeys.upload.events()

type UploadEventsCache = {
  progress: number
  uploading: boolean
  message: unknown
}

const mockUploadFile = vi.fn().mockResolvedValue(undefined)

const setupMocks = () => {
  vi.mocked(bakerModule.useBreadcrumbsVideoLinks).mockReturnValue({
    videoLinks: [],
    isLoading: false,
    error: null,
    addVideoLink: vi.fn(),
    addVideoLinkAsync: vi.fn(),
    removeVideoLink: vi.fn(),
    removeVideoLinkAsync: vi.fn(),
    updateVideoLink: vi.fn(),
    updateVideoLinkAsync: vi.fn(),
    reorderVideoLinks: vi.fn(),
    reorderVideoLinksAsync: vi.fn(),
    isUpdating: false,
    addError: null,
    removeError: null,
    updateError: null,
    reorderError: null
  } as unknown as ReturnType<typeof bakerModule.useBreadcrumbsVideoLinks>)

  vi.mocked(trelloCardsModule.useBreadcrumbsTrelloCards).mockReturnValue({
    trelloCards: [],
    isLoading: false,
    error: null,
    addTrelloCard: vi.fn(),
    addTrelloCardAsync: vi.fn(),
    removeTrelloCard: vi.fn(),
    removeTrelloCardAsync: vi.fn(),
    fetchCardDetails: vi.fn(),
    fetchCardDetailsAsync: vi.fn(),
    isUpdating: false,
    isFetchingDetails: false,
    addError: null,
    removeError: null,
    fetchError: null,
    fetchedCardData: undefined
  } as unknown as ReturnType<typeof trelloCardsModule.useBreadcrumbsTrelloCards>)

  vi.mocked(cardPosterFrameModule.useCardPosterFrame).mockReturnValue({
    activeIndex: null,
    open: vi.fn(),
    close: vi.fn(),
    status: 'idle',
    error: null,
    run: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn()
  } as unknown as ReturnType<typeof cardPosterFrameModule.useCardPosterFrame>)

  vi.mocked(apiKeysModule.useSproutVideoApiKey).mockReturnValue({
    apiKey: 'test-api-key',
    isLoading: false,
    error: null
  } as unknown as ReturnType<typeof apiKeysModule.useSproutVideoApiKey>)

  vi.mocked(apiKeysModule.useTrelloApiKeys).mockReturnValue({
    apiKey: 'trello-key',
    apiToken: 'trello-token',
    isLoading: false,
    error: null
  } as unknown as ReturnType<typeof apiKeysModule.useTrelloApiKeys>)

  vi.mocked(uploadModule.useFileUpload).mockReturnValue({
    selectedFile: '/renders/WBS_intro.mp4',
    uploading: false,
    response: null,
    localDuration: null,
    selectFile: vi.fn(),
    uploadFile: mockUploadFile,
    resetUploadState: vi.fn()
  } as unknown as ReturnType<typeof uploadModule.useFileUpload>)

  vi.mocked(uploadModule.useSproutVideoApi).mockReturnValue({
    fetchVideoDetails: vi.fn(),
    fetchVideoDetailsAsync: vi.fn(),
    isFetching: false,
    error: null,
    data: undefined,
    reset: vi.fn()
  } as unknown as ReturnType<typeof uploadModule.useSproutVideoApi>)

  vi.mocked(uploadModule.useSproutVideoProcessor).mockReturnValue({
    reset: vi.fn()
  } as unknown as ReturnType<typeof uploadModule.useSproutVideoProcessor>)

  vi.mocked(uploadModule.usePosterFrameForUpload).mockReturnValue({
    available: true,
    unavailableReason: null,
    enabled: false,
    setEnabled: vi.fn(),
    backgrounds: [],
    selectedBackground: null,
    setSelectedBackground: vi.fn(),
    text: 'Managing Change',
    setText: vi.fn(),
    previewImageUrl: null,
    canvasRef: { current: null },
    saveCopy: false,
    setSaveCopy: vi.fn(),
    status: 'idle',
    error: null,
    run: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn()
  } as unknown as ReturnType<typeof uploadModule.usePosterFrameForUpload>)
}

const renderManager = async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  const view = renderHook(() => useVideoLinksManager({ projectPath: '/project' }), {
    wrapper
  })

  // Let the upload-events query settle before seeding the cache.
  await waitFor(() => {
    expect(queryClient.getQueryData(uploadEventsKey)).toBeDefined()
  })

  return { ...view, queryClient }
}

const seedStaleMessage = async (queryClient: QueryClient) => {
  act(() => {
    queryClient.setQueryData(uploadEventsKey, {
      progress: 100,
      uploading: false,
      message: STALE_MESSAGE
    })
  })

  await waitFor(() => {
    expect(
      (queryClient.getQueryData(uploadEventsKey) as UploadEventsCache).message
    ).toEqual(STALE_MESSAGE)
  })
}

const cachedMessage = (queryClient: QueryClient) =>
  (queryClient.getQueryData(uploadEventsKey) as UploadEventsCache | undefined)?.message

beforeEach(() => {
  mockUploadFile.mockClear()
  mockUploadFile.mockResolvedValue(undefined)
  setupMocks()
})

describe('UPLOAD-04: closing the dialog clears the previous upload message', () => {
  it('nulls the cached message when the dialog closes', async () => {
    const { result, queryClient } = await renderManager()
    await seedStaleMessage(queryClient)

    await act(async () => {
      result.current.handleDialogOpenChange(false)
    })

    await waitFor(() => {
      expect(cachedMessage(queryClient)).toBeNull()
    })
  })

  it('shows no stale message when the dialog is reopened', async () => {
    const { result, queryClient } = await renderManager()
    await seedStaleMessage(queryClient)

    await act(async () => {
      result.current.handleDialogOpenChange(false)
    })
    await act(async () => {
      result.current.handleDialogOpenChange(true)
    })

    expect(cachedMessage(queryClient)).toBeNull()
    expect(result.current.message).toBeNull()
  })
})

describe('UPLOAD-05: starting an upload clears the previous message', () => {
  it('nulls the cached message before the first progress event arrives', async () => {
    const { result, queryClient } = await renderManager()
    await seedStaleMessage(queryClient)

    await act(async () => {
      await result.current.handleUploadAndAdd()
    })

    expect(mockUploadFile).toHaveBeenCalled()
    await waitFor(() => {
      expect(cachedMessage(queryClient)).toBeNull()
    })
  })
})
