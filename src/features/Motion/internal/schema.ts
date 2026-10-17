/**
 * Motion template schema and parser (issue #327)
 *
 * Zod schema for the template JSON format. Cross-field validations that depend
 * on sibling fields (colour-animated-fill clash, image-requires-particles, hold
 * range, etc.) are applied as named validator functions called after the base
 * schema parse, not via superRefine.
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
const pointKeyframeSchema = keyframeSchema(z.object({ x: z.number(), y: z.number() }))

/** Hex colour: #rrggbb or #rrggbbaa (6 or 8 hex digits). */
const hexColourSchema = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/,
    'must be a hex colour (#rrggbb or #rrggbbaa)'
  )

/** Hex colour keyframe value. */
const hexColourKeyframeSchema = keyframeSchema(hexColourSchema)

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
  fill: hexColourSchema,
  fillAnimation: z.array(hexColourKeyframeSchema).optional(),
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
  fill: hexColourSchema,
  fillAnimation: z.array(hexColourKeyframeSchema).optional(),
  radius: z.number().nonnegative()
})

const ellipseLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('ellipse'),
  radiusX: z.number().positive(),
  radiusY: z.number().positive(),
  fill: hexColourSchema,
  fillAnimation: z.array(hexColourKeyframeSchema).optional()
})

const pathLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('path'),
  d: z.string(),
  fill: hexColourSchema,
  fillAnimation: z.array(hexColourKeyframeSchema).optional()
})

