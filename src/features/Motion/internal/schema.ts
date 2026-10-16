/**
 * Motion template schema and parser (issue #327)
 *
 * Zod schema for the template JSON format. Cross-field validations that depend
 * on sibling fields (colour-animated-fill clash, image-requires-particles, etc.)
 * are applied in a superRefine on the top-level template object.
 */
import { z } from 'zod'
import type { MotionTemplate } from '../types'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const easeSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(([x1, , x2]) => x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1, {
    message: 'ease x1 and x2 must be in [0, 1]'
  })

function keyframeSchema<V extends z.ZodType>(valueSchema: V) {
  return z.object({
    t: z.number(),
    value: valueSchema,
    ease: easeSchema.optional()
  })
}

const numberKeyframeSchema = keyframeSchema(z.number())
const stringKeyframeSchema = keyframeSchema(z.string())
const pointKeyframeSchema = keyframeSchema(z.object({ x: z.number(), y: z.number() }))

/**
 * Validate keyframe ease rules: every keyframe except the last must have ease.
 * The last keyframe may omit it.
 */
function validateKeyframeEases(
  keyframes: { t: number; ease?: unknown }[],
  fieldPath: string
): string[] {
  const issues: string[] = []
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (!keyframes[i].ease) {
      issues.push(`${fieldPath}[${i}].ease is required (not the last keyframe)`)
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

const textParamSchema = z.object({
  kind: z.literal('text'),
  label: z.string(),
  maxLength: z.number().int().positive(),
  default: z.string(),
  required: z.boolean()
})

const colourParamSchema = z.object({
  kind: z.literal('colour'),
  label: z.string(),
  default: z.string(),
  binds: z.array(z.string())
})

const holdParamSchema = z.object({
  kind: z.literal('hold'),
  label: z.string(),
  min: z.number(),
  max: z.number(),
  default: z.number()
})

const numberListItemSchema = z.object({
  label: z.string(),
  value: z.number()
})

const numberListParamSchema = z.object({
  kind: z.literal('numberList'),
  label: z.string(),
  default: z
    .array(numberListItemSchema)
    .max(8, 'numberList default may have at most 8 items'),
  valueMin: z.number(),
  valueMax: z.number()
})

const numberParamSchema = z.object({
  kind: z.literal('number'),
  label: z.string(),
  default: z.number(),
  min: z.number(),
  max: z.number()
})

const imageParamSchema = z.object({
  kind: z.literal('image'),
  label: z.string()
})

const paramDefSchema = z.discriminatedUnion('kind', [
  textParamSchema,
  colourParamSchema,
  holdParamSchema,
  numberListParamSchema,
  numberParamSchema,
  imageParamSchema
])

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

const anchorSchema = z.object({ x: z.number(), y: z.number() })
const fontSchema = z.object({
  family: z.string(),
  style: z.string(),
  size: z.number().positive()
})
const staggerSchema = z.object({ delay: z.number().nonnegative() })
const counterSchema = z.object({
  param: z.string(),
  decimals: z.number().int().nonnegative(),
  prefix: z.string(),
  suffix: z.string(),
  progress: z.array(numberKeyframeSchema).min(1)
})

const layerBase = {
  id: z.string(),
  anchor: anchorSchema,
  position: z.array(pointKeyframeSchema).optional(),
  scale: z.array(pointKeyframeSchema).optional(),
  rotation: z.array(numberKeyframeSchema).optional(),
  opacity: z.array(numberKeyframeSchema).optional()
}

const textLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('text'),
  text: z.string(),
  param: z.string().optional(),
  font: fontSchema,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().positive(),
  multiline: z.boolean(),
  fill: z.string(),
  fillAnimation: z.array(stringKeyframeSchema).optional(),
  tracking: z.array(numberKeyframeSchema).optional(),
  stagger: staggerSchema.optional(),
  counter: counterSchema.optional(),
  width: z.number().positive().optional()
})

const rectLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('rect'),
  width: z.number().positive(),
  height: z.number().positive(),
  widthAnimation: z.array(numberKeyframeSchema).optional(),
  heightAnimation: z.array(numberKeyframeSchema).optional(),
  fill: z.string(),
  fillAnimation: z.array(stringKeyframeSchema).optional(),
  radius: z.number().nonnegative()
})

const ellipseLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('ellipse'),
  radiusX: z.number().positive(),
  radiusY: z.number().positive(),
  fill: z.string(),
  fillAnimation: z.array(stringKeyframeSchema).optional()
})

const pathLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('path'),
  d: z.string(),
  fill: z.string(),
  fillAnimation: z.array(stringKeyframeSchema).optional()
})

const arcLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('arc'),
  innerRadius: z.number().nonnegative(),
  outerRadius: z.number().positive(),
  sweep: z.array(numberKeyframeSchema).min(1),
  startAngle: z.array(numberKeyframeSchema).min(1),
  sweepFromParam: z.object({ param: z.string(), max: z.number().positive() }).optional(),
  fill: z.string(),
  fillAnimation: z.array(stringKeyframeSchema).optional()
})

const particlesLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('particles'),
  points: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      region: z.string().optional()
    })
  ),
  seed: z.number().int(),
  assembleStart: z.number().nonnegative(),
  assembleEnd: z.number().positive(),
  baseFill: z.string(),
  regionFills: z.record(z.string(), z.string()),
  pointRadius: z.number().positive(),
  imageParam: z.string().optional()
})

const seriesSpecSchema = z.object({
  param: z.string(),
  area: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  valueRange: z.tuple([z.number(), z.number()]),
  dot: z.object({
    radiusX: z.number().positive(),
    radiusY: z.number().positive(),
    fill: z.string()
  }),
  connector: z.object({
    dotSpacing: z.number().positive(),
    radius: z.number().positive(),
    fill: z.string()
  }),
  label: z.object({
    font: fontSchema,
    fill: z.string(),
    align: z.enum(['left', 'center', 'right']),
    offsetY: z.number()
  }),
  marker: z.object({
    ellipse: z.object({
      radiusX: z.number().positive(),
      radiusY: z.number().positive(),
      fill: z.string()
    }),
    segmentDuration: z.number().positive(),
    ease: easeSchema
  }),
  band: z
    .object({
      fromIndex: z.number().int().nonnegative().optional(),
      toIndex: z.number().int().nonnegative().optional(),
      hatch: z.object({
        spacing: z.number().positive(),
        angle: z.number(),
        fill: z.string()
      })
    })
    .optional()
})

const seriesLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('series'),
  series: seriesSpecSchema
})

// Recursive layer schema using z.lazy
const layerSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion('kind', [
    textLayerSchema,
    rectLayerSchema,
    ellipseLayerSchema,
    pathLayerSchema,
    arcLayerSchema,
    z.object({
      ...layerBase,
      kind: z.literal('group'),
      children: z.array(layerSchema).min(1)
    }),
    particlesLayerSchema,
    seriesLayerSchema
  ])
)

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEMVER_RE = /^\d+\.\d+\.\d+$/

const templateBaseSchema = z.object({
  schemaVersion: z.number().int(),
  id: z.string().regex(KEBAB_RE, 'id must be kebab-case'),
  version: z.string().regex(SEMVER_RE, 'version must be semver (MAJOR.MINOR.PATCH)'),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['lower-third', 'title-card', 'transition', 'data', 'accent']),
  status: z.enum(['stable', 'experimental']),
  tags: z.array(z.string()),
  fonts: z.array(z.string()),
  primaryTextParam: z.string().optional(),
  credits: z
    .array(
      z.object({
        title: z.string(),
        author: z.string(),
        url: z.string(),
        licence: z.string()
      })
    )
    .optional(),
  duration: z.number().positive(),
  inEnd: z.number().nonnegative(),
  outStart: z.number().nonnegative(),
  hold: z
    .object({
      min: z.number(),
      max: z.number(),
      default: z.number()
    })
    .optional(),
  params: z.record(z.string(), paramDefSchema),
  layers: z.array(layerSchema).min(1)
})

// ---------------------------------------------------------------------------
// Cross-field validation helpers
// ---------------------------------------------------------------------------

/** Walk all layers recursively, yielding each with its path. */
function* walkLayers(
  layers: unknown[],
  prefix = 'layers'
): Generator<{ layer: Record<string, unknown>; path: string }> {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i] as Record<string, unknown>
    const path = `${prefix}[${i}]`
    yield { layer, path }
    if (layer.kind === 'group' && Array.isArray(layer.children)) {
      yield* walkLayers(layer.children, `${path}.children`)
    }
  }
}

/** Collect all animated fill paths in the template. */
function animatedFillPaths(layers: unknown[]): Set<string> {
  const paths = new Set<string>()
  for (const { layer, path } of walkLayers(layers)) {
    if (
      Array.isArray((layer as Record<string, unknown>).fillAnimation) &&
      ((layer as Record<string, unknown>).fillAnimation as unknown[]).length > 0
    ) {
      paths.add(path)
    }
  }
  return paths
}

/** Check whether the template contains a particles layer at any depth. */
function hasParticlesLayer(layers: unknown[]): boolean {
  for (const { layer } of walkLayers(layers)) {
    if (layer.kind === 'particles') return true
  }
  return false
}

/** Check whether a path is closed (ends with Z or z). */
function isClosedPath(d: string): boolean {
  return /[Zz]\s*$/.test(d.trim())
}

