/**
 * Motion template schema and parser (issue #327)
 *
 * Zod schema for the template JSON format. Cross-field validations that depend
 * on sibling fields (colour-animated-fill clash, image-requires-particles, hold
 * range, etc.) are applied as named validator functions called after the base
 * schema parse, not via superRefine.
 */
import { z } from 'zod'
import type {
  ArcLayer,
  EllipseLayer,
  Layer,
  MotionTemplate,
  PathLayer,
  RectLayer,
  TextLayer
} from '../types'
import { parseBindPath, resolveBindPath } from './bindPath'

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

/**
 * Param ids must be safe identifiers: start with a letter or underscore,
 * then letters, digits or underscores only. This prevents code injection
 * when param ids are emitted as Lua table keys in the Fusion .setting
 * exporter or as JS identifiers in the AE .jsx exporter.
 */
const SAFE_PARAM_ID_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const paramIdKeySchema = z
  .string()
  .regex(
    SAFE_PARAM_ID_RE,
    'param id must be a safe identifier (letters, digits, underscores; cannot start with a digit)'
  )

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
  params: z.record(paramIdKeySchema, paramDefSchema),
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

/**
 * Every keyframe-track field name across the Layer union.
 *
 * This typed mapping uses `satisfies` to ensure that every leaf layer kind
 * is accounted for. Adding a new layer kind without updating this map is
 * a compile error. Adding a new animated field to an existing kind is not
 * caught by the type - it only requires the value to be *some* key of
 * *some* layer type, not every keyframe field of that specific kind.
 *
 * Groups, particles and series are not listed because they carry no
 * kind-specific animated fields (groups recurse, particles have none,
 * series are expanded before validation).
 */
const KEYFRAME_TRACK_FIELDS = {
  text: ['fillAnimation', 'tracking'] as const,
  rect: ['fillAnimation', 'widthAnimation', 'heightAnimation'] as const,
  ellipse: ['fillAnimation'] as const,
  path: ['fillAnimation'] as const,
  arc: ['sweep', 'startAngle', 'fillAnimation'] as const
} satisfies Record<
  Exclude<Layer['kind'], 'group' | 'particles' | 'series'>,
  readonly (
    | keyof TextLayer
    | keyof RectLayer
    | keyof EllipseLayer
    | keyof PathLayer
    | keyof ArcLayer
  )[]
>

/** Fields common to every layer kind. */
const BASE_TRACK_FIELDS = ['position', 'scale', 'rotation', 'opacity'] as const

