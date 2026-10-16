/**
 * TemplateCard - One card in the marketplace grid (issue #336).
 * Stub - implementation follows after red tests.
 */
import React from 'react'
import type { CatalogueEntry, MotionFormat, ParamValues } from '../types'

export interface TemplateCardProps {
  entry: CatalogueEntry
  format: MotionFormat
  values: ParamValues
  isFavourite: boolean
  isDefault: boolean
  onToggleFavourite: () => void
  onSelect: () => void
  time: number | null
}

const TemplateCard: React.FC<TemplateCardProps> = () => {
  throw new Error('not implemented')
}

export default TemplateCard
