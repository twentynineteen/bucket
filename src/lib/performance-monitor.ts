import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { createNamespacedLogger } from '@utils/logger'
import React from 'react'

const logger = createNamespacedLogger('Performance')

/**
 * Performance Monitoring Utilities for React Query
 *
 * Provides comprehensive performance monitoring, metrics collection,
 * and optimization insights for React Query operations.
 */

export interface QueryPerformanceMetric {
  queryKey: string
  duration: number
  status: 'success' | 'error' | 'loading'
  timestamp: number
  dataSize?: number
  cacheHit: boolean
  retryCount: number
  errorType?: string
}

export interface AggregatedMetrics {
  totalQueries: number
  averageResponseTime: number
  cacheHitRate: number
  errorRate: number
  slowQueries: QueryPerformanceMetric[]
  errorQueries: QueryPerformanceMetric[]
  memoryUsage: {
    estimatedSizeBytes: number
    activeQueries: number
    cachedQueries: number
  }
}

/**
 * Performance Monitor for React Query
 */
export class QueryPerformanceMonitor {
  private queryClient: QueryClient
  private metrics: Map<string, QueryPerformanceMetric[]> = new Map()
  private observers: Map<string, QueryObserver> = new Map()
  private startTimes: Map<string, number> = new Map()
  private maxMetricsPerQuery = 100 // Limit stored metrics to prevent memory leaks

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
    this.setupQueryListeners()
  }

  /**
   * Setup listeners to monitor query performance
   */
  private setupQueryListeners() {
    const queryCache = this.queryClient.getQueryCache()

    // Listen for query state changes
    queryCache.subscribe((event) => {
      if (event.type === 'added') {
        this.onQueryAdded(event.query)
      } else if (event.type === 'updated') {
        this.onQueryUpdated(event.query)
      }
    })
  }

  /**
   * Called when a new query is added to the cache
   */
  private onQueryAdded(query: { queryKey: unknown[] }) {
    const queryKey = JSON.stringify(query.queryKey)
    this.startTimes.set(queryKey, Date.now())

    // Create observer to track query lifecycle
    const observer = new QueryObserver(this.queryClient, {
      queryKey: query.queryKey,
      enabled: false // We don't want to trigger the query, just observe
    })

    this.observers.set(queryKey, observer)
  }

  /**
   * Called when a query state is updated
   */
  private onQueryUpdated(query: {
    queryKey: unknown[]
    state: {
      status: string
      dataUpdatedAt: number
      failureCount?: number
      error?: Error
      data?: unknown
    }
  }) {
    const queryKey = JSON.stringify(query.queryKey)
    const startTime = this.startTimes.get(queryKey)

    if (!startTime) return

    const duration = Date.now() - startTime
    const wasFromCache = query.state.dataUpdatedAt < startTime

    // Only record metrics for completed queries (success or error)
    if (query.state.status === 'success' || query.state.status === 'error') {
      this.recordMetric({
        queryKey,
        duration,
        status: query.state.status,
        timestamp: Date.now(),
        dataSize: this.estimateDataSize(query.state.data),
        cacheHit: wasFromCache,
        retryCount: query.state.failureCount || 0,
        errorType: query.state.error?.message || undefined
      })

      // Clean up
      this.startTimes.delete(queryKey)
      const observer = this.observers.get(queryKey)
      if (observer) {
        observer.destroy()
        this.observers.delete(queryKey)
      }
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: QueryPerformanceMetric) {
    const queryKey = metric.queryKey

    if (!this.metrics.has(queryKey)) {
      this.metrics.set(queryKey, [])
    }

    const queryMetrics = this.metrics.get(queryKey)!
    queryMetrics.push(metric)

    // Limit stored metrics to prevent memory bloat
    if (queryMetrics.length > this.maxMetricsPerQuery) {
      queryMetrics.shift() // Remove oldest metric
    }
  }

  /**
   * Get performance metrics for a specific query
   */
  getQueryMetrics(queryKey: string): QueryPerformanceMetric[] {
    return this.metrics.get(queryKey) || []
  }

  /**
   * Get aggregated performance metrics
   */
  getAggregatedMetrics(): AggregatedMetrics {
    const allMetrics: QueryPerformanceMetric[] = []
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics)
    }

    if (allMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowQueries: [],
        errorQueries: [],
        memoryUsage: this.getMemoryUsage()
      }
    }

    const totalQueries = allMetrics.length
    const totalResponseTime = allMetrics.reduce((sum, m) => sum + m.duration, 0)
    const averageResponseTime = totalResponseTime / totalQueries

    const cacheHits = allMetrics.filter((m) => m.cacheHit).length
    const cacheHitRate = (cacheHits / totalQueries) * 100

    const errors = allMetrics.filter((m) => m.status === 'error')
    const errorRate = (errors.length / totalQueries) * 100

    // Define "slow" queries as those taking longer than 95th percentile
    const sortedByDuration = [...allMetrics].sort((a, b) => a.duration - b.duration)
    const p95Index = Math.floor(0.95 * sortedByDuration.length)
    const slowThreshold = sortedByDuration[p95Index]?.duration || 1000
    const slowQueries = allMetrics.filter((m) => m.duration > slowThreshold)

    return {
      totalQueries,
      averageResponseTime,
      cacheHitRate,
      errorRate,
      slowQueries,
      errorQueries: errors,
      memoryUsage: this.getMemoryUsage()
    }
  }

  /**
   * Get memory usage statistics
   */
  private getMemoryUsage() {
    const queryCache = this.queryClient.getQueryCache()
    const queries = queryCache.getAll()

    const totalSize = queries.reduce((sum, query) => {
      return sum + this.estimateDataSize(query.state.data)
    }, 0)

    return {
      estimatedSizeBytes: totalSize,
      activeQueries: queries.filter((q) => q.getObserversCount() > 0).length,
      cachedQueries: queries.length
    }
  }

  /**
   * Estimate the size of data in bytes
   */
  private estimateDataSize(data: unknown): number {
    if (!data) return 0
    try {
      return JSON.stringify(data).length * 2 // Rough estimate (UTF-16)
    } catch {
      return 0
    }
  }

  /**
   * Get performance insights and recommendations
   */
  getPerformanceInsights(): PerformanceInsight[] {
    const metrics = this.getAggregatedMetrics()
    const insights: PerformanceInsight[] = []

    // Cache hit rate insights
    if (metrics.cacheHitRate < 50) {
      insights.push({
        type: 'warning',
        category: 'cache',
        message: `Low cache hit rate (${metrics.cacheHitRate.toFixed(1)}%). Consider increasing staleTime for frequently accessed data.`,
        impact: 'medium',
        recommendation:
          'Increase staleTime for stable data or implement prefetching strategies'
      })
    }

    // Error rate insights
    if (metrics.errorRate > 10) {
      insights.push({
        type: 'error',
        category: 'reliability',
        message: `High error rate (${metrics.errorRate.toFixed(1)}%). Check network connectivity and API endpoints.`,
        impact: 'high',
        recommendation: 'Review error handling, retry strategies, and API reliability'
      })
    }

    // Response time insights
    if (metrics.averageResponseTime > 2000) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: `Slow average response time (${metrics.averageResponseTime.toFixed(0)}ms). Consider optimization.`,
        impact: 'medium',
        recommendation:
          'Implement query optimization, data pagination, or background prefetching'
      })
    }

    // Memory usage insights
    if (metrics.memoryUsage.estimatedSizeBytes > 50 * 1024 * 1024) {
      // 50MB
      insights.push({
        type: 'warning',
        category: 'memory',
        message: `High memory usage (${this.formatBytes(metrics.memoryUsage.estimatedSizeBytes)}). Consider cleanup strategies.`,
        impact: 'medium',
        recommendation:
          'Reduce gcTime for large datasets or implement selective data cleanup'
      })
    }

    // Slow queries insights
    if (metrics.slowQueries.length > 0) {
      const slowestQuery = metrics.slowQueries.reduce((prev, curr) =>
        prev.duration > curr.duration ? prev : curr
      )
      insights.push({
        type: 'info',
        category: 'performance',
        message: `${metrics.slowQueries.length} slow queries detected. Slowest: ${slowestQuery.duration}ms`,
        impact: 'low',
        recommendation:
          'Consider optimizing slow query endpoints or implementing background loading'
      })
    }

    return insights
  }

  /**
   * Export metrics as JSON for analysis
   */
  exportMetrics(): string {
    const data = {
      aggregated: this.getAggregatedMetrics(),
      detailed: Object.fromEntries(this.metrics.entries()),
      insights: this.getPerformanceInsights(),
      exportTime: new Date().toISOString()
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Clear all stored metrics
   */
  clearMetrics() {
    this.metrics.clear()
    this.startTimes.clear()

    // Clean up observers
    for (const observer of this.observers.values()) {
      observer.destroy()
    }
    this.observers.clear()
  }

  /**
   * Monitor specific query performance
   */
  async measureQueryPerformance<T>(
    queryKey: readonly (string | number)[],
    queryFn: () => Promise<T>
  ): Promise<{ data: T; metrics: QueryPerformanceMetric }> {
    const start = Date.now()
    const keyString = JSON.stringify(queryKey)

    try {
      const data = await queryFn()
      const duration = Date.now() - start

      const metrics: QueryPerformanceMetric = {
        queryKey: keyString,
        duration,
        status: 'success',
        timestamp: Date.now(),
        dataSize: this.estimateDataSize(data),
        cacheHit: false, // Direct measurement is never from cache
        retryCount: 0
      }

      this.recordMetric(metrics)

      return { data, metrics }
    } catch (error) {
      const duration = Date.now() - start

      const metrics: QueryPerformanceMetric = {
        queryKey: keyString,
        duration,
        status: 'error',
        timestamp: Date.now(),
        cacheHit: false,
        retryCount: 0,
        errorType: error instanceof Error ? error.message : 'Unknown error'
      }

      this.recordMetric(metrics)

      throw error
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }
}

/**
 * Performance insight interface
 */
export interface PerformanceInsight {
  type: 'info' | 'warning' | 'error'
  category: 'cache' | 'performance' | 'memory' | 'reliability'
  message: string
  impact: 'low' | 'medium' | 'high'
  recommendation: string
}

/**
 * React hook for accessing performance monitoring
 */
export function useQueryPerformance(queryClient: QueryClient) {
  const [monitor] = React.useState(() => new QueryPerformanceMonitor(queryClient))

  React.useEffect(() => {
    return () => {
      monitor.clearMetrics()
    }
  }, [monitor])

  return {
    getMetrics: () => monitor.getAggregatedMetrics(),
    getInsights: () => monitor.getPerformanceInsights(),
    exportMetrics: () => monitor.exportMetrics(),
    measureQuery: monitor.measureQueryPerformance.bind(monitor)
  }
}

/**
 * Performance monitoring middleware for debugging
 */
export function createPerformanceLogger() {
  return {
    onSuccess: (data: unknown, variables: unknown, context: { startTime?: number }) => {
      const duration = Date.now() - (context.startTime || 0)
      logger.log(`✅ Query succeeded in ${duration}ms`, {
        variables,
        dataSize: JSON.stringify(data).length
      })
    },
    onError: (
      error: { message: string },
      variables: unknown,
      context: { startTime?: number }
    ) => {
      const duration = Date.now() - (context.startTime || 0)
      logger.log(`❌ Query failed after ${duration}ms`, {
        error: error.message,
        variables
      })
    },
    onMutate: () => {
      return { startTime: Date.now() }
    }
  }
}

// Export factory functions
export const createPerformanceMonitor = (queryClient: QueryClient) => {
  return new QueryPerformanceMonitor(queryClient)
}

// Singleton for global use
let globalPerformanceMonitor: QueryPerformanceMonitor | null = null

export const initializePerformanceMonitor = (queryClient: QueryClient) => {
  globalPerformanceMonitor = new QueryPerformanceMonitor(queryClient)
  return globalPerformanceMonitor
}

export const getPerformanceMonitor = (): QueryPerformanceMonitor => {
  if (!globalPerformanceMonitor) {
    throw new Error(
      'Performance monitor not initialized. Call initializePerformanceMonitor() first.'
    )
  }
  return globalPerformanceMonitor
}

export default QueryPerformanceMonitor