/** Collect all keyframe tracks in a layer for ease validation. */
function collectKeyframeTracks(
  layer: Record<string, unknown>,
  path: string
): { keyframes: { t: number; ease?: unknown }[]; fieldPath: string }[] {
  const tracks: { keyframes: { t: number; ease?: unknown }[]; fieldPath: string }[] = []

  // Base fields present on every layer kind
  for (const field of BASE_TRACK_FIELDS) {
    const val = layer[field]
    if (Array.isArray(val) && val.length > 0) {
      tracks.push({ keyframes: val, fieldPath: `${path}.${field}` })
    }
  }

  // Kind-specific fields
  const kind = layer.kind as string
  if (kind in KEYFRAME_TRACK_FIELDS) {
    const fields = KEYFRAME_TRACK_FIELDS[kind as keyof typeof KEYFRAME_TRACK_FIELDS]
    for (const field of fields) {
      const val = layer[field as string]
      if (Array.isArray(val) && val.length > 0) {
        tracks.push({ keyframes: val, fieldPath: `${path}.${field}` })
      }
    }
  }

  // Counter progress (text layers only)
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

/**
 * Layer kinds that carry a fill and can be bound to a colour param.
 *
 * Typed as ReadonlySet<string>, so there is no compile-time coupling to
 * the Layer union. A new fill-bearing kind added without updating this
 * set will fail loudly at runtime (the bind validator rejects it), but
 * will not be caught at compile time. The set is intentionally smaller
 * than the full kind union - group, particles and series do not carry
 * a bindable fill.
 */
const FILL_BEARING_KINDS: ReadonlySet<string> = new Set<string>([
  'rect',
  'ellipse',
  'path',
  'arc',
  'text'
])

/** Validate colour params are not bound to animated fills and that bind targets exist and are fill-bearing. */
function validateColourBindings(data: MotionTemplate): string[] {
  const errors: string[] = []
  const animFills = animatedFillPaths(data.layers as unknown as unknown[])
  for (const [paramId, paramDef] of Object.entries(data.params)) {
    if (paramDef.kind === 'colour') {
      for (const bindPath of paramDef.binds) {
        // Validate the path grammar before checking anything else
        if (!parseBindPath(bindPath)) {
          errors.push(
            `params.${paramId}: bind path "${bindPath}" does not resolve to a layer`
          )
          continue
        }
        if (animFills.has(bindPath)) {
          errors.push(
            `params.${paramId}: colour param bound to an animated fill at ${bindPath}`
          )
          continue
        }
        // Validate that the bind path resolves to a fill-bearing primitive
        const target = resolveBindPath(
          data.layers as unknown as { children?: unknown }[],
          bindPath
        )
        if (!target) {
          errors.push(
            `params.${paramId}: bind path "${bindPath}" does not resolve to a layer`
          )
          continue
        }
        const kind = (target as Record<string, unknown>).kind as string
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

/**
 * Validate image param cross-references:
 * - Every particles layer's `imageParam` must name an existing param of kind `image`.
 * - Every image param must be referenced by exactly one particles layer.
 * - An image param without a particles layer is rejected.
 */
function validateImageParamRefs(data: MotionTemplate): string[] {
  const errors: string[] = []
  const imageParamIds = new Set(
    Object.entries(data.params)
      .filter(([, p]) => p.kind === 'image')
      .map(([id]) => id)
  )

  // Collect which image params are referenced and validate each reference
  const referenced = new Map<string, number>()
  for (const { layer, path } of walkLayers(data.layers as unknown as unknown[])) {
    if (layer.kind === 'particles' && typeof layer.imageParam === 'string') {
      const ref = layer.imageParam as string
      errors.push(...validateParamRef(data.params, ref, 'image', `${path}.imageParam`))
      referenced.set(ref, (referenced.get(ref) ?? 0) + 1)
    }
  }

  // Every image param must be referenced by exactly one particles layer
  for (const id of imageParamIds) {
    const count = referenced.get(id) ?? 0
    if (count === 0) {
      errors.push(
        `params.${id}: image param is not referenced by any particles layer's imageParam`
      )
    } else if (count > 1) {
      errors.push(
        `params.${id}: image param is referenced by ${count} particles layers (expected exactly one)`
      )
    }
  }

  return errors
}

/**
 * Validate that particle layers come after all vector layers in flattened
 * paint order (walking into groups).
 *
 * Both the preview and the video renderer draw all vector layers first, then
 * all particle layers. A particle layer placed before a vector layer - even
 * when the particle is inside a group - would appear above the vector in
 * AE/Resolve but below it in the preview and video. Requiring particles-last
 * in the flattened order avoids the discrepancy.
 */
function validateParticlesLast(data: MotionTemplate): string[] {
  // Flatten the tree into paint order: groups contribute their children
  // in order, recursively, so a particles layer nested in a group still
  // counts as appearing at that position in the sequence.
  let seenParticle = false
  function walk(layers: unknown[]): string | null {
    for (const raw of layers) {
      const layer = raw as Record<string, unknown>
      if (layer.kind === 'group' && Array.isArray(layer.children)) {
        const err = walk(layer.children as unknown[])
        if (err) return err
      } else if (layer.kind === 'particles') {
        seenParticle = true
      } else if (seenParticle) {
        return (
          'particle layers must come after all vector layers (last in paint order), ' +
          'because the preview and video renderer draw particles on top of vectors'
        )
      }
    }
    return null
  }
  const err = walk(data.layers as unknown as unknown[])
  return err ? [err] : []
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
    ...validateImageParamRefs(data),
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
