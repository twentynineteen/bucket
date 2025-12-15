/**
 * Utilities for converting GitHub release data to Tauri updater manifest format
 */

import { createNamespacedLogger } from './logger'

const log = createNamespacedLogger('UpdateManifest')

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: GitHubAsset[]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
  content_type: string
  size: number
}

interface TauriUpdateManifest {
  version: string
  notes?: string
  pub_date?: string
  platforms: {
    [key: string]: {
      url: string
      signature: string
    }
  }
}

interface TauriUpdateResponse {
  version: string
  notes?: string
  pub_date?: string
  url: string
  signature: string
}

/**
 * Convert GitHub release to Tauri update manifest format
 */
export function convertGitHubReleaseToTauriManifest(
  release: GitHubRelease
): TauriUpdateManifest | null {
  if (!release || release.draft || release.prerelease) {
    return null
  }

  // Find platform-specific assets
  const platforms: { [key: string]: { url: string; signature: string } } = {}

  // Look for signature files and their corresponding binaries
  const signatureFiles = release.assets.filter((asset) => asset.name.endsWith('.sig'))
  const updateFiles = release.assets.filter(
    (asset) =>
      asset.name.includes('.tar.gz') ||
      asset.name.includes('.zip') ||
      asset.name.includes('.msi') ||
      asset.name.includes('.dmg') ||
      asset.name.includes('.AppImage')
  )

  // Define platform architectures to look for
  const platformConfigs = [
    {
      key: 'darwin-aarch64',
      architectures: ['aarch64', 'arm64'],
      fileTypes: ['.app.tar.gz'], // Tauri updater requires .app.tar.gz for macOS
      platform: 'darwin'
    },
    {
      key: 'darwin-x86_64',
      architectures: ['x64', 'x86_64', 'intel'],
      fileTypes: ['.app.tar.gz'], // Tauri updater requires .app.tar.gz for macOS
      platform: 'darwin'
    },
    {
      key: 'linux-x86_64',
      architectures: ['x86_64', 'x64'],
      fileTypes: ['.AppImage', '.tar.gz'],
      platform: 'linux'
    },
    {
      key: 'windows-x86_64',
      architectures: ['x64', 'x86_64'],
      fileTypes: ['.msi', '.exe'],
      platform: 'windows'
    }
  ]

  for (const config of platformConfigs) {
    // Find matching update file for this platform
    const updateFile = findBestMatchingAsset(updateFiles, config)

    if (updateFile) {
      // Find corresponding signature file
      const signatureFile = signatureFiles.find(
        (sig) => sig.name === `${updateFile.name}.sig`
      )

      if (signatureFile) {
        platforms[config.key] = {
          url: updateFile.browser_download_url,
          signature: signatureFile.browser_download_url // Will be converted to content later
        }
        log.info(
          `Matched asset for ${config.key}:`,
          updateFile.name,
          'with signature:',
          signatureFile.name
        )
      } else {
        logger.warn(
          `[UpdateManifest] Found update file but no signature for ${config.key}:`,
          updateFile.name
        )
        logger.warn(`[UpdateManifest] Tauri requires signatures - skipping this asset`)
      }
    } else {
      log.debug(`No matching asset found for ${config.key}`)
    }
  }

  // Return null if no platforms found
  if (Object.keys(platforms).length === 0) {
    logger.error('[UpdateManifest] No compatible platforms found in release assets:', {
      totalAssets: release.assets.length,
      updateFiles: updateFiles.map((f) => f.name),
      signatureFiles: signatureFiles.map((f) => f.name)
    })
    return null
  }

  log.info('Successfully created update manifest with platforms:', Object.keys(platforms))

  return {
    version: release.tag_name.replace(/^v/, ''), // Remove leading 'v'
    notes: release.body || 'No release notes available',
    pub_date: release.published_at,
    platforms
  }
}

/**
 * Convert GitHub release to Tauri single-platform update response
 */
export function convertGitHubReleaseToTauriResponse(
  release: GitHubRelease,
  platformKey: string
): TauriUpdateResponse | null {
  const manifest = convertGitHubReleaseToTauriManifest(release)

  if (!manifest) {
    const assetNames = release.assets.map((a) => a.name)
    logger.error('[UpdateManifest] Failed to generate update manifest from release:', {
      releaseName: release.name,
      tagName: release.tag_name,
      isDraft: release.draft,
      isPrerelease: release.prerelease,
      assetCount: release.assets.length,
      assetNames
    })
    return null
  }

  if (!manifest.platforms[platformKey]) {
    const allAssets = release.assets.map((a) => a.name)
    logger.error('[UpdateManifest] No platform found for key:', {
      requestedPlatform: platformKey,
      availablePlatforms: Object.keys(manifest.platforms),
      allAssets
    })
    return null
  }

  const platform = manifest.platforms[platformKey]
  log.info('Found compatible update:', {
    platform: platformKey,
    version: manifest.version,
    url: platform.url,
    hasSignature: !!platform.signature
  })

  return {
    version: manifest.version,
    notes: manifest.notes,
    pub_date: manifest.pub_date,
    url: platform.url,
    signature: platform.signature
  }
}

