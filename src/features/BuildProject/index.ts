/**
 * @features/BuildProject — public barrel.
 *
 * The only entry point for consumers. The XState machine, the stage functions
 * and the `fileTransferActor` are deliberately internal: the machine owns the
 * workflow and the page composes it through `useBuildProject`.
 */

/** Main page for the BuildProject workflow -- file selection, camera assignment, project creation */
export { default as BuildProjectPage } from './BuildProjectPage'
/** Main orchestration hook -- drives the BuildProject workflow via XState v5 */
export { useBuildProject } from './hooks/useBuildProject'
/** Hook for reading and caching video metadata blocks from project breadcrumbs */
export { useVideoInfoBlock } from './hooks/useVideoInfoBlock'
/** Structured error class for BuildProject failures (kind, recoverable, code) */
export { BuildProjectError } from './types/errors'
/** Error category enum used by BuildProjectError.kind (Validation, IO, Timeout, ...) */
export { ErrorKind } from './types/errors'
/** Returns a user-facing message for a BuildProjectError -- safe to render in UI */
export { getUserFriendlyErrorMessage } from './types/errors'
/** Returns the human-readable label for an ErrorKind value */
export { getErrorKindDisplayName } from './types/errors'
/** Video metadata and footage file types used across project workflows */
export type { VideoInfoData, FootageFile } from './types'
/** Input config for `useBuildProject().startBuild(...)` */
export type { BuildProjectInput } from './machine/buildProjectMachine'
/** XState machine context type -- useful for typing state.context in consumers */
export type { BuildProjectContext } from './machine/buildProjectMachine'
/** Aggregated progress shape returned by useBuildProject -- percentage, stage, file-transfer detail */
export type { BuildProgress } from './hooks/useBuildProject'
/** Per-stage result map (validation, folders, template, breadcrumbs, file-transfer) */
export type { StageResults } from './hooks/useBuildProject'
/** Full return shape of useBuildProject -- handy for typing wrapper hooks */
export type { UseBuildProjectReturn } from './hooks/useBuildProject'
