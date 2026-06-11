/**
 * Change Diff List Component
 *
 * Renders per-file change rows in a git-style +/~/− vocabulary, shared by the
 * project detail change preview and the batch update confirmation dialog.
 * Long row lists are capped with an inline "+ n more" expander; maintenance
 * fields render as one muted, uncounted row.
 */

import { Info } from 'lucide-react'
import React, { useState } from 'react'

import type { ChangeRow, ChangeRowType } from '../utils/changeRows'

const DEFAULT_ROW_CAP = 10

const SIGN_BY_TYPE: Record<ChangeRowType, string> = {
  added: '+',
  modified: '~',
  removed: '−'
}

const SIGN_CLASS_BY_TYPE: Record<ChangeRowType, string> = {
  added: 'text-success',
  modified: 'text-warning',
  removed: 'text-destructive'
}

interface ChangeDiffListProps {
  rows: ChangeRow[]
  /** Display names of maintenance fields stamped on write (renders muted, uncounted) */
  maintenanceFields?: string[]
  /** Optional context line shown above the rows (e.g. "No breadcrumbs file — a new one will be created") */
  note?: string
  cap?: number
}

export const ChangeDiffList: React.FC<ChangeDiffListProps> = ({
  rows,
  maintenanceFields = [],
  note,
  cap = DEFAULT_ROW_CAP
}) => {
  const [expanded, setExpanded] = useState(false)

  const visibleRows = expanded ? rows : rows.slice(0, cap)
  const hiddenCount = rows.length - visibleRows.length

  return (
    <div className="space-y-0.5 text-sm">
      {note && (
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-1.5 text-xs">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{note}</span>
        </div>
      )}

      {visibleRows.map((row, index) => (
        <div
          key={`${row.type}-${row.label}-${index}`}
          className="flex items-baseline gap-2.5 px-3 py-1"
        >
          <span
            className={`w-3 flex-shrink-0 text-center font-mono text-xs font-bold ${SIGN_CLASS_BY_TYPE[row.type]}`}
            aria-label={row.type}
          >
            {SIGN_BY_TYPE[row.type]}
          </span>
          <span className="text-foreground min-w-0 flex-1 [overflow-wrap:anywhere]">
            {row.label}
          </span>
          {row.detail && (
            <span className="text-muted-foreground flex-shrink-0 text-xs">
              {row.detail}
            </span>
          )}
        </div>
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary px-3 py-1 pl-[34px] text-xs hover:underline"
        >
          + {hiddenCount} more file{hiddenCount !== 1 ? 's' : ''}…
        </button>
      )}

      {maintenanceFields.length > 0 && (
        <div className="flex items-baseline gap-2.5 px-3 py-1 opacity-60">
          <span className="text-muted-foreground w-3 flex-shrink-0 text-center font-mono text-xs font-bold">
            ~
          </span>
          <span className="text-muted-foreground min-w-0 flex-1 text-xs">
            {maintenanceFields.join(', ')}
          </span>
          <span className="text-muted-foreground flex-shrink-0 text-xs">
            routine update
          </span>
        </div>
      )}
    </div>
  )
}

interface ChangeCountsProps {
  counts: { added: number; modified: number; removed: number }
}

/** Compact coloured +n ~n −n counts used in summary lines and project headers */
export const ChangeCounts: React.FC<ChangeCountsProps> = ({ counts }) => (
  <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold">
    {counts.added > 0 && <span className="text-success">+{counts.added}</span>}
    {counts.modified > 0 && <span className="text-warning">~{counts.modified}</span>}
    {counts.removed > 0 && <span className="text-destructive">−{counts.removed}</span>}
  </span>
)
