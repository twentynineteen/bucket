/**
 * Contract tests for @shared/types barrel
 *
 * Verifies export shape and type-level contracts for media types
 * and core domain types.
 */

import { describe, expect, test } from 'vitest'

import type {
  // Media types
  VideoLink,
  TrelloCard,
  TrelloBoard,
  TrelloOrganization,
  TrelloBoardPrefs,
  SproutVideoDetails,
  SproutAssets,
  // Core domain types
  SproutFolder,
  GetFoldersResponse,
  FootageData,
  Breadcrumb,
  SproutUploadResponse
} from '@shared/types'

describe('@shared/types barrel contract', () => {
  describe('shape: all expected type exports resolve', () => {
    test('media types are importable and usable', () => {
      const videoLink: VideoLink = {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Test Video'
      }
      expect(videoLink.url).toBe('https://sproutvideo.com/videos/abc123')
      expect(videoLink.title).toBe('Test Video')

      const trelloCard: TrelloCard = {
        url: 'https://trello.com/c/abc12345/test',
        cardId: 'abc12345',
        title: 'Test Card'
      }
      expect(trelloCard.cardId).toBe('abc12345')
      expect(trelloCard.title).toBe('Test Card')

      const trelloBoard: TrelloBoard = {
        id: 'board123456789012345678',
        name: 'Test Board',
        prefs: { permissionLevel: 'private' }
      }
      expect(trelloBoard.id).toBe('board123456789012345678')

      const org: TrelloOrganization = { name: 'Test Org' }
      expect(org.name).toBe('Test Org')

      const prefs: TrelloBoardPrefs = { permissionLevel: 'public' }
      expect(prefs.permissionLevel).toBe('public')
    })

    test('SproutVideoDetails and SproutAssets are importable', () => {
      const assets: SproutAssets = { poster_frames: ['https://example.com/frame.jpg'] }
      expect(assets.poster_frames).toHaveLength(1)

      const details: SproutVideoDetails = {
        id: 'vid123',
        title: 'Test Video',
        duration: 120.5,
        assets: { poster_frames: [] },
        created_at: '2024-01-01T00:00:00Z'
      }
      expect(details.duration).toBe(120.5)
    })

    test('core domain types are importable and usable', () => {
      const folder: SproutFolder = {
        id: 'folder1',
        name: 'Root Folder',
        parent_id: null
      }
      expect(folder.parent_id).toBeNull()

      const response: GetFoldersResponse = {
        folders: [folder]
      }
      expect(response.folders).toHaveLength(1)

      const footage: FootageData = {
        camera: 1,
        name: 'clip_001.mp4',
        path: '/footage/clip_001.mp4'
      }
      expect(footage.camera).toBe(1)
      expect(footage.name).toBe('clip_001.mp4')
    })

    test('Breadcrumb type has expected optional fields', () => {
      const minimal: Breadcrumb = {}
      expect(minimal).toBeDefined()

      const full: Breadcrumb = {
        projectTitle: 'Test Project',
        numberOfCameras: 2,
        files: [{ camera: 1, name: 'clip.mp4', path: '/clip.mp4' }],
        parentFolder: '/projects/test',
        createdBy: 'admin',
        creationDateTime: '2024-01-01T00:00:00Z',
        folderSizeBytes: 1024,
        trelloCardUrl: 'https://trello.com/c/abc123'
      }
      expect(full.projectTitle).toBe('Test Project')
      expect(full.numberOfCameras).toBe(2)
      expect(full.files).toHaveLength(1)
    })

    test('SproutUploadResponse has expected structure', () => {
      const response: SproutUploadResponse = {
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        height: 1080,
        width: 1920,
        description: '',
        id: 'vid123',
        plays: 0,
        title: 'Test',
        source_video_file_size: 1024,
        embed_code: '<iframe></iframe>',
        state: 'ready',
        security_token: 'token123',
        progress: 100,
        tags: [],
        embedded_url: null,
        duration: 60,
        password: null,
        privacy: 1,
        requires_signed_embeds: false,
        selected_poster_frame_number: 0,
        assets: {
          videos: {
            '240p': '',
            '360p': '',
            '480p': '',
            '720p': '',
            '1080p': '',
            '2k': null,
            '4k': null,
            '8k': null,
            source: null
          },
          thumbnails: [],
          poster_frames: [],
          poster_frame_mp4: null,
          timeline_images: [],
          hls_manifest: ''
        },
        download_sd: null,
        download_hd: null,
        download_source: null,
        allowed_domains: null,
        allowed_ips: null,
        player_social_sharing: null,
        player_embed_sharing: null,
        require_email: false,
        require_name: false,
        hide_on_site: false,
        folder_id: null,
        airplay_support: null,
        session_watermarks: null,
        direct_file_access: null
      }
      expect(response.id).toBe('vid123')
      expect(response.height).toBe(1080)
      expect(response.width).toBe(1920)
    })
  })
})
