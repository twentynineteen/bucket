import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { sproutHandlers } from './sprout-handlers'
import { trelloHandlers } from './trello-handlers'

// Mock API responses based on the domains from query-keys
const handlers = [
  ...trelloHandlers,
  ...sproutHandlers,
  // Projects API
  http.get('/api/projects', () => {
    return HttpResponse.json({
      projects: [
        { id: '1', name: 'Test Project 1', status: 'active' },
        { id: '2', name: 'Test Project 2', status: 'completed' }
      ]
    })
  }),

  http.get('/api/projects/:id', ({ params }) => {
    const { id } = params
    return HttpResponse.json({
      id,
      name: `Test Project ${id}`,
      status: 'active',
      files: [],
      settings: {}
    })
  }),

  http.post('/api/projects', () => {
    return HttpResponse.json(
      {
        id: '3',
        name: 'New Test Project',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      { status: 201 }
    )
  }),

  // Files API
  http.get('/api/files/selection/:projectId', ({ params }) => {
    const { projectId } = params
    return HttpResponse.json({
      projectId,
      files: [
        { id: '1', name: 'video1.mp4', size: 1024000, cameraNumber: 1 },
        { id: '2', name: 'video2.mp4', size: 2048000, cameraNumber: 2 }
      ],
      lastModified: new Date().toISOString()
    })
  }),

  http.get('/api/files/tree', ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || 'root'
    return HttpResponse.json({
      path,
      folders: [
        { name: 'subfolder1', type: 'directory' },
        { name: 'subfolder2', type: 'directory' }
      ],
      files: [
        { name: 'file1.mp4', type: 'file', size: 1024000 },
        { name: 'file2.mp4', type: 'file', size: 2048000 }
      ]
    })
  }),

  // Trello API
  http.get('/api/trello/boards', () => {
    return HttpResponse.json({
      boards: [
        {
          id: 'board1',
          name: 'Video Production Board',
          url: 'https://trello.com/b/board1'
        },
        {
          id: 'board2',
          name: 'Post Production Board',
          url: 'https://trello.com/b/board2'
        }
      ]
    })
  }),

  // User API
  http.get('/api/user/profile', () => {
    return HttpResponse.json({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      preferences: {
        theme: 'dark',
        autoSave: true
      }
    })
  }),

  http.get('/api/user/breadcrumb', () => {
    return HttpResponse.json({
      path: '/projects/test-project/videos',
      items: [
        { name: 'Projects', url: '/projects' },
        { name: 'Test Project', url: '/projects/test-project' },
        { name: 'Videos', url: '/projects/test-project/videos' }
      ]
    })
  }),

  // Upload API
  http.get('/api/upload/events', () => {
    return HttpResponse.json({
      events: [
        {
          id: 'event1',
          type: 'upload_started',
          timestamp: new Date().toISOString(),
          data: { filename: 'video1.mp4' }
        }
      ]
    })
  }),

  // Images API
  http.get('/api/images/refresh/:imageId', ({ params }) => {
    const { imageId } = params
    return HttpResponse.json({
      id: imageId,
      url: `https://example.com/images/${imageId}.jpg?t=${Date.now()}`,
      lastModified: new Date().toISOString()
    })
  }),

  // Error handlers for testing
  http.get('/api/error/network', () => {
    return HttpResponse.error()
  }),

  http.get('/api/error/server', () => {
    return HttpResponse.json(
      {
        error: 'Internal server error',
        message: 'Something went wrong'
      },
      { status: 500 }
    )
  })
]

export const server = setupServer(...handlers)

// Error simulation helpers
export const simulateNetworkError = (endpoint: string) => {
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.error()
    })
  )
}

export const simulateServerError = (
  endpoint: string,
  status: number = 500,
  message: string = 'Server error'
) => {
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json({ error: message }, { status })
    })
  )
}

export const mockApiResponse = (
  endpoint: string,
  responseData: unknown,
  status: number = 200
) => {
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json(responseData, { status })
    })
  )
}

// Test setup helpers
export const resetMockHandlers = () => {
  server.resetHandlers()
}

export const enableMockLogging = () => {
  // MSW v2 logging is handled differently
  console.log('MSW logging enabled')
}
