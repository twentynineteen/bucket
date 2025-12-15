// hooks/usePostProjectCompletion.ts

import type { BuildProjectEvent } from '@machines/buildProjectMachine'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef } from 'react'

import { logger } from '@/utils/logger'

interface UsePostProjectCompletionOptions {
  isCreatingTemplate: boolean
  isShowingSuccess: boolean
  projectFolder: string | null
  projectTitle: string
  send: (event: BuildProjectEvent) => void
  isIdle: boolean // Add this to detect reset state
}

/**
 * Handles post-completion tasks: premiere template creation and dialog
 * Triggers when the state machine enters 'creatingTemplate' state
 */
export function usePostProjectCompletion({
  isCreatingTemplate,
  isShowingSuccess,
  projectFolder,
  projectTitle,
  send,
  isIdle
}: UsePostProjectCompletionOptions) {
  const templateCreated = useRef(false)
  const dialogShown = useRef(false)

  // Create premiere template when entering creatingTemplate state
  useEffect(() => {
    if (!isCreatingTemplate || templateCreated.current || !projectFolder) return

    templateCreated.current = true

    const createTemplate = async () => {
      try {
        const filePath = `${projectFolder}/Projects/`

        await invoke('copy_premiere_project', {
          destinationFolder: filePath,
          newTitle: projectTitle
        })

        if (import.meta.env.DEV) {
          logger.log('Premiere template created successfully')
          logger.log('Sending TEMPLATE_COMPLETE event')
        }
        send({ type: 'TEMPLATE_COMPLETE' })
        if (import.meta.env.DEV) {
          logger.log('TEMPLATE_COMPLETE event sent')
        }
      } catch (error) {
        logger.error('Error creating premiere template:', error)
        send({ type: 'TEMPLATE_ERROR', error: String(error) })
      }
    }

    createTemplate()
  }, [isCreatingTemplate, projectFolder, projectTitle, send])

  // Show dialog when entering showingSuccess state
  useEffect(() => {
    if (!isShowingSuccess || dialogShown.current || !projectFolder) return

    dialogShown.current = true

    const showDialog = async () => {
      try {
        await invoke('show_confirmation_dialog', {
          message: 'Do you want to open the project folder now?',
          title: 'Transfer complete!',
          destination: projectFolder
        })

        if (import.meta.env.DEV) {
          logger.log('Dialog completed')
        }
        // Don't send DIALOG_COMPLETE - stay in showingSuccess state
      } catch (error) {
        logger.error('Error showing dialog:', error)
        // Dialog errors are non-critical, just log them
      }
    }

    showDialog()
  }, [isShowingSuccess, projectFolder])

  // Reset flags when machine returns to idle state (after RESET event)
  useEffect(() => {
    if (isIdle) {
      templateCreated.current = false
      dialogShown.current = false
    }
  }, [isIdle])
}
