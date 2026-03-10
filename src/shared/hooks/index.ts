/** Hook for managing breadcrumb navigation path and document title updates */
export { useBreadcrumb } from './useBreadcrumb'
/** Hook for detecting user's prefers-reduced-motion accessibility setting */
export { useReducedMotion } from './useReducedMotion'
/** Hook for fuzzy text search with configurable threshold and result scoring */
export { useFuzzySearch } from './useFuzzySearch'
/** Hook for reading the authenticated user's display name from secure storage */
export { useUsername } from './useUsername'
/** Hooks for loading and caching API keys from secure storage -- Sprout Video and Trello */
export { useApiKeys, useSproutVideoApiKey, useTrelloApiKeys } from './useApiKeys'
/** Hook for detecting mobile viewport breakpoints via media query */
export { useIsMobile } from './use-mobile'
// Note: useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck
// are NOT barrel-exported because they depend on Tauri runtime plugins.
// Import them directly: import { useMacOSEffects } from '@shared/hooks/useMacOSEffects'
