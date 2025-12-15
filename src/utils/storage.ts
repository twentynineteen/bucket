import { appStore } from '@store/useAppStore'
import { appDataDir } from '@tauri-apps/api/path'
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

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
  ollamaUrl?: string
}

const API_KEYS_FILE = 'api_keys.json' // New file for storing API keys as JSON

// default background folder state
const setDefaultBackgroundFolder = (path: string) =>
  appStore.getState().setDefaultBackgroundFolder(path)

// Get full path for storing API keys.
const getFilePath = async () => {
  const dir = await appDataDir()
  return `${dir}${API_KEYS_FILE}`
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
    return {}
  }
}
