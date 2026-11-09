export interface PluginInfo {
  name: string
  displayName: string
  version: string
  filename: string
  size: number
  installed: boolean
  description: string
  features: string[]
  icon: string
}

export interface InstallResult {
  success: boolean
  message: string
  pluginName: string
  installedPath: string
}
