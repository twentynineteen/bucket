/**
 * Settings Module Types
 *
 * Settings-specific type definitions.
 */

export type ConnectionStatus = {
  status: 'idle' | 'testing' | 'success' | 'error'
  message?: string
  modelsFound?: number
  latencyMs?: number
}
