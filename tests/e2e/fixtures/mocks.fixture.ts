import type { BreadcrumbsFile, ProjectFolder, ScanResult } from '@features/Baker'
import type { ExampleWithMetadata } from '@shared/types/exampleEmbeddings'
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

/** Root folder the directory picker hands back. */
export const SCAN_ROOT = '/test'

/** Ollama model name the embedding dialogs require. */
const OLLAMA_MODEL = 'nomic-embed-text'

export interface TauriMockOptions {
  /** Folder the directory picker returns for Baker's scan root. */
  scanRoot?: string
  /** Examples the Example Embeddings page loads. */
  examples?: ExampleWithMetadata[]
  /** Projects a completed scan reports. */
  projects?: ProjectFolder[]
}

/**
 * Install the Tauri IPC mock for E2E tests.
 *
 * This serves the mock data declared above rather than returning `null` for
 * everything. It used to answer only `get_version` and a couple of path
 * commands, which left the Baker project list empty and crashed the Example
 * Embeddings page into its error boundary - `get_all_examples_with_metadata`
 * returned `null`, and `null.filter(...)` throws during render. That is why
 * every assertion in the two specs that used this fixture had to be a soft
 * `count >= 0` check: there was nothing on screen to assert (issue #171).
 *
 * Call before `page.goto`, since it installs as an init script.
 */
