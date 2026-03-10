/** Service for tracking multi-step operation progress with subscriber notifications */
export { ProgressTracker } from './ProgressTracker'
/** Progress event payload with percentage, message, and operation metadata */
export type { ProgressUpdate } from './ProgressTracker'
/** Subscription handle for receiving progress updates with unsubscribe */
export type { ProgressSubscription } from './ProgressTracker'
/** Filter criteria for subscribing to specific operation progress events */
export type { ProgressFilter } from './ProgressTracker'
/** Aggregated progress summary across multiple concurrent operations */
export type { ProgressSummary } from './ProgressTracker'

/** Service for displaying user-facing notifications, confirmations, and prompts */
export { UserFeedbackService } from './UserFeedbackService'
/** Configuration options for user feedback display -- severity, duration, actions */
export type { FeedbackOptions } from './UserFeedbackService'
/** Prompt configuration for user input dialogs with validation */
export type { UserPrompt } from './UserFeedbackService'
/** Notification display configuration -- position, style, auto-dismiss */
export type { NotificationConfig } from './UserFeedbackService'
/** Action button configuration for interactive notifications */
export type { NotificationAction } from './UserFeedbackService'

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
