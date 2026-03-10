/**
 * usePremiereIntegration Hook
 * Purpose: Handle Premiere Pro template integration and post-completion actions
 *
 * Responsibilities:
 * - Copy Premiere Pro project template
 * - Show completion dialog
 * - Open project folder
 * - Handle UI state (loading, messages)
 *
 * Complexity: Low (< 5)
 * Lines: ~70
 */

import { logger } from '@shared/utils'

import { copyPremiereProject, showConfirmationDialog } from '../api'
import type { DialogParams, PremiereParams } from '../types'

export function usePremiereIntegration() {
  /**
   * Copy Premiere Pro template to project
   */
  const copyPremiereTemplate = async ({
    projectFolder,
    projectTitle,
    setLoading,
    setMessage
  }: PremiereParams): Promise<void> => {
    setLoading(true)
    setMessage('')

    try {
      const destinationFolder = `${projectFolder}/Projects/`

      const result = await copyPremiereProject(destinationFolder, projectTitle)

      setMessage('Success: ' + result)
    } catch (error) {
      logger.error('Error:', error)
      setMessage('Error: ' + error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Show completion dialog and optionally open folder
   */
  const showCompletionDialog = async ({ projectFolder }: DialogParams): Promise<void> => {
    try {
      await showConfirmationDialog(
        'Do you want to open the project folder now?',
        'Transfer complete!',
        projectFolder
      )
    } catch (error) {
      logger.error('Error:', error)
    }
  }

  /**
   * Handle all post-completion actions
   */
  const handlePostCompletion = async (params: PremiereParams): Promise<void> => {
    await copyPremiereTemplate(params)
    await showCompletionDialog({
      projectFolder: params.projectFolder,
      projectTitle: params.projectTitle
    })
  }

  return {
    copyPremiereTemplate,
    showCompletionDialog,
    handlePostCompletion
  }
}
