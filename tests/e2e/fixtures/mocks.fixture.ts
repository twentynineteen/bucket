import type { BreadcrumbsFile, ProjectFolder, ScanResult } from '@/types/baker'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'
import { Page } from '@playwright/test'

/**
 * Mock data and helpers for Tauri API mocking
 */

/**
 * Mock breadcrumbs file (matches BreadcrumbsFile interface)
 */
export const mockBreadcrumbs: BreadcrumbsFile = {
  projectTitle: 'Test Project',
  numberOfCameras: 2,
  files: [
    { camera: 1, name: 'A001_001.mov', path: '/Footage/A001_001.mov' },
    { camera: 2, name: 'B001_001.mov', path: '/Footage/B001_001.mov' }
  ],
  parentFolder: '/test/project',
  createdBy: 'Test User',
  creationDateTime: '2024-01-15T10:00:00Z',
  folderSizeBytes: 1024000,
  videoLinks: [],
  trelloCards: []
}

/**
 * Mock project folder (matches ProjectFolder interface)
 */
export const mockProjectFolder: ProjectFolder = {
  path: '/test/project',
  name: 'Test Project',
  isValid: true,
  hasBreadcrumbs: true,
  staleBreadcrumbs: false,
  invalidBreadcrumbs: false,
  lastScanned: '2024-01-15T10:00:00Z',
  cameraCount: 2,
  validationErrors: []
}

/**
 * Mock example embedding data (matches ExampleWithMetadata interface)
 */
export const mockExamples: ExampleWithMetadata[] = [
  {
    id: '1',
    title: 'Educational Script Example',
    category: 'educational',
    beforeText: 'Original script content for testing',
    afterText: 'Formatted script content for testing',
    tags: ['tutorial', 'beginner'],
    wordCount: 150,
    qualityScore: 4,
    source: 'bundled',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    title: 'Business Script Example',
    category: 'business',
    beforeText: 'Another original script',
    afterText: 'Another formatted script',
    tags: ['corporate', 'presentation'],
    wordCount: 200,
    qualityScore: 5,
    source: 'bundled',
    createdAt: '2024-01-02T00:00:00Z'
  },
  {
    id: '3',
    title: 'User Custom Script',
    category: 'user-custom',
    beforeText: 'User uploaded original script',
    afterText: 'User uploaded formatted script',
    tags: ['custom'],
    wordCount: 100,
    qualityScore: 3,
    source: 'user-uploaded',
    createdAt: '2024-01-10T00:00:00Z'
  }
]

/**
 * Mock scan results for Baker (matches ProjectFolder[])
 */
export const mockScanResults: ProjectFolder[] = [
  {
    path: '/test/project-1',
    name: 'Project One',
    isValid: true,
    hasBreadcrumbs: true,
    staleBreadcrumbs: false,
    invalidBreadcrumbs: false,
    lastScanned: '2024-01-15T10:00:00Z',
    cameraCount: 2,
    validationErrors: []
  },
  {
    path: '/test/project-2',
    name: 'Project Two',
    isValid: true,
    hasBreadcrumbs: true,
    staleBreadcrumbs: true,
    invalidBreadcrumbs: false,
    lastScanned: '2024-01-14T10:00:00Z',
    cameraCount: 3,
    validationErrors: []
  },
  {
    path: '/test/project-3',
    name: 'Project Three',
    isValid: true,
    hasBreadcrumbs: false,
    staleBreadcrumbs: false,
    invalidBreadcrumbs: false,
    lastScanned: '2024-01-13T10:00:00Z',
    cameraCount: 1,
    validationErrors: []
  }
]

/**
 * Mock complete scan result (matches ScanResult interface)
 */
export const mockScanResult: ScanResult = {
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:05:00Z',
  rootPath: '/test',
  totalFolders: 10,
  validProjects: 3,
  updatedBreadcrumbs: 1,
  createdBreadcrumbs: 0,
  totalFolderSize: 5120000,
  errors: [],
  projects: mockScanResults
}

/**
 * Setup common Tauri mocks for E2E tests
 */
export async function setupTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Create mock Tauri objects IMMEDIATELY before any scripts run
    // Tauri v2 uses __TAURI_INTERNALS__ for the main API
    if (typeof window !== 'undefined') {
      const tauriWindow = window as {
        __TAURI__?: unknown
        __TAURI_INTERNALS__?: {
          invoke: (cmd: string, args?: unknown) => Promise<unknown>
          metadata: {
            windows: Array<{ label: string }>
            currentWindow: { label: string }
          }
        }
      }

      const mockInvoke = async (cmd: string, args?: unknown) => {
        // Return mock data based on command
        switch (cmd) {
          case 'get_version':
            return '0.9.3'
          case 'check_auth':
            return { authenticated: true, user: 'test@example.com' }
          case 'get_preferences':
            return {
              defaultPath: '/Users/test',
              theme: 'system'
            }
          case 'tauri':
            // Handle nested Tauri API calls
            if (args && typeof args === 'object' && 'cmd' in args) {
              const innerCmd = (args as { cmd: string }).cmd
              switch (innerCmd) {
                case 'plugin:path|app_data_dir':
                case 'plugin:path|resolve_directory':
                  return '/tmp/bucket-test/data'
                case 'plugin:path|app_dir':
                  return '/tmp/bucket-test/app'
                case 'plugin:path|resource_dir':
                  return '/tmp/bucket-test/resources'
                default:
                  // eslint-disable-next-line no-console
                  console.warn(`[E2E Mock] Unhandled nested Tauri command: ${innerCmd}`)
                  return null
              }
            }
            return null
          default:
            // Log unhandled commands for debugging
            // eslint-disable-next-line no-console
            console.warn(`[E2E Mock] Unhandled Tauri command: ${cmd}`, args)
            return null
        }
      }

      // Tauri v2 uses __TAURI_INTERNALS__
      tauriWindow.__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        metadata: {
          windows: [{ label: 'main' }],
          currentWindow: { label: 'main' }
        }
      }

      // Also set __TAURI__ for backwards compatibility
      tauriWindow.__TAURI__ = tauriWindow.__TAURI_INTERNALS__
    }
  })
}

/**
 * Mock file dialog responses
 */
export async function mockFileDialog(
  page: Page,
  response: string | string[] | null
): Promise<void> {
  await page.evaluate(dialogResponse => {
    const tauriWindow = window as {
      __TAURI__?: {
        dialog?: {
          open: () => Promise<string | string[] | null>
        }
      }
    }

    if (tauriWindow.__TAURI__) {
      tauriWindow.__TAURI__.dialog = {
        open: async () => dialogResponse
      }
    }
  }, response)
}

/**
 * Mock file system operations
 */
export async function mockFileSystem(
  page: Page,
  files: Record<string, string>
): Promise<void> {
  await page.evaluate(mockFiles => {
    const tauriWindow = window as {
      __TAURI__?: {
        fs?: {
          readTextFile: (path: string) => Promise<string>
          writeTextFile: (path: string, contents: string) => Promise<void>
          exists: (path: string) => Promise<boolean>
        }
      }
    }

    if (tauriWindow.__TAURI__) {
      tauriWindow.__TAURI__.fs = {
        readTextFile: async (path: string) => {
          if (path in mockFiles) {
            return mockFiles[path]
          }
          throw new Error(`File not found: ${path}`)
        },
        writeTextFile: async (path: string, contents: string) => {
          mockFiles[path] = contents
        },
        exists: async (path: string) => {
          return path in mockFiles
        }
      }
    }
  }, files)
}
