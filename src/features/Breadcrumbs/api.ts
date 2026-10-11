/**
 * Breadcrumbs I/O boundary (issue #303)
 *
 * The only file that talks to the breadcrumbs commands. Every rule about the
 * file (repairs, limits, locking, backups) lives in the Rust module
 * `app_lib::breadcrumbs`; this file only names the three operations.
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  ApplyOutcome,
  Change,
  PreviewOutcome,
  Read
} from './internal/bindings.generated'

/** Reads a project's breadcrumbs file, repaired in memory. Never writes. */
export async function readBreadcrumbs(projectPath: string): Promise<Read> {
  return invoke<Read>('breadcrumbs_read', { projectPath })
}

/** Applies one named change to each project, in order; one result per project. */
export async function applyBreadcrumbsChange(
  projectPaths: string[],
  change: Change
): Promise<ApplyOutcome[]> {
  return invoke<ApplyOutcome[]>('breadcrumbs_apply', { projectPaths, change })
}

/** Works out what applyBreadcrumbsChange would write, without writing. */
export async function previewBreadcrumbsChange(
  projectPaths: string[],
  change: Change
): Promise<PreviewOutcome[]> {
  return invoke<PreviewOutcome[]>('breadcrumbs_preview', { projectPaths, change })
}
