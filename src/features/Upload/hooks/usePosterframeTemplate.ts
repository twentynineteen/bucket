/**
 * usePosterframeTemplate (issue #189)
 *
 * The Classic/Rebrand choice shared by the Posterframe page and both upload
 * dialogs. The live value sits in the app store so every mounted instance
 * agrees at once (the AddVideo dialog and the card poster frame dialog mount
 * this twice in one tree); localStorage keeps the durable copy across
 * sessions. With no choice made yet, the default is Rebrand once its folder
 * is configured and Classic until then, so updating the app never disables a
 * working Classic setup.
 */

import { useAppStore } from '@shared/store'
import { logger } from '@shared/utils'
import { useCallback } from 'react'

import {
  POSTERFRAME_TEMPLATE_STORAGE_KEY,
  resolveInitialTemplate,
  type PosterframeTemplateId
} from '../internal/posterframeTemplates'

function readStoredTemplate(): string | null {
  try {
    return localStorage.getItem(POSTERFRAME_TEMPLATE_STORAGE_KEY)
  } catch (error) {
    logger.warn('Failed to read the poster frame template preference:', error)
    return null
  }
}

export function usePosterframeTemplate(): {
  template: PosterframeTemplateId
  setTemplate: (template: PosterframeTemplateId) => void
} {
  const sessionChoice = useAppStore((state) => state.posterframeTemplateChoice)
  const setSessionChoice = useAppStore((state) => state.setPosterframeTemplateChoice)
  // Boolean(), not `!== null`: a pre-#189 settings file hydrates the store
  // field as undefined, and treating that as configured would default every
  // existing install onto a Rebrand template with no backgrounds (review
  // round, finding 1).
  const rebrandFolderConfigured = useAppStore((state) =>
    Boolean(state.rebrandBackgroundFolder)
  )

  // Derived each render rather than frozen at mount: settings hydrate
  // asynchronously on launch, and a surface mounted before they arrive would
  // otherwise stay on Classic even once the Rebrand folder is known.
  const template = resolveInitialTemplate(
    sessionChoice ?? readStoredTemplate(),
    rebrandFolderConfigured
  )

  const setTemplate = useCallback(
    (next: PosterframeTemplateId) => {
      setSessionChoice(next)
      try {
        localStorage.setItem(POSTERFRAME_TEMPLATE_STORAGE_KEY, next)
      } catch (error) {
        logger.warn('Failed to save the poster frame template preference:', error)
      }
    },
    [setSessionChoice]
  )

  return { template, setTemplate }
}
