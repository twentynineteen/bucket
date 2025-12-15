import type { BreadcrumbsFile } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { createTestBreadcrumbs } from '@tests/utils/test-helpers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('Backward Compatibility Contract', () => {
  let tauriMocks: ReturnType<typeof setupTauriMocks>
  const testProjectPath = '/path/to/test/project'

  beforeEach(() => {
    tauriMocks = setupTauriMocks()
  })

  afterEach(() => {
    tauriMocks.clearMocks()
  })

  describe('Legacy Breadcrumbs (Pre-004)', () => {
    it('should read legacy breadcrumbs with single trelloCardUrl', async () => {
      // Setup: Create legacy breadcrumbs file
      const legacyBreadcrumbs: BreadcrumbsFile = {
        ...createTestBreadcrumbs(),
        trelloCardUrl: 'https://trello.com/c/abc12345/project'
      }

      tauriMocks.setBreadcrumbs(testProjectPath, legacyBreadcrumbs)

      // Invoke get_trello_cards (should auto-migrate in-memory)
      const cards = await invoke<Array<{ url: string; cardId: string; title: string }>>(
        'baker_get_trello_cards',
        {
          projectPath: testProjectPath
        }
      )

      expect(cards).toHaveLength(1)
      expect(cards[0].url).toBe('https://trello.com/c/abc12345/project')
      expect(cards[0].cardId).toBe('abc12345')

      // Original file should remain unchanged (in-memory migration only)
      const fileContent = tauriMocks.getBreadcrumbs(testProjectPath)
      expect(fileContent?.trelloCards).toBeUndefined()
      expect(fileContent?.trelloCardUrl).toBe('https://trello.com/c/abc12345/project')
    })

    it('should write new format with backward-compatible trelloCardUrl', async () => {
      // Setup: Empty breadcrumbs
      tauriMocks.setBreadcrumbs(testProjectPath, createTestBreadcrumbs())

      // Add card to breadcrumbs
      const result = await invoke<BreadcrumbsFile>('baker_associate_trello_card', {
        projectPath: testProjectPath,
        trelloCard: {
          url: 'https://trello.com/c/xyz789/new-card',
          cardId: 'xyz789',
          title: 'New Card'
        }
      })

      // Should have both new and legacy fields
      expect(result.trelloCards).toHaveLength(1)
      expect(result.trelloCards![0].cardId).toBe('xyz789')
      expect(result.trelloCardUrl).toBe('https://trello.com/c/xyz789/new-card')
    })

    it('should preserve trelloCardUrl when adding additional cards', async () => {
      // Setup: Breadcrumbs with one card
      const breadcrumbs: BreadcrumbsFile = {
        ...createTestBreadcrumbs(),
        trelloCards: [
          {
            url: 'https://trello.com/c/first/card',
            cardId: 'first',
            title: 'First Card'
          }
        ],
        trelloCardUrl: 'https://trello.com/c/first/card'
      }

      tauriMocks.setBreadcrumbs(testProjectPath, breadcrumbs)

      // Add second card
      const result = await invoke<BreadcrumbsFile>('baker_associate_trello_card', {
        projectPath: testProjectPath,
        trelloCard: {
          url: 'https://trello.com/c/second/card',
          cardId: 'second',
          title: 'Second Card'
        }
      })

      // trelloCardUrl should still point to first card
      expect(result.trelloCardUrl).toBe('https://trello.com/c/first/card')
      expect(result.trelloCards).toHaveLength(2)
    })

    it('should update trelloCardUrl when first card is removed', async () => {
      // Setup: Breadcrumbs with two cards
      const breadcrumbs: BreadcrumbsFile = {
        ...createTestBreadcrumbs(),
        trelloCards: [
          {
            url: 'https://trello.com/c/first/card',
            cardId: 'first',
            title: 'First Card'
          },
          {
            url: 'https://trello.com/c/second/card',
            cardId: 'second',
            title: 'Second Card'
          }
        ],
        trelloCardUrl: 'https://trello.com/c/first/card'
      }

      tauriMocks.setBreadcrumbs(testProjectPath, breadcrumbs)

      // Remove first card
      const result = await invoke<BreadcrumbsFile>('baker_remove_trello_card', {
        projectPath: testProjectPath,
        cardIndex: 0
      })

      // trelloCardUrl should now point to second card (now first)
      expect(result.trelloCardUrl).toBe('https://trello.com/c/second/card')
      expect(result.trelloCards).toHaveLength(1)
    })

    it('should set trelloCardUrl to undefined when last card removed', async () => {
      // Setup: Breadcrumbs with one card
      const breadcrumbs: BreadcrumbsFile = {
        ...createTestBreadcrumbs(),
        trelloCards: [
          {
            url: 'https://trello.com/c/only/card',
            cardId: 'only',
            title: 'Only Card'
          }
        ],
        trelloCardUrl: 'https://trello.com/c/only/card'
      }

      tauriMocks.setBreadcrumbs(testProjectPath, breadcrumbs)

      // Remove only card
      const result = await invoke<BreadcrumbsFile>('baker_remove_trello_card', {
        projectPath: testProjectPath,
        cardIndex: 0
      })

      // trelloCardUrl should be undefined
      expect(result.trelloCardUrl).toBeUndefined()
      expect(result.trelloCards).toHaveLength(0)
    })
  })

  describe('New Breadcrumbs (Phase 004)', () => {
    it('should handle breadcrumbs with only new array fields', async () => {
      const newBreadcrumbs: BreadcrumbsFile = {
        ...createTestBreadcrumbs(),
        videoLinks: [
          {
            url: 'https://sproutvideo.com/videos/abc',
            title: 'Video 1'
          }
        ],
        trelloCards: [
          {
            url: 'https://trello.com/c/xyz/card',
            cardId: 'xyz',
            title: 'Card 1'
          }
        ]
      }

      tauriMocks.setBreadcrumbs(testProjectPath, newBreadcrumbs)

      const videos = await invoke<Array<{ url: string; title: string }>>(
        'baker_get_video_links',
        {
          projectPath: testProjectPath
        }
      )

      const cards = await invoke<Array<{ url: string; cardId: string; title: string }>>(
        'baker_get_trello_cards',
        {
          projectPath: testProjectPath
        }
      )

      expect(videos).toHaveLength(1)
      expect(cards).toHaveLength(1)
    })

    it('should return empty arrays when no videos or cards exist', async () => {
      tauriMocks.setBreadcrumbs(testProjectPath, createTestBreadcrumbs())

      const videos = await invoke<Array<{ url: string; title: string }>>(
        'baker_get_video_links',
        {
          projectPath: testProjectPath
        }
      )

      const cards = await invoke<Array<{ url: string; cardId: string; title: string }>>(
        'baker_get_trello_cards',
        {
          projectPath: testProjectPath
        }
      )

      expect(videos).toHaveLength(0)
      expect(cards).toHaveLength(0)
    })
  })
})
