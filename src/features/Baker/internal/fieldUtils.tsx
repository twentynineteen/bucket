/**
 * Field rendering utilities for BreadcrumbsViewer
 * Extracted from BreadcrumbsViewerEnhanced.tsx (DEBT-002)
 *
 * Only the Field component is exported. Helpers that do not need to leave this
 * file (getChangeIcon, getChangeColor) are kept private so the module satisfies
 * react-refresh/only-export-components. formatFileSize was a duplicate of the
 * canonical copy in @shared/utils and has been removed (#345).
 */

import type { FieldChange } from '@features/Baker'
import { formatFieldValue } from '@shared/utils'
import { Edit, Minus, Plus } from 'lucide-react'
import React from 'react'

const getChangeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'added':
      return <Plus className="text-success h-3 w-3" />
    case 'modified':
      return <Edit className="text-warning h-3 w-3" />
    case 'removed':
      return <Minus className="text-destructive h-3 w-3" />
    default:
      return null
  }
}

const getChangeColor = (type: string): string => {
  switch (type) {
    case 'added':
      return 'bg-success/10 border-success/30'
    case 'modified':
      return 'bg-warning/10 border-warning/30'
    case 'removed':
      return 'bg-destructive/10 border-destructive/30'
    default:
      return 'bg-background border-border'
  }
}

interface FieldProps {
  label: string
  value: unknown
  icon?: React.ReactNode
  change?: FieldChange
}

export const Field: React.FC<FieldProps> = ({ label, value, icon, change }) => {
  const changeColor = change ? getChangeColor(change.type) : 'bg-background border-border'
  const changeIcon = change ? getChangeIcon(change.type) : null

  return (
    <div className={`rounded border p-2 ${changeColor}`}>
      <label className="text-muted-foreground flex items-center text-xs font-medium">
        {changeIcon && <span className="mr-1">{changeIcon}</span>}
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </label>
      <p className="text-foreground mt-1">
        {formatFieldValue(value, label.toLowerCase())}
      </p>
    </div>
  )
}
