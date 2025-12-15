import { CACHE } from '@constants/timing'
import { useQuery } from '@tanstack/react-query'
import { getVersion } from '@tauri-apps/api/app'
import { isUpdateAvailable, normalizeVersion } from '@utils/versionUtils'

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  prerelease: boolean
  draft: boolean
}

interface VersionCheckResult {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseNotes: string
  publishedAt: string
}

/**
 * Fetches the latest release information from GitHub
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(
    'https://api.github.com/repos/twentynineteen/bucket/releases/latest'
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Gets the current app version from Tauri
 */
async function getCurrentVersion(): Promise<string> {
  return await getVersion()
}

/**
 * Custom hook to check for available updates by comparing GitHub releases with current app version
 */
export function useVersionCheck() {
  return useQuery({
    queryKey: ['versionCheck'],
    queryFn: async (): Promise<VersionCheckResult> => {
      const [currentVersion, latestRelease] = await Promise.all([
        getCurrentVersion(),
        fetchLatestRelease()
      ])

      const latestVersion = normalizeVersion(latestRelease.tag_name)
      const updateAvailable = isUpdateAvailable(currentVersion, latestVersion)

      return {
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseNotes: latestRelease.body,
        publishedAt: latestRelease.published_at
      }
    },
    staleTime: CACHE.STANDARD, // 5 minutes
    retry: 2
  })
}