/**
 * Get current platform key for Tauri updater
 */
export function getCurrentPlatformKey(): string {
  const platform = window.__TAURI_INTERNALS__?.metadata?.target

  if (platform) {
    log.debug('Platform from Tauri metadata:', platform)
    return platform
  }

  // Fallback detection
  const userAgent = navigator.userAgent.toLowerCase()
  log.debug('User Agent for platform detection:', userAgent)

  if (userAgent.includes('mac')) {
    // More reliable Apple Silicon detection
    // Check for various indicators of Apple Silicon
    const isAppleSilicon =
      // User agent patterns for Apple Silicon
      userAgent.includes('arm64') ||
      userAgent.includes('aarch64') ||
      // Check WebGL vendor for Apple Silicon indicators
      getWebGLVendor().includes('Apple') ||
      // Navigator platform check
      navigator.platform.includes('arm') ||
      // Exclude Intel indicators
      (!userAgent.includes('x86_64') && !userAgent.includes('intel'))

    const detectedPlatform = isAppleSilicon ? 'darwin-aarch64' : 'darwin-x86_64'
    log.debug('Detected macOS platform:', detectedPlatform)
    return detectedPlatform
  } else if (userAgent.includes('linux')) {
    const arch = userAgent.includes('x86_64') ? 'x86_64' : 'aarch64'
    return `linux-${arch}`
  } else if (userAgent.includes('win')) {
    const arch =
      userAgent.includes('wow64') || userAgent.includes('x64') ? 'x86_64' : 'aarch64'
    return `windows-${arch}`
  }

  return 'unknown'
}

/**
 * Helper function to get WebGL vendor information
 */
function getWebGLVendor(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ''
      }
    }
  } catch (e) {
    logger.debug('WebGL vendor detection failed:', e)
  }
  return ''
}

/**
 * Find the best matching asset for a platform configuration
 */
function findBestMatchingAsset(
  updateFiles: GitHubAsset[],
  config: { architectures: string[]; fileTypes: string[]; platform: string }
): GitHubAsset | undefined {
  log.debug(`Looking for assets matching platform config:`, {
    architectures: config.architectures,
    fileTypes: config.fileTypes,
    platform: config.platform,
    availableFiles: updateFiles.map((f) => f.name)
  })

  // Try each file type in priority order
  for (const fileType of config.fileTypes) {
    // Filter files by file type first
    const filesOfType = updateFiles.filter((asset) =>
      asset.name.toLowerCase().endsWith(fileType.toLowerCase())
    )

    log.debug(
      `Files matching type ${fileType}:`,
      filesOfType.map((f) => f.name)
    )

    // Then look for architecture match within those files
    for (const arch of config.architectures) {
      const matchingFile = filesOfType.find((asset) => {
        const fileName = asset.name.toLowerCase()
        const archMatch = fileName.includes(arch.toLowerCase())

        // Additional check: make sure it's not the opposite architecture
        // e.g., don't match "x64" when looking for "aarch64"
        const isOppositeArch =
          ((arch.includes('aarch64') || arch.includes('arm64')) &&
            (fileName.includes('x64') || fileName.includes('intel'))) ||
          ((arch.includes('x64') || arch.includes('intel')) &&
            (fileName.includes('aarch64') || fileName.includes('arm64')))

        log.trace(`Checking ${asset.name} for arch ${arch}:`, {
          archMatch,
          isOppositeArch,
          willMatch: archMatch && !isOppositeArch
        })

        return archMatch && !isOppositeArch
      })

      if (matchingFile) {
        log.debug(
          `Found best match: ${matchingFile.name} for ${config.architectures.join('/')}`
        )
        return matchingFile
      }
    }
  }

  logger.warn(
    `[UpdateManifest] No matching asset found for architectures: ${config.architectures.join(', ')}`
  )
  return undefined
}

/**
 * Fetch signature content from URL (signature should be content, not URL)
 */
export async function fetchSignatureContent(signatureUrl: string): Promise<string> {
  const response = await fetch(signatureUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch signature: ${response.statusText}`)
  }
  return response.text()
}