const arcLayerSchema = z.object({
  ...layerBase,
  kind: z.literal('arc'),
  innerRadius: z.number().nonnegative(),
  outerRadius: z.number().positive(),
  sweep: z.array(numberKeyframeSchema).min(1),
  startAngle: z.array(numberKeyframeSchema).min(1),
  sweepFromParam: z.object({ param: z.string(), max: z.number().positive() }).optional(),
  fill: hexColourSchema,
  fillAnimation: z.array(hexColourKeyframeSchema).optional()
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
  baseFill: hexColourSchema,
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
    fill: hexColourSchema
  }),
  connector: z.object({
    dotSpacing: z.number().positive(),
    radius: z.number().positive(),
    fill: hexColourSchema
  }),
  label: z.object({
    font: fontSchema,
    fill: hexColourSchema,
    align: z.enum(['left', 'center', 'right']),
    offsetY: z.number()
  }),
  marker: z.object({
    ellipse: z.object({
      radiusX: z.number().positive(),
      radiusY: z.number().positive(),
      fill: hexColourSchema
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
        fill: hexColourSchema
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

/** Check whether a path uses only the supported absolute commands (M, L, Z). */
function isSupportedPath(d: string): boolean {
  const trimmed = d.trim()
  // Must end with Z
  if (!/Z\s*$/i.test(trimmed)) return false
  // Only M, L and Z are supported - both exporters parse these three commands.
  // H and V are excluded because neither exporter handles them.
  const commands = trimmed.replace(/[^a-zA-Z]/g, '')
  return /^[MLZ]+$/.test(commands)
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
// parseTemplate: early checks
// ---------------------------------------------------------------------------

/** Reject unsupported schemaVersion before the full Zod parse. */
function checkSchemaVersion(json: unknown): string | null {
  if (
    typeof json === 'object' &&
    json !== null &&
    'schemaVersion' in json &&
    (json as Record<string, unknown>).schemaVersion !== 1
  ) {
    return `unsupported schemaVersion: ${(json as Record<string, unknown>).schemaVersion}`
  }
  return null
}

/** Run the Zod base schema and return a formatted error or the parsed data. */
function parseBaseSchema(json: unknown): { data: MotionTemplate } | { error: string } {
  const baseResult = templateBaseSchema.safeParse(json)
  if (baseResult.success) {
    return { data: baseResult.data as unknown as MotionTemplate }
  }
  const issues = JSON.parse(baseResult.error.message) as {
    path: (string | number)[]
    message: string
  }[]
  const first = issues[0]
  const fieldPath = first?.path?.join('.') || ''
  const msg = first?.message || 'Invalid template'
  return { error: fieldPath ? `${fieldPath}: ${msg}` : msg }
}

// ---------------------------------------------------------------------------
// parseTemplate: cross-field validators
// ---------------------------------------------------------------------------

/** Validate timing markers. */
function validateTiming(data: MotionTemplate): string[] {
  if (data.inEnd > data.outStart) {
    return ['inEnd must be <= outStart']
  }
  return []
}

/** Validate primaryTextParam references a text param. */
function validatePrimaryTextParam(data: MotionTemplate): string[] {
  if (!data.primaryTextParam) return []
  const p = data.params[data.primaryTextParam]
  if (!p) {
    return [`primaryTextParam: param "${data.primaryTextParam}" does not exist`]
  }
  if (p.kind !== 'text') {
    return [`primaryTextParam: param "${data.primaryTextParam}" is not a text param`]
  }
  return []
}

/** Layer kinds that carry a fill and can be bound to a colour param. */
const FILL_BEARING_KINDS = new Set(['rect', 'ellipse', 'path', 'arc', 'text'])

/**
 * Resolve a bind path (e.g. "layers[1]" or "layers[0].children[2]") against the
 * layer tree and return the target layer, or null if the path is invalid.
 */
function resolveBindPath(
  layers: unknown[],
  bindPath: string
): Record<string, unknown> | null {
  // Parse "layers[i]" or "layers[i].children[j].children[k]" etc.
  const indexRe = /\[(\d+)\]/g
  const parts = bindPath.split('.')
  if (parts.length === 0 || !parts[0].startsWith('layers')) return null
  let current: unknown[] = layers
  for (const part of parts) {
    const match = indexRe.exec(part)
    indexRe.lastIndex = 0
    if (!match) return null
    const idx = parseInt(match[1], 10)
    if (idx < 0 || idx >= current.length) return null
    const node = current[idx] as Record<string, unknown>
    // If this is not the last part, descend into children
    if (part !== parts[parts.length - 1]) {
      if (!Array.isArray(node.children)) return null
      current = node.children as unknown[]
    } else {
      return node
    }
  }
  return null
}

/** Validate colour params are not bound to animated fills and that bind targets exist and are fill-bearing. */
function validateColourBindings(data: MotionTemplate): string[] {
  const errors: string[] = []
  const animFills = animatedFillPaths(data.layers as unknown as unknown[])
  for (const [paramId, paramDef] of Object.entries(data.params)) {
    if (paramDef.kind === 'colour') {
      for (const bindPath of paramDef.binds) {
        if (animFills.has(bindPath)) {
          errors.push(
            `params.${paramId}: colour param bound to an animated fill at ${bindPath}`
          )
          continue
        }
        // Validate that the bind path resolves to a fill-bearing primitive
        const target = resolveBindPath(data.layers as unknown as unknown[], bindPath)
        if (!target) {
          errors.push(
            `params.${paramId}: bind path "${bindPath}" does not resolve to a layer`
          )
          continue
        }
        const kind = target.kind as string
        if (!FILL_BEARING_KINDS.has(kind)) {
          errors.push(
            `params.${paramId}: bind path "${bindPath}" targets a ${kind} layer, which is not a fill-bearing primitive`
          )
        }
      }
    }
  }
  return errors
}

/**
 * Validate hold param range: the minimum hold must not push outStart before inEnd.
 * holdDelta = holdValue - holdDefault; outStart' = outStart + holdDelta.
 * At minimum: outStart + (min - default) >= inEnd.
 */
function validateHoldRange(data: MotionTemplate): string[] {
  const holdParam = Object.entries(data.params).find(([, def]) => def.kind === 'hold')
  if (!holdParam) return []
  const [, def] = holdParam
  if (def.kind !== 'hold') return []
  const minDelta = def.min - def.default
  if (data.outStart + minDelta < data.inEnd) {
    return [
      `hold param min ${def.min} would push outStart (${data.outStart + minDelta}) before inEnd (${data.inEnd})`
    ]
  }
  return []
}

/** Validate image params have a particles layer. */
function validateImageParamRequiresParticles(data: MotionTemplate): string[] {
  const hasImageParam = Object.values(data.params).some(p => p.kind === 'image')
  if (hasImageParam && !hasParticlesLayer(data.layers as unknown as unknown[])) {
    return ['image param requires at least one particles layer']
  }
  return []
}

/**
 * Validate that particle layers come after all vector layers (last in paint order).
 *
 * Both the preview and the video renderer draw all vector layers first, then all
 * particle layers. A particle layer placed before a vector layer would appear
 * above it in AE/Resolve but below it in the preview and video. Requiring
 * particles-last avoids the discrepancy.
 */
function validateParticlesLast(data: MotionTemplate): string[] {
  let seenParticle = false
  for (const layer of data.layers as unknown as Record<string, unknown>[]) {
    if (layer.kind === 'particles') {
      seenParticle = true
    } else if (seenParticle) {
      return [
        'particle layers must come after all vector layers (last in paint order), ' +
          'because the preview and video renderer draw particles on top of vectors'
      ]
    }
  }
  return []
}

/** Validate at most one hold param, and that min <= default <= max. */
function validateHoldParamConstraints(data: MotionTemplate): string[] {
  const errors: string[] = []
  const holdParams = Object.entries(data.params).filter(([, def]) => def.kind === 'hold')
  if (holdParams.length > 1) {
    errors.push(
      `at most one hold param is allowed, found ${holdParams.length}: ${holdParams.map(([id]) => id).join(', ')}`
    )
  }
  for (const [id, def] of holdParams) {
    if (def.kind !== 'hold') continue
    if (def.min > def.default || def.default > def.max) {
      errors.push(
        `params.${id}: hold param must satisfy min <= default <= max (got min=${def.min}, default=${def.default}, max=${def.max})`
      )
    }
  }
  return errors
}

/** Validate that stagger is not combined with fillAnimation on a text layer. */
function validateStaggerFillAnimation(data: MotionTemplate): string[] {
  const errors: string[] = []
  for (const { layer, path } of walkLayers(data.layers as unknown as unknown[])) {
    if (
      layer.kind === 'text' &&
      layer.stagger &&
      typeof layer.stagger === 'object' &&
      Array.isArray(layer.fillAnimation) &&
      (layer.fillAnimation as unknown[]).length > 0
    ) {
      errors.push(
        `${path}: stagger and fillAnimation cannot be combined on a text layer (stagger is per-character in the preview but uniform in AE)`
      )
    }
  }
  return errors
}

/** Validate that a param reference points to a param of the expected kind. */
function validateParamRef(
  params: MotionTemplate['params'],
  paramName: string,
  expectedKind: string,
  errorPrefix: string
): string[] {
  const p = params[paramName]
  if (!p) {
    return [`${errorPrefix}: param "${paramName}" does not exist`]
  }
  if (p.kind !== expectedKind) {
    return [`${errorPrefix}: param "${paramName}" must be a ${expectedKind} param`]
  }
  return []
}

/** Per-layer cross-field checks: closed paths, stagger, param refs, eases. */
function validateLayerCrossFields(
  layer: Record<string, unknown>,
  path: string,
  params: MotionTemplate['params']
): string[] {
  const errors: string[] = []

  if (layer.kind === 'path' && typeof layer.d === 'string' && !isSupportedPath(layer.d)) {
    errors.push(`${path}.d: path must use only absolute M, L commands and end with Z`)
  }
  if (layer.stagger && layer.kind !== 'text') {
    errors.push(`${path}.stagger: stagger is only allowed on text layers`)
  }
  if (layer.kind === 'series') {
    const series = layer.series as Record<string, unknown>
    errors.push(
      ...validateParamRef(
        params,
        series.param as string,
        'numberList',
        `${path}.series.param`
      )
    )
  }
  if (layer.counter && typeof layer.counter === 'object') {
    const counter = layer.counter as Record<string, unknown>
    errors.push(
      ...validateParamRef(
        params,
        counter.param as string,
        'number',
        `${path}.counter.param`
      )
    )
  }
  if (layer.kind === 'arc' && layer.sweepFromParam) {
    const sfp = layer.sweepFromParam as Record<string, unknown>
    errors.push(
      ...validateParamRef(
        params,
        sfp.param as string,
        'number',
        `${path}.sweepFromParam.param`
      )
    )
  }

  const tracks = collectKeyframeTracks(layer, path)
  for (const { keyframes, fieldPath } of tracks) {
    errors.push(...validateKeyframeEases(keyframes, fieldPath))
  }

  return errors
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
  const versionError = checkSchemaVersion(json)
  if (versionError) {
    return { success: false, error: versionError }
  }

  const baseResult = parseBaseSchema(json)
  if ('error' in baseResult) {
    return { success: false, error: baseResult.error }
  }

  const data = baseResult.data

  // Cross-field validations
  const errors: string[] = [
    ...validateTiming(data),
    ...validatePrimaryTextParam(data),
    ...validateColourBindings(data),
    ...validateImageParamRequiresParticles(data),
    ...validateHoldParamConstraints(data),
    ...validateHoldRange(data),
    ...validateParticlesLast(data),
    ...validateStaggerFillAnimation(data)
  ]

  // Per-layer checks
  for (const { layer, path } of walkLayers(data.layers as unknown as unknown[])) {
    errors.push(...validateLayerCrossFields(layer, path, data.params))
  }

  if (errors.length > 0) {
    return { success: false, error: errors[0] }
  }

  return { success: true, data }
}
