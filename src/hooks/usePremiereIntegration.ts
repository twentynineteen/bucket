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

import { invoke } from '@tauri-apps/api/core'

import { logger } from '@/utils/logger'

interface PremiereParams {
  projectFolder: string
  projectTitle: string
  setLoading: (value: boolean) => void
  setMessage: (value: string) => void
}

interface DialogParams {
  projectFolder: string
  projectTitle: string
}

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

      const result = await invoke('copy_premiere_project', {
        destinationFolder,
        newTitle: projectTitle
      })

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
      await invoke('show_confirmation_dialog', {
        message: 'Do you want to open the project folder now?',
        title: 'Transfer complete!',
        destination: projectFolder
      })
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
