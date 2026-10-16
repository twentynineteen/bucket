/**
 * MotionPreview - SVG + particle canvas for one template at one time (issue #335).
 *
 * Renders the evaluator output as:
 *   - An SVG with viewBox 0 0 3840 2160 for vector layers
 *   - A canvas overlay for particle layers
 *
 * Props:
 *   - template: MotionTemplate
 *   - values: ParamValues (current param values)
 *   - format: MotionFormat (for resolveTemplate)
 *   - time: number | null (null = hide, e.g. during loop gap)
 *   - name: string (accessible name)
 */
import React from 'react'
import type { MotionFormat, MotionTemplate, ParamValues } from '../types'

export interface MotionPreviewProps {
  template: MotionTemplate
  values: ParamValues
  format: MotionFormat
  time: number | null
  name: string
}

const MotionPreview: React.FC<MotionPreviewProps> = props => {
  void props
  throw new Error('not implemented')
}

export default MotionPreview
