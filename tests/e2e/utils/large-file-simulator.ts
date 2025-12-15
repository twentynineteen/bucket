/**
 * Large File Simulator
 *
 * Defines simulation scenarios for testing BuildProject with large file sets
 * without actual disk I/O. Used to configure mock behavior for 250GB simulations.
 */

export interface SimulatedFileSet {
  name: string
  totalSize: number // Total bytes to simulate
  fileCount: number // Number of files
  averageFileSize: number // Calculated from totalSize/fileCount
  progressIntervalMs: number // How often to emit progress events
  /** Base path for file locations (default: /mock/volumes/Production) */
  basePath?: string
  /** File size distribution mode */
  fileSizeDistribution?: 'uniform' | 'variable'
}

export interface MockFile {
  file: {
    name: string
    path: string
  }
  camera: number
  simulatedSize: number // Size in bytes for progress calculation
}

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

/**
 * Pre-configured simulation scenarios for different test cases
 */
export const SCENARIOS: Record<string, SimulatedFileSet> = {
  // 250GB with 500 files @ 500MB each - tests large individual files
  LARGE_FILES: {
    name: '250GB-500-files',
    totalSize: 250 * GB,
    fileCount: 500,
    averageFileSize: 500 * MB,
    progressIntervalMs: 100
  },

  // 250GB with 2500 files @ 100MB each - tests many files
  MANY_FILES: {
    name: '250GB-2500-files',
    totalSize: 250 * GB,
    fileCount: 2500,
    averageFileSize: 100 * MB,
    progressIntervalMs: 50
  },

  // Smaller scenario for quick smoke tests
  SMOKE_TEST: {
    name: '1GB-10-files',
    totalSize: 1 * GB,
    fileCount: 10,
    averageFileSize: 100 * MB,
    progressIntervalMs: 50
  },

  // Medium scenario for development
  MEDIUM: {
    name: '10GB-100-files',
    totalSize: 10 * GB,
    fileCount: 100,
    averageFileSize: 100 * MB,
    progressIntervalMs: 75
  },

  // 250GB with variable file sizes (100MB - 2GB) - realistic distribution
  VARIABLE_SIZES: {
    name: '250GB-variable-sizes',
    totalSize: 250 * GB,
    fileCount: 300,
    averageFileSize: 833 * MB, // Approximate
    progressIntervalMs: 50,
    fileSizeDistribution: 'variable'
  },

  // Single very large file (2GB) - tests intra-file progress
  SINGLE_LARGE: {
    name: '2GB-single-file',
    totalSize: 2 * GB,
    fileCount: 1,
    averageFileSize: 2 * GB,
    progressIntervalMs: 10
  },

  // External drive simulation with higher latency
  EXTERNAL_DRIVE: {
    name: '10GB-external-drive',
    totalSize: 10 * GB,
    fileCount: 50,
    averageFileSize: 200 * MB,
    progressIntervalMs: 200, // Higher latency simulates external drive
    basePath: '/Volumes/Production'
  },

  // High-frequency events stress test
  RAPID_EVENTS: {
    name: '1GB-rapid-events',
    totalSize: 1 * GB,
    fileCount: 10,
    averageFileSize: 100 * MB,
    progressIntervalMs: 1 // Very fast - stress test
  },

  // Multi-volume scenario
  MULTI_VOLUME: {
    name: '5GB-multi-volume',
    totalSize: 5 * GB,
    fileCount: 25,
    averageFileSize: 200 * MB,
    progressIntervalMs: 50,
    basePath: '/Volumes' // Files will be distributed across volumes
  }
}

/**
 * Generate mock footage files for a given scenario
 */
