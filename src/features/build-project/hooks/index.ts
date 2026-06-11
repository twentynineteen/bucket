/**
 * BuildProject Hooks - Barrel Export
 *
 * Re-exports all hooks from the build-project feature module.
 * Import from this file for convenient access to all hooks.
 *
 * @example
 * import { useBuildProject, useStageExecution } from '@/features/build-project/hooks'
 *
 * const { startBuild, cancel, reset, isBuilding } = useBuildProject()
 * const { execute, reset } = useStageExecution()
 */

// ============================================================================
// Build Project Hook (Main Orchestration)
// ============================================================================

export { useBuildProject } from './useBuildProject'

export type {
  BuildProgress,
  StageResults,
  UseBuildProjectReturn
} from './useBuildProject'

// ============================================================================
// Stage Execution Hook
// ============================================================================

export { useStageExecution } from './useStageExecution'

export type { ExecuteConfig, StageFn, UseStageExecutionReturn } from './useStageExecution'
