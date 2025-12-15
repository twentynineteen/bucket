/**
 * Test Utility: Mock Data Factories
 * Purpose: Create consistent mock data for tests
 */

import type { Breadcrumb } from '@/utils/types'

/**
 * Create mock breadcrumbs data
 */
export const createMockBreadcrumbs = (
  overrides: Partial<Breadcrumb> = {}
): Breadcrumb => {
  return {
    projectTitle: 'Test Project',
    numberOfCameras: 2,
    files: [],
    parentFolder: '/test/parent',
    createdBy: 'Test User',
    creationDateTime: new Date().toISOString(),
    folderSizeBytes: 1024000,
    ...overrides
  }
}

/**
 * Create mock Baker scan result
 */
export const createMockBakerScanResult = (overrides = {}) => {
  return {
    scanId: 'scan-123',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    projectsFound: [],
    successful: [],
    failed: [],
    created: [],
    errors: [],
    ...overrides
  }
}

/**
 * Create mock Baker validate folder result
 */
export const createMockValidateFolderResult = (overrides = {}) => {
  return {
    isValid: true,
    hasBreadcrumbs: true,
    hasFootage: true,
    hasProjects: true,
    cameraCount: 2,
    lastScanned: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock Trello card
 */
export const createMockTrelloCard = (overrides = {}) => {
  return {
    id: 'card-123',
    name: 'Test Card',
    desc: 'Test description',
    url: 'https://trello.com/c/card-123',
    idBoard: 'board-456',
    ...overrides
  }
}

/**
 * Create mock Sprout Video response
 */
export const createMockSproutVideoResponse = (overrides = {}) => {
  return {
    id: 'video-123',
    embedded_url: 'https://videos.sproutvideo.com/embed/abc123',
    title: 'Test Video',
    state: 'deployed',
    assets: {
      poster_frames: ['https://example.com/poster.jpg']
    },
    created_at: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock video link
 */
export const createMockVideoLink = (overrides = {}) => {
  return {
    url: 'https://videos.sproutvideo.com/embed/abc123',
    sproutVideoId: 'abc123',
    title: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    uploadDate: new Date().toISOString(),
    sourceRenderFile: 'test-video.mp4',
    ...overrides
  }
}

/**
 * Create mock file object
 */
export const createMockFile = (overrides = {}) => {
  return {
    path: '/test/file.mp4',
    name: 'file.mp4',
    size: 1024000,
    ...overrides
  }
}

/**
 * Create mock footage file with camera assignment
 */
export const createMockFootageFile = (overrides = {}) => {
  return {
    file: createMockFile(),
    camera: 1,
    ...overrides
  }
}

/**
 * Create mock API keys
 */
export const createMockApiKeys = (overrides = {}) => {
  return {
    sproutVideoApiKey: 'test-sprout-key',
    trelloApiKey: 'test-trello-key',
    trelloToken: 'test-trello-token',
    openaiApiKey: null,
    ...overrides
  }
}

/**
 * Create mock user profile
 */
export const createMockUserProfile = (overrides = {}) => {
  return {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create mock authentication state
 */
export const createMockAuthState = (overrides = {}) => {
  return {
    isAuthenticated: true,
    user: createMockUserProfile(),
    token: 'mock-jwt-token',
    ...overrides
  }
}
