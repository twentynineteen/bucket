/**
 * ExportPanel - format select, project folder, targets and actions (issue #337)
 *
 * Tested through MotionTemplateDialog.test.tsx.
 */
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Label } from '@shared/ui/label'
import { Progress } from '@shared/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { AlertTriangle, FolderOpen, X } from 'lucide-react'
import React, { useMemo } from 'react'
import type { MotionFormat, MotionTarget, MotionTemplate } from '../types'

export interface ExportPanelProps {
  template: MotionTemplate
  format: MotionFormat
  onFormatChange: (format: MotionFormat) => void
  projectFolder: string | null
  onPickFolder: () => void
  folderWarning: string | null
  targets: MotionTarget[]
  onTargetsChange: (targets: MotionTarget[]) => void
  supportedTargets: MotionTarget[]
  isParticle: boolean
  ffmpegAvailable: boolean
  fontInstalled: boolean
  fontName: string
  renderProgress: number | null
  onCancelRender: () => void
  validFormats: MotionFormat[]
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatLabel(f: MotionFormat): string {
  return `${f.width}×${f.height} @ ${f.fps} fps`
}

function formatKey(f: MotionFormat): string {
  return `${f.width}x${f.height}@${f.fps}`
}

function parseFormatKey(key: string): MotionFormat | null {
  const match = key.match(/^(\d+)x(\d+)@(\d+)$/)
  if (!match) return null
  return {
    width: parseInt(match[1]) as 3840 | 1920,
    height: parseInt(match[2]) as 2160 | 1080,
    fps: parseInt(match[3]) as 24 | 25 | 30 | 50 | 60
  }
}

// All possible formats
const ALL_FORMATS: MotionFormat[] = [
  { width: 3840, height: 2160, fps: 24 },
  { width: 3840, height: 2160, fps: 25 },
  { width: 3840, height: 2160, fps: 30 },
  { width: 3840, height: 2160, fps: 50 },
  { width: 3840, height: 2160, fps: 60 },
  { width: 1920, height: 1080, fps: 24 },
  { width: 1920, height: 1080, fps: 25 },
  { width: 1920, height: 1080, fps: 30 },
  { width: 1920, height: 1080, fps: 50 },
  { width: 1920, height: 1080, fps: 60 }
]

// ---------------------------------------------------------------------------
// Target labels
// ---------------------------------------------------------------------------

const TARGET_LABELS: Record<MotionTarget, string> = {
  ae: 'After Effects',
  resolve: 'DaVinci Resolve',
  'mogrt-via-ae': 'Premiere (mogrt via After Effects)',
  video: 'Video',
  prompt: 'Claude prompt'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExportPanel: React.FC<ExportPanelProps> = ({
  format,
  onFormatChange,
  projectFolder,
  onPickFolder,
  folderWarning,
  targets,
  onTargetsChange,
  supportedTargets,
  ffmpegAvailable,
  fontInstalled,
  fontName,
  renderProgress,
  onCancelRender,
  validFormats
}) => {
  const validKeys = useMemo(() => new Set(validFormats.map(formatKey)), [validFormats])

  const handleTargetToggle = (target: MotionTarget, checked: boolean) => {
    if (checked) {
      onTargetsChange([...targets, target])
    } else {
      onTargetsChange(targets.filter(t => t !== target))
    }
  }

  const videoDisabledReason = !ffmpegAvailable ? 'ffmpeg' : !fontInstalled ? 'font' : null

  return (
    <div className="space-y-4">
      {/* Format select */}
      <div className="space-y-1.5">
        <Label htmlFor="format-select">Format</Label>
        <Select
          value={formatKey(format)}
          onValueChange={val => {
            const f = parseFormatKey(val)
            if (f) onFormatChange(f)
          }}
        >
          <SelectTrigger id="format-select" aria-label="Format">
            <SelectValue>{formatLabel(format)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ALL_FORMATS.map(f => {
              const key = formatKey(f)
              const valid = validKeys.has(key)
              return (
                <SelectItem key={key} value={key} disabled={!valid}>
                  {formatLabel(f)}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Project folder */}
      <div className="space-y-1.5">
        <Label>Project folder</Label>
        <Button
          variant="outline"
          onClick={onPickFolder}
          className="w-full justify-start"
          aria-label="Choose project folder"
        >
          <FolderOpen className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {projectFolder ? projectFolder.split('/').pop() : 'Choose project folder'}
          </span>
        </Button>
        {projectFolder && folderWarning && (
          <p className="text-warning flex items-start gap-1.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>This folder does not look like a Bucket project</span>
          </p>
        )}
      </div>

      {/* Targets */}
      <div className="space-y-2">
        <Label>Targets</Label>
        {supportedTargets.map(target => {
          const isVideo = target === 'video'
          const disabled = isVideo && videoDisabledReason !== null
          const checked = !disabled && targets.includes(target)

          return (
            <div key={target} className="flex items-start gap-2">
              <Checkbox
                id={`target-${target}`}
                checked={checked}
                onCheckedChange={c => handleTargetToggle(target, c === true)}
                disabled={disabled}
                aria-label={TARGET_LABELS[target]}
              />
              <div className="flex-1">
                <Label htmlFor={`target-${target}`} className="cursor-pointer text-sm">
                  {TARGET_LABELS[target]}
                </Label>
                {isVideo && videoDisabledReason === 'ffmpeg' && (
                  <p className="text-muted-foreground text-xs">
                    <a
                      href="/settings/general#kavanagh"
                      className="text-primary underline"
                    >
                      Set up ffmpeg in Settings
                    </a>
                  </p>
                )}
                {isVideo && videoDisabledReason === 'font' && (
                  <p className="text-muted-foreground text-xs">
                    Requires {fontName} in ~/Library/Fonts
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Render progress */}
      {renderProgress !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rendering video</span>
            <span className="text-muted-foreground">
              {Math.round(renderProgress * 100)}%
            </span>
          </div>
          <Progress value={renderProgress * 100} aria-label="Rendering video" />
          <Button variant="ghost" size="sm" onClick={onCancelRender}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel render
          </Button>
        </div>
      )}
    </div>
  )
}

export default ExportPanel
