/**
 * Version comparison utilities for handling semantic versioning
 */

/**
 * Normalizes version strings by removing 'v' prefix and handling different formats
 * @param version - Version string like "v0.6.3" or "0.7.0"
 * @returns Normalized version string like "0.6.3"
 */
export function normalizeVersion(version: string): string {
  return version.replace(/^v/, '').trim()
}

/**
 * Parses a version string into major, minor, patch components
 * @param version - Normalized version string like "0.6.3"
 * @returns Object with major, minor, patch numbers
 */
export function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
} {
  const parts = version.split('.').map(Number)
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  }
}

/**
 * Compares two version strings using semantic versioning rules
 * @param current - Current version string
 * @param latest - Latest version string
 * @returns -1 if current < latest, 0 if equal, 1 if current > latest
 */
export function compareVersions(current: string, latest: string): number {
  const currentNormalized = normalizeVersion(current)
  const latestNormalized = normalizeVersion(latest)

  const currentParts = parseVersion(currentNormalized)
  const latestParts = parseVersion(latestNormalized)

  // Compare major version
  if (currentParts.major !== latestParts.major) {
    return currentParts.major < latestParts.major ? -1 : 1
  }

  // Compare minor version
  if (currentParts.minor !== latestParts.minor) {
    return currentParts.minor < latestParts.minor ? -1 : 1
  }

  // Compare patch version
  if (currentParts.patch !== latestParts.patch) {
    return currentParts.patch < latestParts.patch ? -1 : 1
  }

  return 0 // Versions are equal
}

/**
 * Checks if an update is available by comparing versions
 * @param currentVersion - Current app version
 * @param latestVersion - Latest available version
 * @returns true if latest > current, false otherwise
 */
export function isUpdateAvailable(
  currentVersion: string,
  latestVersion: string
): boolean {
  return compareVersions(currentVersion, latestVersion) < 0
}