/** Collect all keyframe tracks in a layer for ease validation. */
function collectKeyframeTracks(
  layer: Record<string, unknown>,
  path: string
): { keyframes: { t: number; ease?: unknown }[]; fieldPath: string }[] {
  const tracks: { keyframes: { t: number; ease?: unknown }[]; fieldPath: string }[] = []
  const trackFields = [
    'position',
    'scale',
    'rotation',
    'opacity',
    'fillAnimation',
    'tracking',
    'widthAnimation',
    'heightAnimation',
    'sweep',
    'startAngle'
  ]
  for (const field of trackFields) {
    const val = layer[field]
    if (Array.isArray(val) && val.length > 0) {
      tracks.push({ keyframes: val, fieldPath: `${path}.${field}` })
    }
  }
  // Counter progress
  if (
    layer.counter &&
    typeof layer.counter === 'object' &&
    Array.isArray((layer.counter as Record<string, unknown>).progress)
  ) {
    tracks.push({
      keyframes: (layer.counter as Record<string, unknown>).progress as {
        t: number
        ease?: unknown
      }[],
      fieldPath: `${path}.counter.progress`
    })
  }
  return tracks
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParseResult =
  { success: true; data: MotionTemplate } | { success: false; error: string }

/**
 * Parse and validate a Motion template from an unknown JSON value.
 *
 * Returns a discriminated result rather than throwing, so callers can report
 * every load error without try/catch.
 */
export function parseTemplate(json: unknown): ParseResult {
  // First check schemaVersion before the full parse, so we can give a clear
  // message for future versions.
  if (
    typeof json === 'object' &&
    json !== null &&
    'schemaVersion' in json &&
    (json as Record<string, unknown>).schemaVersion !== 1
  ) {
    return {
      success: false,
      error: `unsupported schemaVersion: ${(json as Record<string, unknown>).schemaVersion}`
    }
  }

  const baseResult = templateBaseSchema.safeParse(json)
  if (!baseResult.success) {
    // Extract the first meaningful error message
    const issues = JSON.parse(baseResult.error.message) as {
      path: (string | number)[]
      message: string
    }[]
    const first = issues[0]
    const fieldPath = first?.path?.join('.') || ''
    const msg = first?.message || 'Invalid template'
    return {
      success: false,
      error: fieldPath ? `${fieldPath}: ${msg}` : msg
    }
  }

  const data = baseResult.data as unknown as MotionTemplate

  // Cross-field validations
  const errors: string[] = []

  // inEnd <= outStart
  if (data.inEnd > data.outStart) {
    errors.push('inEnd must be <= outStart')
  }

  // primaryTextParam must name a text param
  if (data.primaryTextParam) {
    const p = data.params[data.primaryTextParam]
    if (!p) {
      errors.push(`primaryTextParam: param "${data.primaryTextParam}" does not exist`)
    } else if (p.kind !== 'text') {
      errors.push(
        `primaryTextParam: param "${data.primaryTextParam}" is not a text param`
      )
    }
  }

  // colour params bound to animated fills
  const animFills = animatedFillPaths(data.layers as unknown as unknown[])
  for (const [paramId, paramDef] of Object.entries(data.params)) {
    if (paramDef.kind === 'colour') {
      for (const bindPath of paramDef.binds) {
        if (animFills.has(bindPath)) {
          errors.push(
            `params.${paramId}: colour param bound to an animated fill at ${bindPath}`
          )
        }
      }
    }
  }

  // image param requires particles layer
  const hasImageParam = Object.values(data.params).some(p => p.kind === 'image')
  if (hasImageParam && !hasParticlesLayer(data.layers as unknown as unknown[])) {
    errors.push('image param requires at least one particles layer')
  }

  // Walk layers for deeper checks
  for (const { layer, path } of walkLayers(data.layers as unknown as unknown[])) {
    const l = layer as Record<string, unknown>

    // path must be closed
    if (l.kind === 'path' && typeof l.d === 'string' && !isClosedPath(l.d)) {
      errors.push(`${path}.d: path must be closed (end with Z)`)
    }

    // stagger only on text layers
    if (l.stagger && l.kind !== 'text') {
      errors.push(`${path}.stagger: stagger is only allowed on text layers`)
    }

    // series param must be numberList
    if (l.kind === 'series') {
      const series = l.series as Record<string, unknown>
      const seriesParam = series.param as string
      const p = data.params[seriesParam]
      if (!p) {
        errors.push(`${path}.series.param: param "${seriesParam}" does not exist`)
      } else if (p.kind !== 'numberList') {
        errors.push(
          `${path}.series.param: param "${seriesParam}" must be a numberList param`
        )
      }
    }

    // counter param must be number
    if (l.counter && typeof l.counter === 'object') {
      const counter = l.counter as Record<string, unknown>
      const counterParam = counter.param as string
      const p = data.params[counterParam]
      if (!p) {
        errors.push(`${path}.counter.param: param "${counterParam}" does not exist`)
      } else if (p.kind !== 'number') {
        errors.push(
          `${path}.counter.param: param "${counterParam}" must be a number param`
        )
      }
    }

    // sweepFromParam param must be number
    if (l.kind === 'arc' && l.sweepFromParam) {
      const sfp = l.sweepFromParam as Record<string, unknown>
      const sfpParam = sfp.param as string
      const p = data.params[sfpParam]
      if (!p) {
        errors.push(`${path}.sweepFromParam.param: param "${sfpParam}" does not exist`)
      } else if (p.kind !== 'number') {
        errors.push(
          `${path}.sweepFromParam.param: param "${sfpParam}" must be a number param`
        )
      }
    }

    // Keyframe ease validation: non-last must have ease
    const tracks = collectKeyframeTracks(l, path)
    for (const { keyframes, fieldPath } of tracks) {
      errors.push(...validateKeyframeEases(keyframes, fieldPath))
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0] }
  }

  return { success: true, data }
}
