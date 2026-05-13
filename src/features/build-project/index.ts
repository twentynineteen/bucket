/**
 * @features/build-project — public barrel.
 *
 * This is the only entry point page-level consumers should import from. The
 * machine, stage functions, and the `fileTransferActor` are deliberately
 * internal — the state machine owns the workflow and components compose it
 * through `useBuildProject`.
 */

/** Main orchestration hook — drives the BuildProject workflow via XState v5. */
export { useBuildProject } from './hooks/useBuildProject'

/** Structured error class for BuildProject failures (kind, recoverable, code). */
export { BuildProjectError } from './types/errors'

/** Error category enum used by BuildProjectError.kind (Validation, IO, Timeout, …). */
export { ErrorKind } from './types/errors'

/** Returns a user-facing message for a BuildProjectError — safe to render in UI. */
export { getUserFriendlyErrorMessage } from './types/errors'

/** Returns the human-readable label for an ErrorKind value. */
export { getErrorKindDisplayName } from './types/errors'

/** Input config for `useBuildProject().startBuild(...)`. */
export type { BuildProjectInput } from './machine/buildProjectMachine'

/** Footage file shape consumed by the workflow (path + name + camera assignment). */
export type { FootageFile } from './machine/buildProjectMachine'

/** XState machine context type — useful for typing state.context in consumers. */
export type { BuildProjectContext } from './machine/buildProjectMachine'

/** Aggregated progress shape returned by useBuildProject — percentage, stage, file-transfer detail. */
export type { BuildProgress } from './hooks/useBuildProject'

/** Per-stage result map (validation, folders, template, breadcrumbs, file-transfer). */
export type { StageResults } from './hooks/useBuildProject'

/** Full return shape of useBuildProject — handy for typing wrapper hooks. */
export type { UseBuildProjectReturn } from './hooks/useBuildProject'
