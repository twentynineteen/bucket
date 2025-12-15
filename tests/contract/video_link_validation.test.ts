import type { VideoLink } from '@/types/media'
import { createMockVideoLink } from '@tests/utils/test-helpers'
import { validateVideoLink } from '@utils/validation'
import { describe, expect, it } from 'vitest'

describe('VideoLink Validation Contract', () => {
  describe('Valid VideoLink', () => {
    it('should accept valid HTTPS video URL', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Test Video'
      }

      const errors = validateVideoLink(link)
      expect(errors).toHaveLength(0)
    })

    it('should accept all optional fields when provided', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        sproutVideoId: 'abc123',
        title: 'Test Video',
        thumbnailUrl: 'https://cdn.sproutvideo.com/frame.jpg',
        uploadDate: '2025-01-20T14:22:00.000Z',
        sourceRenderFile: 'final-edit.mp4'
      }

      const errors = validateVideoLink(link)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Invalid VideoLink', () => {
    it('should reject non-HTTPS URL', () => {
      const link: VideoLink = {
        url: 'http://sproutvideo.com/videos/abc123',
        title: 'Test Video'
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Video URL must use HTTPS')
    })

    it('should reject empty title', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: ''
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Video title is required')
    })

    it('should reject title exceeding 200 characters', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'a'.repeat(201)
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Video title exceeds maximum length (200 characters)')
    })

    it('should reject URL exceeding 2048 characters', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/' + 'a'.repeat(2048),
        title: 'Test'
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Video URL exceeds maximum length (2048 characters)')
    })

    it('should reject non-HTTPS thumbnail URL', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Test',
        thumbnailUrl: 'http://cdn.sproutvideo.com/frame.jpg'
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Thumbnail URL must use HTTPS')
    })

    it('should reject invalid ISO 8601 upload date', () => {
      const link: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Test',
        uploadDate: '2025-01-20 14:22:00' // Invalid format (missing T)
      }

      const errors = validateVideoLink(link)
      expect(errors).toContain('Upload date must be in ISO 8601 format')
    })
  })
})
