import { cn } from '@shared/utils'
import * as React from 'react'

interface PageHeaderProps {
  /** The page name. Rendered as the page's only `<h1>`. */
  title: React.ReactNode
  /** One line saying what the page is for. */
  description?: React.ReactNode
  /** Optional icon shown before the title. */
  icon?: React.ReactNode
  /** Buttons aligned to the right edge. */
  actions?: React.ReactNode
  /** Controls that share the row and take the remaining width (Baker's scan bar). */
  children?: React.ReactNode
  className?: string
}

/**
 * The header every feature page opens with: a compact title, an optional
 * one-line description under it, and the page's own controls on the same row.
 *
 * Each page used to hand-roll this block with a 24px bold title. The window's
 * top bar already carries the breadcrumb trail, so the page title only needs to
 * anchor the row, and every page now does it the same way.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  actions,
  children,
  className
}) => (
  <div
    className={cn(
      'border-border flex flex-shrink-0 items-center gap-3 border-b px-6 py-2.5',
      className
    )}
  >
    {icon}
    <div className={cn('min-w-0', children ? 'flex-shrink-0' : 'flex-1')}>
      <h1 className="text-foreground text-lg leading-tight font-semibold">{title}</h1>
      {description && (
        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{description}</p>
      )}
    </div>
    {children}
    {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
  </div>
)
