export {
  ProgressTracker,
  type ProgressUpdate,
  type ProgressSubscription,
  type ProgressFilter,
  type ProgressSummary
} from './ProgressTracker'
export {
  UserFeedbackService,
  type FeedbackOptions,
  type UserPrompt,
  type NotificationConfig,
  type NotificationAction
} from './UserFeedbackService'
export {
  CacheInvalidationService,
  createCacheInvalidationService,
  initializeCacheService,
  getCacheService,
  useCacheInvalidation
} from './cache-invalidation'

// Note: AI provider services (providerConfig, modelFactory) are NOT barrel-exported
// because they depend on Ollama runtime imports.
// Import them directly: import { providerRegistry } from '@shared/services/ai/providerConfig'
