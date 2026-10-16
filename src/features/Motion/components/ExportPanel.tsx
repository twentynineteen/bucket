/**
 * ExportPanel - format select, project folder, targets and actions (issue #337)
 *
 * Tested through MotionTemplateDialog.test.tsx.
 */
import React from 'react'
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
  canExport: boolean
  isExporting: boolean
  onExport: () => void
  canCopyPrompt: boolean
  onCopyPrompt: () => void
  renderProgress: number | null
  onCancelRender: () => void
  validFormats: MotionFormat[]
}

const ExportPanel: React.FC<ExportPanelProps> = () => {
  throw new Error('not implemented')
}

export default ExportPanel