export async function setupTauriMocks(
  page: Page,
  options: TauriMockOptions = {}
): Promise<void> {
  const projects = options.projects ?? mockScanResults
  const config = {
    scanRoot: options.scanRoot ?? SCAN_ROOT,
    examples: options.examples ?? mockExamples,
    projects,
    breadcrumbs: mockBreadcrumbs,
    // endTime is present, so useBakerScan's 2s status poll treats the scan as
    // finished. Events are registered but never delivered here, so the poll is
    // the route completion actually arrives by.
    scanResult: {
      ...mockScanResult,
      rootPath: options.scanRoot ?? SCAN_ROOT,
      validProjects: projects.length,
      projects
    }
  }

  await page.addInitScript((cfg: typeof config) => {
    type Internals = {
      invoke: (cmd: string, args?: unknown) => Promise<unknown>
      transformCallback: (callback?: (response: unknown) => void) => number
      convertFileSrc: (filePath: string) => string
      unregisterCallback: (id: number) => void
      metadata: {
        windows: Array<{ label: string }>
        currentWindow: { label: string }
      }
    }
    const win = window as unknown as {
      __TAURI__?: unknown
      __TAURI_INTERNALS__?: Internals
      __E2E_CALLBACKS__: Record<number, (response: unknown) => void>
    }

    /** No trailing separator, matching the real appDataDir (issue #167). */
    const APP_DATA_DIR = '/tmp/bucket-test/data'

    /** The app data directory itself, or something genuinely inside it. */
    const isInsideAppData = (path: string) =>
      path === APP_DATA_DIR || path.startsWith(`${APP_DATA_DIR}/`)

    let nextId = 1
    win.__E2E_CALLBACKS__ = {}

    // plugin:fs|read_text_file returns BYTES, which the plugin then decodes.
    // Returning a string yields garbage after Uint8Array.from().
    const asBytes = (text: string) => Array.from(new TextEncoder().encode(text))

    const projectAt = (path: string) => cfg.projects.find((entry) => entry.path === path)

    const invoke = async (cmd: string, args?: unknown): Promise<unknown> => {
      const payload = (args ?? {}) as Record<string, unknown>

      switch (cmd) {
        case 'get_username':
          return 'Test User'

        // Example Embeddings. Must be an array: the page filters it directly,
        // so null crashes the render into the error boundary.
        case 'get_all_examples_with_metadata':
          return cfg.examples
        case 'delete_example':
        case 'replace_example':
          return null
        case 'upload_example':
          return 'new-example-id'

        // Baker. A titled directory dialog is Baker's scan-root picker.
        case 'plugin:dialog|open': {
          const opts = (payload.options ?? payload) as { directory?: boolean }
          return opts?.directory ? cfg.scanRoot : `${cfg.scanRoot}/clip.mp4`
        }
        case 'baker_start_scan':
          return 'scan-e2e-1'
        case 'baker_get_scan_status':
          return cfg.scanResult
        case 'baker_cancel_scan':
          return null
        case 'baker_validate_folder':
          return projectAt(String(payload.folderPath ?? '')) ?? null
        case 'baker_read_breadcrumbs': {
          const project = projectAt(String(payload.projectPath ?? ''))
          if (!project?.hasBreadcrumbs) return null
          return {
            ...cfg.breadcrumbs,
            projectTitle: project.name,
            parentFolder: project.path
          }
        }
        case 'baker_read_raw_breadcrumbs':
          return null
        case 'baker_scan_current_files':
          return []
        case 'baker_get_video_links':
        case 'baker_get_trello_cards':
          return []
        case 'get_folder_size':
          return 1024

        // Must be a numeric listener id: null makes hooks that check it report
        // a listener failure and hide whole panels.
        case 'plugin:event|listen':
          return nextId++
        case 'plugin:event|unlisten':
          return null

        // join must genuinely concatenate, or every file the app joins onto the
        // app data directory collapses onto one path (issue #167).
        case 'plugin:path|join': {
          const parts = (payload.paths as string[]) ?? []
          return parts.join('/').replace(/\/{2,}/g, '/')
        }
        case 'plugin:path|resolve_directory':
          return APP_DATA_DIR

        // A path beside the app data directory rather than inside it is the
        // pre-#167 layout. E2E runs start already migrated, so those siblings
        // must report absent - answering `true` makes the app believe there is
        // a stray settings file to move and then stat a path that is not there.
        // The directory itself must report present, or every run takes the
        // mkdir branch.
        case 'plugin:fs|exists':
          return isInsideAppData(String(payload.path ?? ''))
        case 'plugin:fs|stat': {
          const path = String(payload.path ?? '')
          if (!isInsideAppData(path)) throw `No such file or directory: ${path}`
          return {
            isFile: path !== APP_DATA_DIR,
            isDirectory: path === APP_DATA_DIR,
            isSymlink: false,
            size: 2,
            readonly: false,
            fileAttributes: 0
          }
        }
        case 'plugin:fs|read_text_file':
          return asBytes('{}')
        case 'plugin:fs|read_dir':
          return []
        case 'plugin:fs|mkdir':
        case 'plugin:fs|write_text_file':
        case 'plugin:fs|write_file':
          return null

        case 'tauri': {
          const inner = (payload as { cmd?: string }).cmd
          if (inner === 'plugin:path|join') {
            const parts = (payload.paths as string[]) ?? []
            return parts.join('/').replace(/\/{2,}/g, '/')
          }
          if (inner?.startsWith('plugin:path|')) return APP_DATA_DIR
          return null
        }

        default:
          if (cmd.startsWith('plugin:path|')) return APP_DATA_DIR
          if (cmd.startsWith('plugin:')) return null
          // eslint-disable-next-line no-console
          console.warn(`[E2E Mock] Unhandled Tauri command: ${cmd}`, args)
          return null
      }
    }

    win.__TAURI_INTERNALS__ = {
      invoke,
      transformCallback: (callback) => {
        const id = nextId++
        if (callback) win.__E2E_CALLBACKS__[id] = callback
        return id
      },
      convertFileSrc: (filePath) => filePath,
      unregisterCallback: (id) => {
        delete win.__E2E_CALLBACKS__[id]
      },
      metadata: {
        windows: [{ label: 'main' }],
        currentWindow: { label: 'main' }
      }
    }
    win.__TAURI__ = win.__TAURI_INTERNALS__
  }, config)
}

/**
 * Serve the Ollama embedding endpoints the upload and replace dialogs probe.
 *
 * Without this the dialogs read "Embedding model not available" and their
 * submit button is stuck at "Model Not Ready" - and worse, the outcome depends
 * on whether the machine running the test happens to have Ollama listening on
 * 11434.
 */
export async function mockOllamaEmbedding(page: Page): Promise<void> {
  await page.route('**/api/tags', (route) =>
    route.fulfill({ json: { models: [{ name: `${OLLAMA_MODEL}:latest` }] } })
  )
  await page.route('**/api/embeddings', (route) =>
    route.fulfill({ json: { embedding: Array.from({ length: 8 }, () => 0.1) } })
  )
}
