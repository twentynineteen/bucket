/**
 * Tests for useBakerTrelloIntegration Hook
 *
 * Covers the Baker batch "Apply Changes" -> Trello update path, including the
 * regression where multiple linked cards were not updated and failures were
 * silently swallowed.
 */

import { useBakerTrelloIntegration } from '@features/Trello/hooks/useBakerTrelloIntegration'
import {
  generateBreadcrumbsBlock,
  updateTrelloCardWithBreadcrumbs
} from '@features/Baker'
import { fetchTrelloCardById, readBreadcrumbsFile } from '@features/Trello/api'
import { logger } from '@shared/utils/logger'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the Trello I/O boundary (api.ts) — the hook reads breadcrumbs and fetches
// the live card through these. Mocking at the api boundary avoids the test
// environment's fetch/MSW handling and matches the repo's I/O conventions.
vi.mock('@features/Trello/api', () => ({
  readBreadcrumbsFile: vi.fn(),
  fetchTrelloCardById: vi.fn()
}))

vi.mock('@shared/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    debug: vi.fn()
  },
  createNamespacedLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }))
}))

// IMPORTANT: the hook dynamically imports from '@features/Baker', so the mock
// MUST target that module specifier (the previous test mocked
// 'hooks/useAppendBreadcrumbs', which never bound -> tests asserted nothing).
vi.mock('@features/Baker', () => ({
  generateBreadcrumbsBlock: vi.fn(() => '## Breadcrumbs'),
  updateTrelloCardWithBreadcrumbs: vi.fn().mockResolvedValue(undefined)
}))

const mockUpdateCard = vi.mocked(updateTrelloCardWithBreadcrumbs)
const mockGenerateBlock = vi.mocked(generateBreadcrumbsBlock)
const mockReadBreadcrumbs = vi.mocked(readBreadcrumbsFile)
const mockFetchCard = vi.mocked(fetchTrelloCardById)

