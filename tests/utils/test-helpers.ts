import type { BreadcrumbsFile, TrelloCard, VideoLink } from '@/types/baker'

export function createTestBreadcrumbs(
  overrides?: Partial<BreadcrumbsFile>
): BreadcrumbsFile {
  return {
    projectTitle: 'Test Project',
    numberOfCameras: 2,
    files: [],
    parentFolder: '/test/parent',
    createdBy: 'test@example.com',
    creationDateTime: '2025-01-20T10:00:00.000Z',
    ...overrides
  }
}

export function createMockVideoLink(overrides?: Partial<VideoLink>): VideoLink {
  return {
    url: 'https://sproutvideo.com/videos/test123',
    title: 'Test Video',
    ...overrides
  }
}

export function createMockTrelloCard(overrides?: Partial<TrelloCard>): TrelloCard {
  return {
    url: 'https://trello.com/c/testcard/project',
    cardId: 'testcard',
    title: 'Test Card',
    ...overrides
  }
}
