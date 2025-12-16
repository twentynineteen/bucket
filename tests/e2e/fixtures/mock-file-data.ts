/**
 * Mock File Data
 *
 * Pre-configured test data for BuildProject E2E tests
 */

import { SCENARIOS, generateMockFiles, type MockFile } from '../utils/large-file-simulator'

/**
 * Pre-configured file sets for different test scenarios
 */
export const TEST_FILE_SETS = {
  // Small set for smoke tests (10 files)
  SMOKE: generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST),

  // Medium set for development (100 files)
  MEDIUM: generateMockFiles(100, 3, SCENARIOS.MEDIUM),

  // Large set - 500 files @ 500MB (250GB total)
  LARGE_500: generateMockFiles(500, 4, SCENARIOS.LARGE_FILES),

  // Many files - 2500 files @ 100MB (250GB total)
  LARGE_2500: generateMockFiles(2500, 4, SCENARIOS.MANY_FILES)
}

/**
 * Test project configurations
 */
export const TEST_PROJECTS = {
  BASIC: {
    title: 'Test Project',
    numCameras: 2,
    folder: '/Volumes/Production/2025/Projects'
  },

  PROFESSIONAL: {
    title: 'DBA - IB1234 - J Doe - Introductions 060626',
    numCameras: 4,
    folder: '/Volumes/Production/2025/DBA'
  },

  SPECIAL_CHARS: {
    title: 'Project/With:Special*Characters?',
    numCameras: 2,
    folder: '/Volumes/Production/2025/Special'
  },

  MANY_CAMERAS: {
    title: 'Multi-Camera Shoot',
    numCameras: 8,
    folder: '/Volumes/Production/2025/MultiCam'
  }
}

/**
 * Generate custom mock files with specific distribution
 */
export function generateCustomFiles(
  count: number,
  numCameras: number,
  options: {
    includeImages?: boolean
    cameraDistribution?: 'even' | 'weighted'
  } = {}
): MockFile[] {
  const { includeImages = false, cameraDistribution = 'even' } = options

  const videoExtensions = ['mp4', 'mov', 'mxf', 'braw']
  const imageExtensions = ['jpeg', 'jpg', 'png']
  const extensions = includeImages ? [...videoExtensions, ...imageExtensions] : videoExtensions

  return Array.from({ length: count }, (_, i) => {
    // Camera assignment based on distribution
    let camera: number
    if (cameraDistribution === 'weighted') {
      // More files on camera 1, fewer on higher cameras
      const weights = Array.from({ length: numCameras }, (_, c) => numCameras - c)
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      const rand = Math.random() * totalWeight
      let cumulative = 0
      camera = 1
      for (let c = 0; c < numCameras; c++) {
        cumulative += weights[c]
        if (rand < cumulative) {
          camera = c + 1
          break
        }
      }
    } else {
      camera = (i % numCameras) + 1
    }

    const ext = extensions[i % extensions.length]

    return {
      file: {
        name: `footage_${String(i).padStart(4, '0')}.${ext}`,
        path: `/mock/volumes/Production/footage_${String(i).padStart(4, '0')}.${ext}`
      },
      camera,
      simulatedSize: 100 * 1024 * 1024 // 100MB default
    }
  })
}

/**
 * Generate files with specific failure indices
 * Used for error recovery tests
 */
export function generateFilesWithFailures(
  count: number,
  numCameras: number,
  failureIndices: number[]
): { files: MockFile[]; failureIndices: number[] } {
  const files = generateMockFiles(count, numCameras, SCENARIOS.MEDIUM)

  // Mark which files will fail (for reference)
  const validFailureIndices = failureIndices.filter((i) => i >= 0 && i < count)

  return {
    files,
    failureIndices: validFailureIndices
  }
}
