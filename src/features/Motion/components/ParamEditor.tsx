/**
 * ParamEditor - renders editors for each param type (issue #337)
 *
 * Renders text inputs, colour pickers, hold sliders, number-list editors,
 * number spinbuttons and image pickers. Each editor updates the parent's
 * param values state via onChange.
 */
import { Alert, AlertDescription } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { AlertCircle, ImageIcon, Minus, Plus } from 'lucide-react'
import React, { useCallback } from 'react'
import type { ParamError } from '../internal/resolve'
import type {
  ColourParamDef,
  HoldParamDef,
  ImageParamDef,
  ImageValue,
  MotionTemplate,
  NumberListItem,
  NumberListParamDef,
  NumberParamDef,
  ParamDef,
  ParamValues,
  TextParamDef
} from '../types'

export interface ParamEditorProps {
  template: MotionTemplate
  values: ParamValues
  onChange: (values: ParamValues) => void
  onPickImage?: () => void
  imageError?: string | null
  /** Validation errors from validateParams (includes line-count errors). */
  paramErrors?: ParamError[]
}

// ---------------------------------------------------------------------------
// Text param
// ---------------------------------------------------------------------------

function TextParamField({
  id,
  def,
  value,
  onUpdate
}: {
  id: string
  def: TextParamDef
  value: string
  onUpdate: (val: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`param-${id}`}>{def.label}</Label>
        <span className="text-muted-foreground text-xs">
          {value.length}/{def.maxLength}
        </span>
      </div>
      <Input
        id={`param-${id}`}
        value={value}
        onChange={e => onUpdate(e.target.value)}
        maxLength={def.maxLength}
        placeholder={def.default}
      />
      {def.required && value === '' && (
        <p className="text-destructive text-xs">{def.label} is required</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour param
// ---------------------------------------------------------------------------

function ColourParamField({
  id,
  def,
  value,
  onUpdate
}: {
  id: string
  def: ColourParamDef
  value: string
  onUpdate: (val: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`param-${id}`}>{def.label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`param-${id}`}
          type="color"
          value={value}
          onChange={e => onUpdate(e.target.value)}
          aria-label={def.label}
          className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <Input
          value={value}
          onChange={e => onUpdate(e.target.value)}
          className="w-28 font-mono text-xs"
          maxLength={7}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hold param (slider)
// ---------------------------------------------------------------------------

function HoldParamField({
  id,
  def,
  value,
  onUpdate
}: {
  id: string
  def: HoldParamDef
  value: number
  onUpdate: (val: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`param-${id}`}>{def.label}</Label>
        <span className="text-muted-foreground text-xs">{value.toFixed(1)}s</span>
      </div>
      <input
        id={`param-${id}`}
        type="range"
        role="slider"
        aria-label={def.label}
        aria-valuemin={def.min}
        aria-valuemax={def.max}
        aria-valuenow={value}
        min={def.min}
        max={def.max}
        step={0.1}
        value={value}
        onChange={e => onUpdate(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// NumberList param
// ---------------------------------------------------------------------------

const MAX_ROWS = 8

function NumberListParamField({
  def,
  value,
  onUpdate
}: {
  id: string
  def: NumberListParamDef
  value: NumberListItem[]
  onUpdate: (val: NumberListItem[]) => void
}) {
  const addRow = () => {
    if (value.length >= MAX_ROWS) return
    onUpdate([...value, { label: '', value: 0 }])
  }

  const removeRow = (index: number) => {
    onUpdate(value.filter((_, i) => i !== index))
  }

  const updateRow = (
    index: number,
    field: 'label' | 'value',
    newVal: string | number
  ) => {
    const updated = value.map((item, i) => {
      if (i !== index) return item
      if (field === 'label') return { ...item, label: String(newVal) }
      return { ...item, value: Number(newVal) }
    })
    onUpdate(updated)
  }

  return (
    <div className="space-y-2">
      <Label>{def.label}</Label>
      <div className="space-y-1.5">
        {value.map((item, i) => {
          const outOfRange = item.value < def.valueMin || item.value > def.valueMax
          return (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={item.label}
                onChange={e => updateRow(i, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1"
                aria-label={`Row ${i + 1} label`}
              />
              <Input
                type="number"
                role="spinbutton"
                value={item.value}
                onChange={e => updateRow(i, 'value', e.target.value)}
                min={def.valueMin}
                max={def.valueMax}
                className="w-24"
                aria-label={`Row ${i + 1} value`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label={`Remove row ${i + 1}`}
                className="h-8 w-8 shrink-0"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              {outOfRange && (
                <span
                  className="text-destructive text-xs"
                  role="alert"
                  aria-label={`Row ${i + 1} outside range`}
                >
                  Value outside {def.valueMin}-{def.valueMax}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={value.length >= MAX_ROWS}
        aria-label="Add row"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add row
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Number param
// ---------------------------------------------------------------------------

function NumberParamField({
  id,
  def,
  value,
  onUpdate
}: {
  id: string
  def: NumberParamDef
  value: number
  onUpdate: (val: number) => void
}) {
  const outOfRange = value < def.min || value > def.max

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`param-${id}`}>{def.label}</Label>
      <Input
        id={`param-${id}`}
        type="number"
        role="spinbutton"
        aria-label={def.label}
        value={value}
        onChange={e => onUpdate(Number(e.target.value))}
        min={def.min}
        max={def.max}
      />
      {outOfRange && (
        <p className="text-destructive text-xs" role="alert">
          Value outside range {def.min}-{def.max}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image param
// ---------------------------------------------------------------------------

function ImageParamField({
  def,
  value,
  onPickImage,
  imageError
}: {
  id: string
  def: ImageParamDef
  value: ImageValue | undefined
  onPickImage?: () => void
  imageError?: string | null
}) {
  const picked =
    value && typeof value === 'object' && 'pickedPath' in value
      ? (value as { pickedPath: string }).pickedPath
      : null

  return (
    <div className="space-y-1.5">
      <Label>{def.label}</Label>
      <Button variant="outline" onClick={onPickImage} className="w-full">
        <ImageIcon className="mr-2 h-4 w-4" />
        Choose image
      </Button>
      {picked && (
        <p className="text-muted-foreground truncate text-xs">
          {picked.split('/').pop()}
        </p>
      )}
      {imageError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{imageError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function resolveParamValue(def: ParamDef, values: ParamValues, id: string) {
  const raw = values[id]
  switch (def.kind) {
    case 'text':
      return typeof raw === 'string' ? raw : def.default
    case 'colour':
      return typeof raw === 'string' ? raw : def.default
    case 'hold':
      return typeof raw === 'number' ? raw : def.default
    case 'numberList':
      return Array.isArray(raw) ? (raw as NumberListItem[]) : def.default
    case 'number':
      return typeof raw === 'number' ? raw : def.default
    case 'image':
      return raw as ImageValue | undefined
    default:
      return raw
  }
}

const ParamEditor: React.FC<ParamEditorProps> = ({
  template,
  values,
  onChange,
  onPickImage,
  imageError,
  paramErrors
}) => {
  const handleUpdate = useCallback(
    (paramId: string, val: string | number | NumberListItem[] | ImageValue) => {
      onChange({ ...values, [paramId]: val })
    },
    [values, onChange]
  )

  /**
   * Get the first error for a param that the field does not already render.
   * TextParamField shows "required" and maxLength inline, so only errors the
   * field cannot know about (line-count) are surfaced here.
   */
  const errorFor = (paramId: string): string | undefined => {
    const match = paramErrors?.find(e => e.paramId === paramId && e.kind === 'lineCount')
    return match?.message
  }

  return (
    <div className="space-y-4">
      {Object.entries(template.params).map(([id, def]) => {
        const val = resolveParamValue(def, values, id)
        const error = errorFor(id)

        switch (def.kind) {
          case 'text':
            return (
              <div key={id} className="space-y-1.5">
                <TextParamField
                  id={id}
                  def={def}
                  value={val as string}
                  onUpdate={v => handleUpdate(id, v)}
                />
                {error && (
                  <p className="text-destructive text-xs" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          case 'colour':
            return (
              <ColourParamField
                key={id}
                id={id}
                def={def}
                value={val as string}
                onUpdate={v => handleUpdate(id, v)}
              />
            )
          case 'hold':
            return (
              <HoldParamField
                key={id}
                id={id}
                def={def}
                value={val as number}
                onUpdate={v => handleUpdate(id, v)}
              />
            )
          case 'numberList':
            return (
              <NumberListParamField
                key={id}
                id={id}
                def={def}
                value={val as NumberListItem[]}
                onUpdate={v => handleUpdate(id, v)}
              />
            )
          case 'number':
            return (
              <NumberParamField
                key={id}
                id={id}
                def={def}
                value={val as number}
                onUpdate={v => handleUpdate(id, v)}
              />
            )
          case 'image':
            return (
              <ImageParamField
                key={id}
                id={id}
                def={def}
                value={val as ImageValue | undefined}
                onPickImage={onPickImage}
                imageError={imageError}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

export default ParamEditor
