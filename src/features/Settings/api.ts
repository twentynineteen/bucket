/**
 * Settings API Layer - Single I/O boundary for the Settings module
 *
 * All external calls (Tauri plugins, storage utils, AI provider validation)
 * are wrapped here. Mock this one file to isolate the entire module.
 */
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { exists } from '@tauri-apps/plugin-fs'
import { open as openShell } from '@tauri-apps/plugin-shell'

import { providerRegistry } from '@shared/services/ai/providerConfig'
import { loadApiKeys, saveApiKeys } from '@shared/utils'

import type { ProviderConfiguration } from '@shared/types'

// Re-export type for consumers
export type { ApiKeys } from '@shared/utils'

// --- Dialog ---

export async function openFolderPicker(): Promise<string | null> {
  const result = await openDialog({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
}

// --- Filesystem ---

/**
 * Whether a saved directory is still present (issue #166).
 *
 * Settings printed stored paths verbatim, so a folder that had been moved or
 * deleted was presented as valid configuration. A failed probe reports false:
 * from the user's point of view a folder that cannot be checked is not one they
 * should be told is fine.
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    return await exists(path)
  } catch {
    return false
  }
}

// --- Shell ---

export async function openExternalUrl(url: string): Promise<void> {
  await openShell(url)
}

// --- Storage ---

export const loadSettingsApiKeys = loadApiKeys
export const saveSettingsApiKeys = saveApiKeys

// --- AI Provider Validation ---

export async function validateAIConnection(
  providerId: string,
  config: ProviderConfiguration
): Promise<{
  success: boolean
  latencyMs?: number
  errorMessage?: string
  modelsFound?: number
}> {
  const adapter = providerRegistry.get(providerId)
  if (!adapter) {
    return {
      success: false,
      errorMessage: `Provider "${providerId}" not found`
    }
  }
  return adapter.validateConnection(config)
}
