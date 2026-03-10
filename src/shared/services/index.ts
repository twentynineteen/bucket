/** Service for coordinating React Query cache invalidation across modules */
export { CacheInvalidationService } from './cache-invalidation'
/** Factory function for creating a CacheInvalidationService instance */
export { createCacheInvalidationService } from './cache-invalidation'
/** Initialize the global cache invalidation service singleton */
export { initializeCacheService } from './cache-invalidation'
/** Get the current global cache invalidation service instance */
export { getCacheService } from './cache-invalidation'
/** Hook for triggering cache invalidation from React components */
export { useCacheInvalidation } from './cache-invalidation'

// Note: AI provider services (providerConfig, modelFactory) are NOT barrel-exported
// because they depend on Ollama runtime imports.
// Import them directly: import { providerRegistry } from '@shared/services/ai/providerConfig'
