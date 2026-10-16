/**
 * ParamEditor - renders editors for each param type (issue #337)
 *
 * Renders text inputs, colour pickers, hold sliders, number-list editors,
 * number spinbuttons and image pickers. Each editor updates the parent's
 * param values state via onChange.
 */
import React from 'react'
import type { MotionTemplate, ParamValues } from '../types'

export interface ParamEditorProps {
  template: MotionTemplate
  values: ParamValues
  onChange: (values: ParamValues) => void
  onPickImage?: () => void
  imageError?: string | null
}

const ParamEditor: React.FC<ParamEditorProps> = () => {
  throw new Error('not implemented')
}

export default ParamEditor
