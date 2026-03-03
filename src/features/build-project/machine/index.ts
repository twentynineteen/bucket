/**
 * BuildProject State Machine exports
 *
 * This module exports the XState v5 state machine for the BuildProject workflow,
 * along with all related types for use throughout the application.
 */

export {
  buildProjectMachine,
  type Breadcrumb,
  type BuildProjectContext,
  type BuildProjectEvent,
  type BuildProjectInput,
  type BuildProjectMachine,
  type FootageFile
} from './buildProjectMachine'
