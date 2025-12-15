import { useMutation } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'

import { logger } from '@/utils/logger'

import { useVersionCheck } from './useVersionCheck'

/**
 * Show error message dialog
 */
async function showErrorMessage(text: string, title: string): Promise<void> {
  await message(text, {
    title,
    kind: 'error',
    okLabel: 'OK'
  })
}

/**
 * Show info message dialog
 */
async function showInfoMessage(text: string, title: string): Promise<void> {
  await message(text, {
    title,
    kind: 'info',
    okLabel: 'OK'
  })
}

/**
 * Attempt to download and install the update
 */
async function performUpdate(): Promise<void> {
  const update = await check()
  if (!update) {
    await showErrorMessage(
      'No update manifest found. Please try again later.',
      'Update Failed'
    )
    return
  }

  await update.downloadAndInstall()
  await invoke('graceful_restart')
}

/**
 * Handle update error by offering manual download
 */
async function handleUpdateError(updateError: Error): Promise<void> {
  logger.error('Tauri updater error:', updateError)

  const manualUpdate = await ask(
    `Automatic update failed. Would you like to download the update manually?\n\nError: ${updateError.message || 'Unknown error'}`,
    {
      title: 'Update Error',
      kind: 'warning',
      okLabel: 'Download Manually',
      cancelLabel: 'Cancel'
    }
  )

  if (manualUpdate) {
    await openUrl('https://github.com/twentynineteen/bucket/releases/latest')
  }
}

/**
 * Custom hook that returns a mutation for checking and applying updates.
 * The mutation function accepts an object with a boolean property `onUserClick`
 * to indicate if the update check was initiated by the user.
 */
export function useUpdateMutation() {
  const { refetch: checkVersion } = useVersionCheck()

  // Define the mutation function with an explicit parameter type.
  const mutationFn = async (variables: { onUserClick: boolean }): Promise<void> => {
    const { onUserClick } = variables

    try {
      const versionResult = await checkVersion()

      if (versionResult.isError) {
        await showErrorMessage(
          'Failed to check for updates. Please check your internet connection and try again.',
          'Update Check Failed'
        )
        return
      }

      const versionData = versionResult.data

      if (!versionData?.updateAvailable) {
        if (onUserClick) {
          await showInfoMessage(
            `You are on the latest version ${versionData?.currentVersion}.`,
            'No Update Available'
          )
        }
        return
      }

      // Update is available - ask user to confirm
      const userConfirmed = await ask(
        `Update from ${versionData.currentVersion} to ${versionData.latestVersion} is available!\n\nRelease notes: ${versionData.releaseNotes}`,
        {
          title: 'Update Available',
          kind: 'info',
          okLabel: 'Update',
          cancelLabel: 'Cancel'
        }
      )

      if (!userConfirmed) return

      try {
        await performUpdate()
      } catch (updateError) {
        await handleUpdateError(updateError as Error)
      }
    } catch (error) {
      logger.error('Update check error:', error)
      await showErrorMessage(
        (error as Error).message || 'An unexpected error occurred during update check.',
        'Error'
      )
    }
  }

  // Return the mutation using the new options object format.
  return useMutation<void, Error, { onUserClick: boolean }>({
    mutationFn: mutationFn
  })
}
