import { invoke } from '@tauri-apps/api/core'

import type { InstallResult, PluginInfo } from './types'

export async function getAvailablePlugins(): Promise<PluginInfo[]> {
  return invoke<PluginInfo[]>('get_available_plugins')
}

export async function installPlugin(
  pluginFilename: string,
  pluginName: string
): Promise<InstallResult> {
  return invoke<InstallResult>('install_plugin', {
    pluginFilename,
    pluginName
  })
}

export async function openCepFolder(): Promise<void> {
  await invoke('open_cep_folder')
}

export async function showConfirmationDialog(
  message: string,
  title: string,
  destination: string
): Promise<void> {
  await invoke('show_confirmation_dialog', {
    message,
    title,
    destination
  })
}

export async function copyPremiereProject(
  destinationFolder: string,
  newTitle: string
): Promise<string> {
  return invoke<string>('copy_premiere_project', {
    destinationFolder,
    newTitle
  })
}
