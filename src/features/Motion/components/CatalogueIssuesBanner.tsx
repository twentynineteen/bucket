/**
 * CatalogueIssuesBanner - Dismissible banner for template load errors (issue #336).
 */
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import React from 'react'
import type { CatalogueIssue } from '../types'

export interface CatalogueIssuesBannerProps {
  issues: CatalogueIssue[]
  onDismiss: () => void
}

const CatalogueIssuesBanner: React.FC<CatalogueIssuesBannerProps> = ({
  issues,
  onDismiss
}) => {
  if (issues.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {issues.length} template{issues.length === 1 ? '' : 's'} couldn&apos;t be loaded
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-0.5 text-xs">
          {issues.map((issue, i) => (
            <li key={i}>
              <span className="font-medium">{issue.path}</span>: {issue.message}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-2" onClick={onDismiss}>
          <X className="mr-1 h-3 w-3" />
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export default CatalogueIssuesBanner
