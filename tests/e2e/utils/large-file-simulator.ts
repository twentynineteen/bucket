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

  return Array.from({ length: fileCount }, (_, i) => ({
    file: {
      name: `footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`,
      path: `/mock/volumes/Production/footage_${String(i).padStart(4, '0')}.${extensions[i % extensions.length]}`
    },
    camera: (i % numCameras) + 1,
    simulatedSize: scenario.averageFileSize
  }))
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