describe('useBakerTrelloIntegration', () => {
  const mockApiKey = 'test-api-key'
  const mockToken = 'test-token'
  const mockProjectPath = '/path/to/project'

  const oneCard = {
    projectTitle: 'Test Project',
    trelloCards: [{ cardId: 'card123', url: 'https://trello.com/c/card123' }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateBlock.mockReturnValue('## Breadcrumbs')
    mockUpdateCard.mockResolvedValue(undefined)
    // fetchTrelloCardById returns a live card carrying an existing description
    mockFetchCard.mockResolvedValue({
      url: 'https://trello.com/c/card123',
      cardId: 'card123',
      title: 'Card',
      desc: 'existing description',
      idList: 'list1'
    } as unknown as Awaited<ReturnType<typeof fetchTrelloCardById>>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    test('returns updateTrelloCards function', () => {
      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )
      expect(result.current).toEqual({ updateTrelloCards: expect.any(Function) })
    })
  })

  describe('Happy path', () => {
    test('updates the single linked card for a project', async () => {
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify(oneCard))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      expect(mockReadBreadcrumbs).toHaveBeenCalledWith(`${mockProjectPath}/breadcrumbs.json`)
      expect(mockUpdateCard).toHaveBeenCalledTimes(1)
    })

    test('REGRESSION: updates EVERY linked card when multiple are present', async () => {
      const threeCards = {
        projectTitle: 'Multi',
        videoLinks: [{ title: 'V', url: 'https://v/1' }],
        trelloCards: [
          { cardId: 'aaa', url: 'https://trello.com/c/aaa' },
          { cardId: 'bbb', url: 'https://trello.com/c/bbb' },
          { cardId: 'ccc', url: 'https://trello.com/c/ccc' }
        ]
      }
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify(threeCards))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      // One update call per linked card
      expect(mockUpdateCard).toHaveBeenCalledTimes(3)
      const updatedIds = mockUpdateCard.mock.calls.map((call) => call[0].id)
      expect(updatedIds).toEqual(['aaa', 'bbb', 'ccc'])
    })

    test('preserves the existing card description (does not overwrite from empty)', async () => {
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify(oneCard))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      await result.current.updateTrelloCards([mockProjectPath])

      // The card passed to the updater carries the live description we fetched
      expect(mockUpdateCard.mock.calls[0][0].desc).toBe('existing description')
      // And it auto-replaces existing breadcrumbs rather than silencing errors
      expect(mockUpdateCard.mock.calls[0][4]).toMatchObject({
        autoReplace: true,
        silentErrors: false
      })
    })

    test('updates cards across multiple projects', async () => {
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify(oneCard))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([
        '/p/project1',
        '/p/project2',
        '/p/project3'
      ])

      expect(errors).toEqual([])
      expect(mockReadBreadcrumbs).toHaveBeenCalledTimes(3)
      expect(mockUpdateCard).toHaveBeenCalledTimes(3)
    })
  })

  describe('Failure surfacing', () => {
    test('REGRESSION: a failing card update is reported, not silently swallowed', async () => {
      const twoCards = {
        projectTitle: 'Test',
        trelloCards: [
          { cardId: 'ok1', url: 'https://trello.com/c/ok1' },
          { cardId: 'bad2', url: 'https://trello.com/c/bad2' }
        ]
      }
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify(twoCards))

      // First card succeeds, second card fails
      mockUpdateCard
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Trello 401'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(mockUpdateCard).toHaveBeenCalledTimes(2)
      expect(errors).toHaveLength(1)
      expect(errors[0].project).toBe('project')
      expect(errors[0].error).toContain('bad2')
      expect(errors[0].error).toContain('Trello 401')
    })

    test('collects errors per project in a batch', async () => {
      mockReadBreadcrumbs
        .mockResolvedValueOnce(JSON.stringify(oneCard))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(JSON.stringify(oneCard))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([
        '/p/project1',
        '/p/project2',
        '/p/project3'
      ])

      expect(errors).toHaveLength(1)
      expect(errors[0].project).toBe('project2')
      expect(errors[0].error).toBe('File not found')
    })

    test('handles malformed breadcrumbs JSON', async () => {
      mockReadBreadcrumbs.mockResolvedValue('{ invalid json }')

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toHaveLength(1)
      expect(mockUpdateCard).not.toHaveBeenCalled()
    })
  })

  describe('Guards & edge cases', () => {
    test('skips entirely when API credentials are missing', async () => {
      const { result } = renderHook(() => useBakerTrelloIntegration({}))

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      expect(mockReadBreadcrumbs).not.toHaveBeenCalled()
      expect(mockUpdateCard).not.toHaveBeenCalled()
    })

    test('handles empty project paths array', async () => {
      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([])

      expect(errors).toEqual([])
      expect(mockReadBreadcrumbs).not.toHaveBeenCalled()
    })

    test('no-ops (no error) when the project has no Trello cards', async () => {
      mockReadBreadcrumbs.mockResolvedValue(JSON.stringify({ projectTitle: 'X' }))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      expect(mockUpdateCard).not.toHaveBeenCalled()
    })

    test('extracts project name from path for error reporting', async () => {
      mockReadBreadcrumbs.mockRejectedValue(new Error('boom'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([
        '/Users/name/Projects/My Project Name'
      ])

      expect(errors[0].project).toBe('My Project Name')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('Legacy support', () => {
    test('updates the legacy trelloCardUrl card when no array present', async () => {
      mockReadBreadcrumbs.mockResolvedValue(
        JSON.stringify({
          projectTitle: 'Legacy',
          trelloCardUrl: 'https://trello.com/c/legacy123'
        })
      )

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      expect(mockUpdateCard).toHaveBeenCalledTimes(1)
      expect(mockUpdateCard.mock.calls[0][0].id).toBe('legacy123')
    })

    test('prefers the trelloCards array over the legacy field', async () => {
      mockReadBreadcrumbs.mockResolvedValue(
        JSON.stringify({
          trelloCards: [{ cardId: 'new123', url: 'https://trello.com/c/new123' }],
          trelloCardUrl: 'https://trello.com/c/legacy123'
        })
      )

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      const errors = await result.current.updateTrelloCards([mockProjectPath])

      expect(errors).toEqual([])
      expect(mockUpdateCard).toHaveBeenCalledTimes(1)
      expect(mockUpdateCard.mock.calls[0][0].id).toBe('new123')
    })
  })
})
