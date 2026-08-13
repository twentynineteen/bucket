/**
 * usePosterframeTemplate (issue #189)
 *
 * The Classic/Rebrand choice shared by the Posterframe page and the upload
 * dialog. An explicit choice is remembered across sessions under one
 * localStorage key; with no choice made yet, the default is Rebrand once its
 * folder is configured and Classic until then, so updating the app never
 * disables a working Classic setup.
 */

import { useAppStore } from '@shared/store'
import { logger } from '@shared/utils'
import { useCallback, useState } from 'react'

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
  const [stored, setStored] = useState<string | null>(readStoredTemplate)
  const rebrandFolderConfigured = useAppStore(
    (state) => state.rebrandBackgroundFolder !== null
  )

  // Derived each render rather than frozen at mount: settings hydrate
  // asynchronously on launch, and a surface mounted before they arrive would
  // otherwise stay on Classic even once the Rebrand folder is known.
  const template = resolveInitialTemplate(stored, rebrandFolderConfigured)

  const setTemplate = useCallback((next: PosterframeTemplateId) => {
    setStored(next)
    try {
      localStorage.setItem(POSTERFRAME_TEMPLATE_STORAGE_KEY, next)
    } catch (error) {
      logger.warn('Failed to save the poster frame template preference:', error)
    }
  }, [])

  return { template, setTemplate }
}
