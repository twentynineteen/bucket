import type { TrelloCard } from '@/types/media'
import { createMockTrelloCard } from '@tests/utils/test-helpers'
import { extractTrelloCardId, validateTrelloCard } from '@utils/validation'
import { describe, expect, it } from 'vitest'

describe('TrelloCard Validation Contract', () => {
  describe('Valid TrelloCard', () => {
    it('should accept valid Trello URL and extract card ID', () => {
      const card: TrelloCard = {
        url: 'https://trello.com/c/abc12345/project-name',
        cardId: 'abc12345',
        title: 'Test Card'
      }

      const errors = validateTrelloCard(card)
      expect(errors).toHaveLength(0)
    })

    it('should accept all optional fields', () => {
      const card: TrelloCard = {
        url: 'https://trello.com/c/abc12345/project-name',
        cardId: 'abc12345',
        title: 'Test Card',
        boardName: 'Video Projects',
        lastFetched: '2025-01-20T10:00:00.000Z'
      }

      const errors = validateTrelloCard(card)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Invalid TrelloCard', () => {
    it('should reject non-Trello URL', () => {
      const card: TrelloCard = {
        url: 'https://example.com/card/123',
        cardId: '123',
        title: 'Test'
      }

      const errors = validateTrelloCard(card)
      expect(errors).toContain('Invalid Trello card URL format')
    })

    it('should reject mismatched card ID', () => {
      const card: TrelloCard = {
        url: 'https://trello.com/c/abc12345/project',
        cardId: 'xyz99999', // Doesn't match URL
        title: 'Test'
      }

      const errors = validateTrelloCard(card)
      expect(errors).toContain('Card ID does not match URL')
    })

    it('should reject empty title', () => {
      const card: TrelloCard = {
        url: 'https://trello.com/c/abc12345/project',
        cardId: 'abc12345',
        title: ''
      }

      const errors = validateTrelloCard(card)
      expect(errors).toContain('Trello card title is required')
    })

    it('should reject title exceeding 200 characters', () => {
      const card: TrelloCard = {
        url: 'https://trello.com/c/abc12345/project',
        cardId: 'abc12345',
        title: 'a'.repeat(201)
      }

      const errors = validateTrelloCard(card)
      expect(errors).toContain(
        'Trello card title exceeds maximum length (200 characters)'
      )
    })
  })

  describe('Card ID Extraction', () => {
    it('should extract card ID from valid Trello URL', () => {
      const url = 'https://trello.com/c/testcard123/my-project-name'
      const cardId = extractTrelloCardId(url)
      expect(cardId).toBe('testcard123')
    })

    it('should extract card ID from URL without slug', () => {
      const url = 'https://trello.com/c/testcard123'
      const cardId = extractTrelloCardId(url)
      expect(cardId).toBe('testcard123')
    })

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/not-trello'
      const cardId = extractTrelloCardId(url)
      expect(cardId).toBeNull()
    })

    it('should handle card IDs of varying lengths (8-24 chars)', () => {
      const shortUrl = 'https://trello.com/c/abcd1234/test'
      const longUrl = 'https://trello.com/c/abcdefgh12345678ijklmnop/test'

      expect(extractTrelloCardId(shortUrl)).toBe('abcd1234')
      expect(extractTrelloCardId(longUrl)).toBe('abcdefgh12345678ijklmnop')
    })
  })
})
