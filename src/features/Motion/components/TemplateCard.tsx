/**
 * TemplateCard - One card in the marketplace grid (issue #336).
 *
 * Displays a 16:9 preview on a dark stage, template name with a star toggle
 * inline, category chip, target icons with tooltips, and status/source markers.
 */
import { Badge } from '@shared/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@shared/ui/tooltip'
import {
  FileVideo,
  MessageSquare,
  MonitorPlay,
  Sparkles,
  Star,
  Video
} from 'lucide-react'
import React, { useMemo } from 'react'
import { deriveTargets } from '../internal/resolve'
import type { CatalogueEntry, MotionFormat, MotionTarget, ParamValues } from '../types'
import MotionPreview from './MotionPreview'
import PreviewStage from './PreviewStage'

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

// ---------------------------------------------------------------------------
// Category label map
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  'lower-third': 'Lower third',
  'title-card': 'Title card',
  transition: 'Transition',
  data: 'Data',
  accent: 'Accent'
}

// ---------------------------------------------------------------------------
// Target icon map
// ---------------------------------------------------------------------------

const TARGET_ICONS: Record<
  MotionTarget,
  { icon: React.ElementType; label: string; tooltip: string }
> = {
  ae: { icon: Sparkles, label: 'After Effects', tooltip: 'After Effects' },
  resolve: {
    icon: MonitorPlay,
    label: 'DaVinci Resolve',
    tooltip: 'DaVinci Resolve'
  },
  'mogrt-via-ae': {
    icon: FileVideo,
    label: 'Premiere (mogrt via After Effects)',
    tooltip: 'Premiere (via After Effects)'
  },
  video: {
    icon: Video,
    label: 'Video',
    tooltip: 'Video (ProRes 4444)'
  },
  prompt: {
    icon: MessageSquare,
    label: 'Claude prompt',
    tooltip: 'Claude prompt'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TemplateCard: React.FC<TemplateCardProps> = ({
  entry,
  format,
  values,
  isFavourite,
  isDefault,
  onToggleFavourite,
  onSelect,
  time
}) => {
  const { template, source } = entry
  const targets = useMemo(() => deriveTargets(template), [template])
  const isParticleOnly =
    targets.length === 2 && targets.includes('video') && targets.includes('prompt')
  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category

  return (
    <div
      data-template-id={template.id}
      className="bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border shadow-sm"
    >
      {/* 16:9 preview on a dark stage */}
      <PreviewStage>
        <MotionPreview
          template={template}
          values={values}
          format={format}
          time={time}
          name={template.name}
        />
      </PreviewStage>

      {/* Card body */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Title row: name + star */}
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={onSelect}
            className="text-foreground line-clamp-2 min-w-0 flex-1 cursor-pointer text-left text-sm font-semibold hover:underline focus:outline-none focus-visible:underline"
            aria-label={template.name}
          >
            {template.name}
          </button>
          <button
            type="button"
            aria-label={`Favourite ${template.name}`}
            aria-pressed={isFavourite}
            onClick={e => {
              e.stopPropagation()
              onToggleFavourite()
            }}
            className="text-muted-foreground hover:text-yellow-500 focus-visible:ring-ring mt-0.5 flex-shrink-0 rounded p-0.5 focus-visible:ring-1 focus-visible:outline-none"
          >
            <Star
              className={`h-4 w-4 ${isFavourite ? 'fill-yellow-500 text-yellow-500' : ''}`}
            />
          </button>
        </div>

        {/* Chips: category + status/source markers */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {categoryLabel}
          </Badge>
          {template.status === 'experimental' && (
            <Badge variant="outline" className="text-[10px]">
              Experimental
            </Badge>
          )}
          {isDefault && (
            <Badge variant="default" className="text-[10px]">
              Default
            </Badge>
          )}
          {source === 'library' && (
            <Badge variant="outline" className="text-[10px]">
              Library
            </Badge>
          )}
        </div>

        {/* Target icons with tooltips */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1.5">
            {targets.map(target => {
              const config = TARGET_ICONS[target]
              if (!config) return null
              const Icon = config.icon
              return (
                <Tooltip key={target}>
                  <TooltipTrigger asChild>
                    <span aria-label={config.label} className="text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px]">
                    {config.tooltip}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
        {isParticleOnly && (
          <p className="text-muted-foreground text-[10px]">
            Video and Claude prompt only
          </p>
        )}
      </div>
    </div>
  )
}

export default TemplateCard
