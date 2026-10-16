/**
 * CatalogueIssuesBanner - Dismissible banner for template load errors (issue #336).
 * Stub - implementation follows after red tests.
 */
import React from 'react'
import type { CatalogueIssue } from '../types'

export interface CatalogueIssuesBannerProps {
  issues: CatalogueIssue[]
  onDismiss: () => void
}

const CatalogueIssuesBanner: React.FC<CatalogueIssuesBannerProps> = () => {
  throw new Error('not implemented')
}

export default CatalogueIssuesBanner
