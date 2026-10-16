/**
 * TemplateCard - One card in the marketplace grid (issue #336).
 *
 * Displays a 16:9 preview, template name, category chip, target icons,
 * status/source markers, and a favourite star toggle.
 */
import { Badge } from '@shared/ui/badge'
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

const TARGET_ICONS: Record<MotionTarget, { icon: React.ElementType; label: string }> = {
  ae: { icon: Sparkles, label: 'After Effects' },
  resolve: { icon: MonitorPlay, label: 'DaVinci Resolve' },
  'mogrt-via-ae': { icon: FileVideo, label: 'Premiere (mogrt via After Effects)' },
  video: { icon: Video, label: 'Video' },
  prompt: { icon: MessageSquare, label: 'Claude prompt' }
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
      className="bg-card border-border flex flex-col overflow-hidden rounded-xl border shadow-sm"
    >
      {/* 16:9 preview with checkerboard backdrop */}
      <div className="relative aspect-video overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%)',
              'linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%)',
              'linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%)',
              'linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)'
            ].join(', '),
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        />
        <div className="relative h-full w-full">
          <MotionPreview
            template={template}
            values={values}
            format={format}
            time={time}
            name={template.name}
          />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Name - acts as the card's main interactive element */}
        <button
          type="button"
          onClick={onSelect}
          className="text-foreground line-clamp-2 cursor-pointer text-left text-sm font-semibold hover:underline focus:outline-none focus-visible:underline"
          aria-label={template.name}
        >
          {template.name}
        </button>

        {/* Category chip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {categoryLabel}
          </Badge>

          {/* Status / source markers */}
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

        {/* Target icons */}
        <div className="flex items-center gap-1.5">
          {targets.map(target => {
            const config = TARGET_ICONS[target]
            if (!config) return null
            const Icon = config.icon
            return (
              <span
                key={target}
                aria-label={config.label}
                className="text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            )
          })}
        </div>
        {isParticleOnly && (
          <p className="text-muted-foreground text-[10px]">
            Video and Claude prompt only
          </p>
        )}

        {/* Favourite star */}
        <div className="mt-auto flex items-center justify-end pt-1">
          <button
            type="button"
            aria-label={`Favourite ${template.name}`}
            aria-pressed={isFavourite}
            onClick={e => {
              e.stopPropagation()
              onToggleFavourite()
            }}
            className="text-muted-foreground hover:text-yellow-500 focus-visible:ring-ring rounded p-0.5 focus-visible:ring-1 focus-visible:outline-none"
          >
            <Star
              className={`h-4 w-4 ${isFavourite ? 'fill-yellow-500 text-yellow-500' : ''}`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TemplateCard