export function generateMockFiles(
  fileCount: number,
  numCameras: number,
  scenario: SimulatedFileSet
): MockFile[] {
  const extensions = ['mp4', 'mov', 'mxf', 'braw']
  const basePath = scenario.basePath || '/mock/volumes/Production'

  return Array.from({ length: fileCount }, (_, i) => ({
    file: {
      name: `footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`,
      path: `${basePath}/footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`
    },
    camera: (i % numCameras) + 1,
    simulatedSize: scenario.averageFileSize
  }))
}

/**
 * Generate mock files with variable sizes (realistic distribution)
 * Sizes range from 100MB to 2GB with a weighted distribution favoring medium sizes
 */
export function generateVariableSizeFiles(
  scenario: SimulatedFileSet,
  numCameras: number
): MockFile[] {
  const extensions = ['mp4', 'mov', 'mxf', 'braw']
  const basePath = scenario.basePath || '/mock/volumes/Production'

  // Size buckets with weights (more medium-sized files)
  const sizeBuckets = [
    { size: 100 * MB, weight: 2 },
    { size: 200 * MB, weight: 3 },
    { size: 500 * MB, weight: 4 },
    { size: 1 * GB, weight: 2 },
    { size: 2 * GB, weight: 1 }
  ]

  // Create weighted array for random selection
  const weightedSizes: number[] = []
  sizeBuckets.forEach((bucket) => {
    for (let i = 0; i < bucket.weight; i++) {
      weightedSizes.push(bucket.size)
    }
  })

  const files: MockFile[] = []
  let remainingSize = scenario.totalSize
  let index = 0

  // Generate files until we reach the target total size or file count
  while (remainingSize > 0 && index < scenario.fileCount) {
    // Pick a random size from weighted buckets, capped at remaining size
    const randomIndex = Math.floor(Math.random() * weightedSizes.length)
    const size = Math.min(weightedSizes[randomIndex], remainingSize)

    files.push({
      file: {
        name: `footage_${String(index).padStart(4, '0')}.${extensions[index % extensions.length]}`,
        path: `${basePath}/footage_${String(index).padStart(4, '0')}.${extensions[index % extensions.length]}`
      },
      camera: (index % numCameras) + 1,
      simulatedSize: size
    })

    remainingSize -= size
    index++
  }

  return files
}

/**
 * Generate mock files from multiple volumes (for multi-volume testing)
 */
export function generateMultiVolumeFiles(
  fileCount: number,
  numCameras: number,
  scenario: SimulatedFileSet,
  volumes: string[] = ['/Volumes/Drive1', '/Volumes/Drive2', '/Volumes/Drive3']
): MockFile[] {
  const extensions = ['mp4', 'mov', 'mxf', 'braw']

  return Array.from({ length: fileCount }, (_, i) => {
    const volumeIndex = i % volumes.length
    const volume = volumes[volumeIndex]

    return {
      file: {
        name: `footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`,
        path: `${volume}/DCIM/footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`
      },
      camera: (i % numCameras) + 1,
      simulatedSize: scenario.averageFileSize
    }
  })
}

/**
 * Generate a single large file for intra-file progress testing
 */
export function generateSingleLargeFile(sizeBytes: number, basePath?: string): MockFile[] {
  const path = basePath || '/mock/volumes/Production'
  return [
    {
      file: {
        name: 'large_footage_0000.mov',
        path: `${path}/large_footage_0000.mov`
      },
      camera: 1,
      simulatedSize: sizeBytes
    }
  ]
}

/**
 * Calculate expected duration for a simulation based on speed multiplier
 */
export function calculateSimulationDuration(
  scenario: SimulatedFileSet,
  speedMultiplier: number = 1
): number {
  // Base duration: progressIntervalMs * estimated events per file * fileCount
  const eventsPerFile = Math.ceil(scenario.averageFileSize / (8 * 1024)) // 8KB buffer
  const throttledEvents = Math.ceil(eventsPerFile / 10) // Throttled to ~10 events per file
  return (scenario.progressIntervalMs * throttledEvents * scenario.fileCount) / speedMultiplier
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(2)} KB`
}
