import type { QueryKey } from './query-utils'

export const queryKeys = {
  // Projects domain
  projects: {
    all: ['projects'] as const,
    lists: () => ['projects', 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['projects', 'list', { filters }] as const,
    details: () => ['projects', 'detail'] as const,
    detail: (id: string | number) => ['projects', 'detail', id] as const,
    status: (id: string | number) => ['projects', 'status', id] as const
  },

  // Files domain
  files: {
    all: ['files'] as const,
    selections: () => ['files', 'selection'] as const,
    selection: (projectId: string | number) => ['files', 'selection', projectId] as const,
    tree: (path?: string) => ['files', 'tree', path || 'root'] as const,
    progress: (operationId: string) => ['files', 'progress', operationId] as const,
    autoSelection: (criteria: Record<string, unknown>) =>
      ['files', 'auto-selection', JSON.stringify(criteria)] as const
  },

  // Trello domain
  trello: {
    all: ['trello'] as const,
    boards: () => ['trello', 'boards'] as const,
    board: (boardId: string) => ['trello', 'board', boardId] as const,
    cards: (boardId: string) => ['trello', 'cards', boardId] as const,
    card: (cardId: string) => ['trello', 'card', cardId] as const,
    lists: (boardId: string) => ['trello', 'lists', boardId] as const,
    integration: (projectId: string | number) =>
      ['trello', 'integration', projectId] as const
  },

  // User domain
  user: {
    all: ['user'] as const,
    profile: () => ['user', 'profile'] as const,
    preferences: () => ['user', 'preferences'] as const,
    authentication: () => ['user', 'authentication'] as const,
    breadcrumb: () => ['user', 'breadcrumb'] as const
  },

  // Settings domain
  settings: {
    all: ['settings'] as const,
    preferences: () => ['settings', 'preferences'] as const,
    configuration: () => ['settings', 'configuration'] as const,
    theme: () => ['settings', 'theme'] as const,
    integrations: () => ['settings', 'integrations'] as const,
    apiKeys: () => ['settings', 'api-keys'] as const
  },

  // Sprout domain
  sprout: {
    all: ['sprout'] as const,
    folders: (apiKey: string, parentId: string | null) =>
      ['sprout', 'folders', apiKey, parentId || 'root'] as const,
    videos: (apiKey: string) => ['sprout', 'videos', apiKey] as const,
    video: (apiKey: string, videoId: string) =>
      ['sprout', 'video', apiKey, videoId] as const
  },

  // Upload domain
  upload: {
    all: ['upload'] as const,
    events: () => ['upload', 'events'] as const,
    event: (eventId: string) => ['upload', 'event', eventId] as const,
    progress: (uploadId: string) => ['upload', 'progress', uploadId] as const,
    status: (uploadId: string) => ['upload', 'status', uploadId] as const,
    sprout: {
      all: () => ['upload', 'sprout'] as const,
      video: (videoId: string) => ['upload', 'sprout', 'video', videoId] as const,
      posterframe: (videoId: string) =>
        ['upload', 'sprout', 'posterframe', videoId] as const
    }
  },

  // Image/Canvas domain
  images: {
    all: ['images'] as const,
    refresh: (imageId: string) => ['images', 'refresh', imageId] as const,
    zoomPan: (containerId: string) => ['images', 'zoom-pan', containerId] as const,
    posterframe: {
      all: () => ['images', 'posterframe'] as const,
      redraw: (canvasId: string) =>
        ['images', 'posterframe', 'redraw', canvasId] as const,
      autoRedraw: (videoId: string) =>
        ['images', 'posterframe', 'auto-redraw', videoId] as const
    }
  },

  // Camera domain
  camera: {
    all: ['camera'] as const,
    mapping: () => ['camera', 'mapping'] as const,
    autoRemap: (projectId: string | number) =>
      ['camera', 'auto-remap', projectId] as const,
    assignment: (fileId: string) => ['camera', 'assignment', fileId] as const
  }
} as const

export type QueryKeyFactory = typeof queryKeys

export interface InvalidationRule {
  trigger: QueryKey
  invalidates: QueryKey[]
  strategy: 'exact' | 'prefix' | 'predicate'
}

export const invalidationRules: InvalidationRule[] = [
  // Project operations
  {
    trigger: ['projects', 'create'],
    invalidates: [queryKeys.projects.lists()],
    strategy: 'exact'
  },
  {
    trigger: ['projects', 'update'],
    invalidates: [queryKeys.projects.lists()],
    strategy: 'prefix'
  },

  // File operations
  {
    trigger: ['files', 'upload-complete'],
    invalidates: [queryKeys.projects.lists(), queryKeys.files.selections()],
    strategy: 'prefix'
  },
  {
    trigger: ['files', 'selection-change'],
    invalidates: [queryKeys.files.selections()],
    strategy: 'prefix'
  },

  // User profile updates
  {
    trigger: ['user', 'profile-update'],
    invalidates: [queryKeys.user.profile(), queryKeys.user.breadcrumb()],
    strategy: 'exact'
  },

  // Settings changes
  {
    trigger: ['settings', 'update'],
    invalidates: [queryKeys.settings.all],
    strategy: 'prefix'
  },

  // Trello integration updates
  {
    trigger: ['trello', 'board-update'],
    invalidates: [queryKeys.trello.boards()],
    strategy: 'prefix'
  }
]

export function createQueryKey<T extends QueryKey>(key: T): T {
  return key
}

export function isQueryKeyMatch(
  queryKey: QueryKey,
  pattern: QueryKey,
  strategy: InvalidationRule['strategy'] = 'exact'
): boolean {
  switch (strategy) {
    case 'exact':
      return JSON.stringify(queryKey) === JSON.stringify(pattern)

    case 'prefix':
      if (pattern.length > queryKey.length) return false
      return pattern.every((segment, index) => queryKey[index] === segment)

    case 'predicate':
      // For now, treat predicate same as prefix
      // Can be extended with custom predicate functions later
      return isQueryKeyMatch(queryKey, pattern, 'prefix')

    default:
      return false
  }
}

export function getInvalidationQueries(triggerKey: QueryKey): QueryKey[] {
  const matchingRules = invalidationRules.filter((rule) =>
    isQueryKeyMatch(triggerKey, rule.trigger, rule.strategy)
  )

  return matchingRules.flatMap((rule) => rule.invalidates)
}

export function validateQueryKey(key: QueryKey): boolean {
  if (!Array.isArray(key) || key.length < 2) {
    return false
  }

  const [domain, action] = key
  const validDomains = [
    'projects',
    'trello',
    'files',
    'user',
    'settings',
    'upload',
    'images',
    'camera'
  ]

  if (typeof domain !== 'string' || !validDomains.includes(domain)) {
    return false
  }

  if (typeof action !== 'string') {
    return false
  }

  // Validate identifiers are strings or numbers
  const identifiers = key.slice(2)
  return identifiers.every(
    (id) => typeof id === 'string' || typeof id === 'number' || typeof id === 'object'
  )
}

// Helper functions for common patterns
export function createPaginatedQueryKey(
  baseKey: QueryKey,
  page: number,
  limit: number,
  filters?: Record<string, unknown>
): QueryKey {
  return [...baseKey, { page, limit, filters }] as QueryKey
}

export function createTimeRangeQueryKey(
  baseKey: QueryKey,
  startDate: string,
  endDate: string
): QueryKey {
  return [...baseKey, { startDate, endDate }] as QueryKey
}

export function createUserScopedQueryKey(
  baseKey: QueryKey,
  userId: string | number
): QueryKey {
  return [...baseKey, 'user', userId] as QueryKey
}
