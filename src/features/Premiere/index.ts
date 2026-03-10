/** Settings panel for managing Adobe Premiere Pro plugin installation */
export { default as PremierePluginManager } from './components/PremierePluginManager'
/** Hook for Premiere plugin install/uninstall operations and status checking */
export { usePremiereIntegration } from './hooks/usePremiereIntegration'
/** Premiere plugin metadata and installation result types */
export type { PluginInfo, InstallResult } from './types'
