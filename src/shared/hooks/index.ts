export { useBreadcrumb } from './useBreadcrumb'
export { useReducedMotion } from './useReducedMotion'
export { useFuzzySearch } from './useFuzzySearch'
export { useUsername } from './useUsername'
export { useApiKeys, useSproutVideoApiKey, useTrelloApiKeys } from './useApiKeys'
export { useIsMobile } from './use-mobile'
// Note: useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck
// are NOT barrel-exported because they depend on Tauri runtime plugins.
// Import them directly: import { useMacOSEffects } from '@shared/hooks/useMacOSEffects'
