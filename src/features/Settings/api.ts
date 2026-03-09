/**
 * Settings API Layer - Single I/O boundary for the Settings module
 *
 * All external calls (Tauri plugins, storage utils, AI provider validation)
 * are wrapped here. Mock this one file to isolate the entire module.
 */
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { open as openShell } from '@tauri-apps/plugin-shell'

import { providerRegistry } from '@services/ai/providerConfig'
import { loadApiKeys, saveApiKeys } from '@shared/utils/storage'

import type { ProviderConfiguration } from '@/types/scriptFormatter'

// Re-export type for consumers
export type { ApiKeys } from '@shared/utils/storage'

// --- Dialog ---

export async function openFolderPicker(): Promise<string | null> {
  const result = await openDialog({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
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
