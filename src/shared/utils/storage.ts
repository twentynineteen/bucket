import { appStore } from '@shared/store'
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import { removeMisplacedResidue, resolveAppDataFile } from './appDataPath'
import { logger } from './logger'

const setSproutVideoApiKey = (state: string) =>
  appStore.getState().setSproutVideoApiKey(state)
const setTrelloApiKey = (state: string) => appStore.getState().setTrelloApiKey(state)
const setTrelloApiToken = (state: string) => appStore.getState().setTrelloApiToken(state)
const setTrelloBoardId = (state: string) => appStore.getState().setTrelloBoardId(state)
const setOllamaUrl = (state: string) => appStore.getState().setOllamaUrl(state)

// Define an interface for multiple API keys.
export interface ApiKeys {
  sproutVideo?: string
  trello?: string
  trelloToken?: string
  trelloBoardId?: string // DEBT-014: Configurable Trello board ID
  // Add more services as needed.
  defaultBackgroundFolder?: string
  /** Default Sprout upload folder id (issue #155). Undefined means root. */
  sproutDefaultFolderId?: string
  /** Human-readable label for the default folder, so the UI can render it
   *  before the folder tree loads. */
  sproutDefaultFolderName?: string
  ollamaUrl?: string
  /** Folder holding the QC reference pools, with `watermarks/` and `stings/`
   *  subfolders (issue #180). Undefined means QC has nothing to compare against. */
  qcReferenceFolder?: string
  /** Directory holding ffmpeg and ffprobe, when they are not in a standard
   *  location (issue #180). Undefined searches /opt/homebrew/bin, /usr/local/bin
   *  and /usr/bin. */
  ffmpegDirectory?: string
}

const API_KEYS_FILE = 'api_keys.json' // New file for storing API keys as JSON

/** Superseded by api_keys.json and read by nothing; swept up on the way past
 *  (issue #167). */
const LEGACY_API_KEY_FILE = 'api_key.txt'

// default background folder state
const setDefaultBackgroundFolder = (path: string) =>
  appStore.getState().setDefaultBackgroundFolder(path)

// Get full path for storing API keys.
//
// Joined rather than concatenated, and any copy an earlier build left beside
// the app data directory is relocated first (issue #167).
const getFilePath = async () => {
  const path = await resolveAppDataFile(API_KEYS_FILE)
  await removeMisplacedResidue(LEGACY_API_KEY_FILE)
  return path
}

// Save API keys to a local file as JSON.
export const saveApiKeys = async (apiKeys: ApiKeys): Promise<void> => {
  try {
    setSproutVideoApiKey(apiKeys.sproutVideo)
    setTrelloApiKey(apiKeys.trello)
    setTrelloApiToken(apiKeys.trelloToken)
    if (apiKeys.trelloBoardId !== undefined) setTrelloBoardId(apiKeys.trelloBoardId)
    setDefaultBackgroundFolder(apiKeys.defaultBackgroundFolder)
    if (apiKeys.ollamaUrl) setOllamaUrl(apiKeys.ollamaUrl)

    const filePath = await getFilePath()
    const data = JSON.stringify(apiKeys, null, 2) // Pretty-print JSON for readability.
    await writeTextFile(filePath, data)
  } catch (error) {
    logger.error('Error saving API keys:', error)
    // Rethrow: swallowing this told callers the write succeeded, so the user
    // saw a saved setting that was gone at next launch (issue #155 P5-b).
    throw error
  }
}

// Load API keys from the local file.
export const loadApiKeys = async (): Promise<ApiKeys> => {
  try {
    const filePath = await getFilePath()
    if (!(await exists(filePath))) return {} // Return empty object if file doesn't exist.

    const data = await readTextFile(filePath)
    const result = JSON.parse(data)

    setSproutVideoApiKey(result.sproutVideo)
    setTrelloApiKey(result.trello)
    setTrelloApiToken(result.trelloToken)
    if (result.trelloBoardId !== undefined) setTrelloBoardId(result.trelloBoardId)
    setDefaultBackgroundFolder(result.defaultBackgroundFolder)
    if (result.ollamaUrl) setOllamaUrl(result.ollamaUrl)

    return result
  } catch (error) {
    logger.error('Error loading API keys:', error)
    // Rethrow, mirroring saveApiKeys above. Returning {} turned a failure into a
    // success: every settings section rendered as never-configured and the
    // Posterframe page claimed no background folder was set, while the file on
    // disk was merely unreadable rather than lost (issue #166 B8.1). A genuinely
    // absent file still returns {} at the exists() check above, because a first
    // run is not a failure.
    throw error
  }
}
