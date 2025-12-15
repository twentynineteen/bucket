import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { BreadcrumbsFile, TrelloCard, VideoLink } from '@/types/baker'
import { mockIPC } from '@tauri-apps/api/mocks'

export function setupTauriMocks() {
  // Mock breadcrumbs file storage (in-memory)
  const mockBreadcrumbsStore = new Map<string, BreadcrumbsFile>()

  mockIPC((cmd, args) => {
    switch (cmd) {
      case 'baker_get_video_links': {
        const breadcrumbs = mockBreadcrumbsStore.get(args.projectPath as string)
        return Promise.resolve(breadcrumbs?.videoLinks ?? [])
      }

      case 'baker_associate_video_link': {
        const projectPath = args.projectPath as string
        const videoLink = args.videoLink as VideoLink
        const existing =
          mockBreadcrumbsStore.get(projectPath) || createEmptyBreadcrumbs(projectPath)

        // Validate max 20 videos
        if ((existing.videoLinks?.length ?? 0) >= 20) {
          return Promise.reject('Maximum of 20 videos per project reached')
        }

        existing.videoLinks = [...(existing.videoLinks ?? []), videoLink]
        existing.lastModified = new Date().toISOString()
        mockBreadcrumbsStore.set(projectPath, existing)
        return Promise.resolve(existing)
      }

      case 'baker_remove_video_link': {
        const projectPath = args.projectPath as string
        const videoIndex = args.videoIndex as number
        const breadcrumbs = mockBreadcrumbsStore.get(projectPath)

        if (!breadcrumbs || !breadcrumbs.videoLinks) {
          return Promise.reject('No videos found')
        }

        if (videoIndex < 0 || videoIndex >= breadcrumbs.videoLinks.length) {
          return Promise.reject('Video index out of bounds')
        }

        breadcrumbs.videoLinks.splice(videoIndex, 1)
        breadcrumbs.lastModified = new Date().toISOString()
        return Promise.resolve(breadcrumbs)
      }

      case 'baker_update_video_link': {
        const projectPath = args.projectPath as string
        const videoIndex = args.videoIndex as number
        const updatedLink = args.updatedLink as VideoLink
        const breadcrumbs = mockBreadcrumbsStore.get(projectPath)

        if (!breadcrumbs || !breadcrumbs.videoLinks) {
          return Promise.reject('No videos found')
        }

        if (videoIndex < 0 || videoIndex >= breadcrumbs.videoLinks.length) {
          return Promise.reject('Video index out of bounds')
        }

        breadcrumbs.videoLinks[videoIndex] = updatedLink
        breadcrumbs.lastModified = new Date().toISOString()
        return Promise.resolve(breadcrumbs)
      }

      case 'baker_reorder_video_links': {
        const projectPath = args.projectPath as string
        const fromIndex = args.fromIndex as number
        const toIndex = args.toIndex as number
        const breadcrumbs = mockBreadcrumbsStore.get(projectPath)

        if (!breadcrumbs || !breadcrumbs.videoLinks) {
          return Promise.reject('No videos found')
        }

        const videos = breadcrumbs.videoLinks
        if (
          fromIndex < 0 ||
          fromIndex >= videos.length ||
          toIndex < 0 ||
          toIndex >= videos.length
        ) {
          return Promise.reject('Index out of bounds')
        }

        // Move item from fromIndex to toIndex
        const [removed] = videos.splice(fromIndex, 1)
        videos.splice(toIndex, 0, removed)

        breadcrumbs.lastModified = new Date().toISOString()
        return Promise.resolve(breadcrumbs)
      }

      case 'baker_get_trello_cards': {
        const breadcrumbs = mockBreadcrumbsStore.get(args.projectPath as string)
        if (!breadcrumbs) {
          return Promise.resolve([])
        }

        // Migration: If no trelloCards array but trelloCardUrl exists, migrate in-memory
        if (!breadcrumbs.trelloCards && breadcrumbs.trelloCardUrl) {
          const match = breadcrumbs.trelloCardUrl.match(
            /trello\.com\/c\/([a-zA-Z0-9]{8,24})/
          )
          if (match) {
            const cardId = match[1]
            return Promise.resolve([
              {
                url: breadcrumbs.trelloCardUrl,
                cardId,
                title: `Card ${cardId}` // Default title for migrated cards
              }
            ])
          }
        }

        return Promise.resolve(breadcrumbs.trelloCards ?? [])
      }

      case 'baker_associate_trello_card': {
        const projectPath = args.projectPath as string
        const trelloCard = args.trelloCard as TrelloCard
        const existing =
          mockBreadcrumbsStore.get(projectPath) || createEmptyBreadcrumbs(projectPath)

        // Validate max 10 cards
        if ((existing.trelloCards?.length ?? 0) >= 10) {
          return Promise.reject('Maximum of 10 Trello cards per project reached')
        }

        // Check for duplicate cardId
        if (existing.trelloCards?.some(c => c.cardId === trelloCard.cardId)) {
          return Promise.reject('This Trello card is already associated with the project')
        }

        existing.trelloCards = [...(existing.trelloCards ?? []), trelloCard]
        // Update backward-compatible field
        if (existing.trelloCards.length === 1) {
          existing.trelloCardUrl = trelloCard.url
        }
        existing.lastModified = new Date().toISOString()
        mockBreadcrumbsStore.set(projectPath, existing)
        return Promise.resolve(existing)
      }

      case 'baker_remove_trello_card': {
        const projectPath = args.projectPath as string
        const cardIndex = args.cardIndex as number
        const breadcrumbs = mockBreadcrumbsStore.get(projectPath)

        if (!breadcrumbs || !breadcrumbs.trelloCards) {
          return Promise.reject('No cards found')
        }

        if (cardIndex < 0 || cardIndex >= breadcrumbs.trelloCards.length) {
          return Promise.reject('Card index out of bounds')
        }

        breadcrumbs.trelloCards.splice(cardIndex, 1)
        // Update backward-compatible field
        breadcrumbs.trelloCardUrl =
          breadcrumbs.trelloCards.length > 0 ? breadcrumbs.trelloCards[0].url : undefined
        breadcrumbs.lastModified = new Date().toISOString()
        return Promise.resolve(breadcrumbs)
      }

      case 'baker_fetch_trello_card_details': {
        const cardUrl = args.cardUrl as string
        const apiKey = args.apiKey as string
        const apiToken = args.apiToken as string

        // Extract cardId from URL
        const match = cardUrl.match(/trello\.com\/c\/([a-zA-Z0-9]{8,24})/)
        if (!match) {
          return Promise.reject('Invalid Trello card URL format')
        }

        const cardId = match[1]

        // This will be intercepted by MSW in actual tests
        return fetch(
          `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`
        ).then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              return Promise.reject('Unauthorized: Invalid API credentials')
            }
            if (res.status === 404) {
              return Promise.reject('Card not found')
            }
            return Promise.reject(`API error: ${res.status}`)
          }
          return res.json().then(data => ({
            url: cardUrl,
            cardId,
            title: data.name,
            boardName: data.idBoard ? 'Mock Board Name' : undefined,
            lastFetched: new Date().toISOString()
          }))
        })
      }

      // Baker scan commands - return basic mocks for contract tests
      case 'baker_start_scan': {
        const rootPath = args.rootPath as string
        const options = args.options as any

        // Validate input
        if (!rootPath || rootPath === '') {
          return Promise.reject(new Error('Root path is required'))
        }
        if (rootPath === '/non/existent/path') {
          return Promise.reject(new Error('Root path does not exist'))
        }
        if (options) {
          // Validate maxDepth
          if (options.maxDepth !== undefined && options.maxDepth < 0) {
            return Promise.reject(new Error('maxDepth must be non-negative'))
          }
          if (options.invalid) {
            return Promise.reject(new Error('Invalid scan options'))
          }
        }

        // Generate a UUID-like scan ID
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
        return Promise.resolve(uuid)
      }

      case 'baker_cancel_scan': {
        const scanId = args.scanId as string
        // Validate scan ID
        if (!scanId || scanId === 'invalid-scan-id') {
          return Promise.reject(new Error('Invalid scan ID'))
        }
        // Cancel is a void operation
        return Promise.resolve(undefined)
      }

      case 'baker_get_scan_status': {
        const scanId = args.scanId as string

        // Validate scan ID
        if (!scanId || scanId === '') {
          return Promise.reject(new Error('Scan ID is required'))
        }
        if (scanId === 'invalid-scan-id') {
          return Promise.reject(new Error('Invalid scan ID'))
        }

        // Return a mock scan status with proper timestamps
        const now = new Date()
        const startTime = new Date(now.getTime() - 1000).toISOString() // 1 second earlier
        const endTime = now.toISOString()

        return Promise.resolve({
          scanId,
          startTime,
          endTime,
          rootPath: '/test/path',
          totalFolders: 0,
          validProjects: 0,
          updatedBreadcrumbs: 0,
          createdBreadcrumbs: 0,
          errors: [],
          projects: []
        })
      }

      case 'baker_read_breadcrumbs': {
        const projectPath = args.projectPath as string

        // Validate input
        if (!projectPath || projectPath === '') {
          return Promise.reject(new Error('Project path is required'))
        }
        if (projectPath === '/path/that/does/not/exist') {
          return Promise.reject(new Error('Project path does not exist'))
        }
        if (projectPath.includes('Corrupted')) {
          return Promise.reject(new Error('Failed to parse breadcrumbs file'))
        }

        // Check if breadcrumbs exist for this project
        const breadcrumbs = mockBreadcrumbsStore.get(projectPath)
        if (!breadcrumbs) {
          // Return null for missing breadcrumbs (not an error)
          return Promise.resolve(null)
        }
        return Promise.resolve(breadcrumbs)
      }

      case 'baker_update_breadcrumbs': {
        const projectPaths = args.projectPaths as string[]
        const createMissing = args.createMissing as boolean
        const backupOriginals = args.backupOriginals as boolean

        // Validate input
        if (!projectPaths || projectPaths.length === 0) {
          return Promise.reject(new Error('Project paths array is required'))
        }

        const successful: string[] = []
        const failed: Array<{ path: string; error: string }> = []
        const created: string[] = []
        const updated: string[] = []

        // Process each project path
        projectPaths.forEach(projectPath => {
          // Check for invalid paths
          if (projectPath === '/path/that/does/not/exist') {
            failed.push({
              path: projectPath,
              error: 'Project path does not exist'
            })
            return
          }
          if (
            projectPath.includes('permission-denied') ||
            projectPath.includes('restricted') ||
            projectPath.startsWith('/System/')
          ) {
            failed.push({
              path: projectPath,
              error: 'Permission denied: cannot access directory'
            })
            return
          }

          const hasBreadcrumbs = mockBreadcrumbsStore.has(projectPath)

          if (hasBreadcrumbs) {
            // Update existing breadcrumbs
            successful.push(projectPath)
            updated.push(projectPath)
          } else if (createMissing) {
            // Create new breadcrumbs
            const newBreadcrumbs = createEmptyBreadcrumbs(projectPath)
            mockBreadcrumbsStore.set(projectPath, newBreadcrumbs)
            successful.push(projectPath)
            created.push(projectPath)
          }
          // If createMissing is false and no breadcrumbs exist, skip silently
        })

        return Promise.resolve({
          successful,
          failed,
          created,
          updated
        })
      }

      case 'baker_validate_folder': {
        const folderPath = args.folderPath as string

        // Validate input
        if (!folderPath || folderPath === '') {
          return Promise.reject(new Error('Folder path is required'))
        }
        if (folderPath === '/path/that/does/not/exist') {
          return Promise.reject(new Error('Folder does not exist'))
        }

        // Extract folder name from path
        const folderName = folderPath.split('/').pop() || 'Unknown'

        // Mock different validation results based on folder name
        const isInvalid = folderName.includes('Invalid')
        const isCorrupted = folderName.includes('Corrupted')
        const hasBreadcrumbs = folderName === 'TestProject1'
        const cameraCount = folderName === 'TestProject2' ? 2 : 1

        // Build validation errors array
        const validationErrors: string[] = []
        if (isInvalid) {
          validationErrors.push('Missing required subfolder: Footage')
        }
        if (isCorrupted) {
          validationErrors.push('Breadcrumbs file is corrupted or malformed')
        }

        return Promise.resolve({
          path: folderPath,
          name: folderName,
          isValid: !isInvalid,
          hasBreadcrumbs: hasBreadcrumbs && !isCorrupted, // Corrupted means no valid breadcrumbs
          staleBreadcrumbs: false,
          invalidBreadcrumbs: isCorrupted,
          lastScanned: new Date().toISOString(),
          cameraCount,
          validationErrors
        })
      }

      default:
        throw new Error(`Unmocked Tauri command: ${cmd}`)
    }
  })

  // Initialize test data for Baker contract tests
  // Use fileURLToPath to get proper path format from import.meta.url
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const testDataPath = resolve(currentDir, '../fixtures/baker-test-data')
  const testProject1Path = resolve(testDataPath, 'TestProject1')

  // Set up TestProject1 with breadcrumbs
  mockBreadcrumbsStore.set(testProject1Path, {
    projectTitle: 'TestProject1',
    numberOfCameras: 1,
    files: [
      {
        camera: 1,
        name: 'test-file.mp4',
        path: `${testProject1Path}/Footage/Camera 1/test-file.mp4`
      }
    ],
    parentFolder: testDataPath,
    createdBy: 'test-user',
    creationDateTime: new Date().toISOString()
  })

  return {
    setBreadcrumbs: (path: string, breadcrumbs: BreadcrumbsFile) => {
      mockBreadcrumbsStore.set(path, breadcrumbs)
    },
    getBreadcrumbs: (path: string) => mockBreadcrumbsStore.get(path),
    clearMocks: () => mockBreadcrumbsStore.clear()
  }
}

function createEmptyBreadcrumbs(projectPath: string): BreadcrumbsFile {
  return {
    projectTitle: projectPath.split('/').pop() || 'Test Project',
    numberOfCameras: 0,
    files: [],
    parentFolder: projectPath.split('/').slice(0, -1).join('/'),
    createdBy: 'test@example.com',
    creationDateTime: new Date().toISOString()
  }
}
