/**
 * Claude prompt exporter (issue #331)
 *
 * Generates a self-contained Markdown prompt that can be pasted into Claude
 * to rebuild or modify the graphic. Sections: intent, template JSON, timing
 * and easing, format, and target constraints.
 *
 * The prompt embeds the **unexpanded** template (macro layers intact) and the
 * resolved parameter values as separate JSON blocks, so Claude receives the
 * authored template structure rather than the flattened output.
 *
 * Particle templates have their point lists replaced with a summary to keep
 * the prompt compact - the points are re-derived from the image and seed.
 */
import type {
  Ease,
  ExportInput,
  Keyframe,
  Layer,
  MotionTemplate,
  ParamValues,
  ParticlesLayer
} from '../../types'
import { deriveTargets } from '../resolve'
import { fence } from './fence'

// ---------------------------------------------------------------------------
// Value scrubbing
// ---------------------------------------------------------------------------

/**
 * Scrub param values for the prompt: replace image pickedPath values with
 * the relative name `source.png` so no absolute paths leak.
 */
function scrubValues(template: MotionTemplate, values: ParamValues): ParamValues {
  const result: ParamValues = { ...values }
  for (const [id, def] of Object.entries(template.params)) {
    if (def.kind !== 'image') continue
    const val = values[id]
    if (val && typeof val === 'object' && 'pickedPath' in val) {
      result[id] = { sourceName: 'source.png' }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Particle point summary
// ---------------------------------------------------------------------------

interface PointSummary {
  count: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  regions: Record<string, number>
  seed: number
}

/**
 * Summarise a particles layer's point list into a compact object.
 * Replaces the raw array so the prompt stays small.
 */
function summarisePoints(layer: ParticlesLayer): PointSummary {
  const pts = layer.points
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const regionCounts: Record<string, number> = {}

  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.region) {
      regionCounts[p.region] = (regionCounts[p.region] ?? 0) + 1
    }
  }

  return {
    count: pts.length,
    bounds: { minX, minY, maxX, maxY },
    regions: regionCounts,
    seed: layer.seed
  }
}

/**
 * Deep-clone the template, replacing particles layer points with summaries.
 */
function prepareTemplateForPrompt(template: MotionTemplate): unknown {
  function processLayer(layer: Layer): unknown {
    if (layer.kind === 'particles_DISABLED') {
      const summary = summarisePoints(layer)
      return { ...layer, points: summary }
    }
    if (layer.kind === 'group') {
      return { ...layer, children: layer.children.map(processLayer) }
    }
    return layer
  }

  return {
    ...template,
    layers: template.layers.map(processLayer)
  }
}

// ---------------------------------------------------------------------------
// Ease collection
// ---------------------------------------------------------------------------

function easeKey(e: Ease): string {
  return e.join(',')
}

interface EaseInfo {
  ease: Ease
  phases: Set<string>
}

/**
 * Collect every distinct ease used in the template, labelled by which phase
 * it appears in (entrance, hold, exit).
 */
function collectEases(
  template: MotionTemplate,
  inEnd: number,
  outStart: number
): EaseInfo[] {
  const map = new Map<string, EaseInfo>()

  function classifyPhase(t: number, tNext: number): string {
    if (tNext <= inEnd) return 'entrance'
    if (t >= outStart) return 'exit'
    return 'hold'
  }

  function processTrack<V>(kfs: Keyframe<V>[] | undefined): void {
    if (!kfs) return
    for (let i = 0; i < kfs.length - 1; i++) {
      const kf = kfs[i]
      if (!kf.ease) continue
      const key = easeKey(kf.ease)
      const phase = classifyPhase(kf.t, kfs[i + 1].t)
      const existing = map.get(key)
      if (existing) {
        existing.phases.add(phase)
      } else {
        map.set(key, { ease: kf.ease, phases: new Set([phase]) })
      }
    }
  }

  function processLayer(layer: Layer): void {
    processTrack(layer.position)
    processTrack(layer.scale)
    processTrack(layer.rotation)
    processTrack(layer.opacity)

    switch (layer.kind) {
      case 'text':
        processTrack(layer.fillAnimation)
        processTrack(layer.tracking)
        if (layer.counter) processTrack(layer.counter.progress)
        break
      case 'rect':
        processTrack(layer.fillAnimation)
        processTrack(layer.widthAnimation)
        processTrack(layer.heightAnimation)
        break
      case 'ellipse':
      case 'path':
        processTrack((layer as { fillAnimation?: Keyframe<string>[] }).fillAnimation)
        break
      case 'arc':
        processTrack(layer.sweep)
        processTrack(layer.startAngle)
        processTrack(layer.fillAnimation)
        break
      case 'group':
        layer.children.forEach(processLayer)
        break
    }
  }

  template.layers.forEach(processLayer)
  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Image reference
// ---------------------------------------------------------------------------

function describeImageSource(
  template: MotionTemplate,
  values: ParamValues
): string | null {
  // Find image params
  for (const [id, def] of Object.entries(template.params)) {
    if (def.kind !== 'image') continue
    const val = values[id]
    if (val && typeof val === 'object' && 'pickedPath' in val) {
      return 'source.png'
    }
    // Built-in image: use credit title if available
    if (template.credits && template.credits.length > 0) {
      return template.credits[0].title
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Template has particles
// ---------------------------------------------------------------------------

function templateHasParticles(template: MotionTemplate): boolean {
  function check(layers: Layer[]): boolean {
    for (const layer of layers) {
      if (layer.kind === 'particles') return true
      if (layer.kind === 'group' && check(layer.children)) return true
    }
    return false
  }
  return check(template.layers)
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function intentSection(template: MotionTemplate): string {
  const lines: string[] = []
  lines.push(`## Intent`)
  lines.push('')
  lines.push(`Recreate the "${template.name}" motion graphic.`)
  lines.push('')
  lines.push(template.description)
  lines.push('')
  lines.push(`Category: ${template.category}`)
  return lines.join('\n')
}

function templateSection(template: MotionTemplate, values: ParamValues): string {
  const lines: string[] = []
  lines.push(`## Template`)
  lines.push('')
  lines.push(
    'The template below is the authored source (macro layers intact). ' +
      'Values follow separately.'
  )
  lines.push('')
  const prepared = prepareTemplateForPrompt(template)
  lines.push(fence('json', JSON.stringify(prepared, null, 2)))
  lines.push('')
  lines.push('### Values')
  lines.push('')
  const scrubbed = scrubValues(template, values)
  lines.push(fence('json', JSON.stringify(scrubbed, null, 2)))

  const imageRef = describeImageSource(template, values)
  if (imageRef) {
    lines.push('')
    lines.push(
      `The particle source image is referenced as "${imageRef}". ` +
        'Points are re-derived from the image and the seed at runtime.'
    )
  }

  return lines.join('\n')
}

function timingSection(input: ExportInput): string {
  const { resolved, format } = input
  const { inEnd, outStart, duration } = resolved
  const { fps } = format

  const inDuration = inEnd
  const holdDuration = outStart - inEnd
  const outDuration = duration - outStart

  const toFrames = (s: number) => Math.round(s * fps)

  const lines: string[] = []
  lines.push(`## Timing and easing`)
  lines.push('')
  lines.push(
    `- In-duration: ${inDuration} s (${toFrames(inDuration)} frames at ${fps} fps)`
  )
  lines.push(
    `- Hold-duration: ${holdDuration} s (${toFrames(holdDuration)} frames at ${fps} fps)`
  )
  lines.push(
    `- Out-duration: ${outDuration} s (${toFrames(outDuration)} frames at ${fps} fps)`
  )
  lines.push(
    `- Total duration: ${duration} s (${toFrames(duration)} frames at ${fps} fps)`
  )
  lines.push('')

  const eases = collectEases(
    input.template,
    input.template.inEnd,
    input.template.outStart
  )
  if (eases.length > 0) {
    lines.push('### Easing curves')
    lines.push('')
    for (const info of eases) {
      const [x1, y1, x2, y2] = info.ease
      const phases = Array.from(info.phases).join(', ')
      lines.push(`- cubic-bezier(${x1}, ${y1}, ${x2}, ${y2}) - used in ${phases}`)
    }
  }

  return lines.join('\n')
}

function formatSection(input: ExportInput): string {
  const { width, height, fps } = input.format
  const lines: string[] = []
  lines.push(`## Format`)
  lines.push('')
  lines.push(`- Resolution: ${width}×${height}`)
  lines.push(`- Frame rate: ${fps} fps`)
  lines.push(`- Background: transparent (alpha channel preserved)`)
  return lines.join('\n')
}

function constraintsSection(template: MotionTemplate): string {
  const lines: string[] = []
  lines.push(`## Target constraints`)
  lines.push('')

  const isParticle = templateHasParticles(template)
  const targets = deriveTargets(template)

  if (!isParticle && targets.includes('ae')) {
    lines.push('### After Effects')
    lines.push('')
    lines.push(
      '- Output must be ES3-compatible (no `let`, `const`, arrow functions, template literals).'
    )
    lines.push('- ASCII-only: emit every non-ASCII character as `\\uXXXX`.')
    lines.push('- Do not use the `JSON` global (unavailable in ES3 ExtendScript).')
    lines.push('- Groups become precomps, not nulls.')
    lines.push('- Wrap in `beginUndoGroup` / `endUndoGroup`.')
    lines.push('')
  }

  if (!isParticle && targets.includes('resolve')) {
    lines.push('### DaVinci Resolve')
    lines.push('')
    lines.push('- Output is a Fusion macro (Lua table text).')
    lines.push('- Works in both Resolve Free and Studio.')
    lines.push(
      '- No scripting API is available - values are baked in, text and colour exposed as InstanceInputs.'
    )
    lines.push('')
  }

  lines.push('### Video')
  lines.push('')
  lines.push(
    '- ProRes 4444 with alpha (`prores_ks -profile:v 4444 -pix_fmt yuva444p10le`).'
  )
  lines.push('')

  lines.push('### v1 exclusions')
  lines.push('')
  lines.push('The following are out of scope for v1 templates:')
  lines.push('')
  lines.push('- blur and glow effects')
  lines.push('- 3D transforms')
  lines.push('- masks')
  lines.push(
    '- Author-written expressions (generated expressions for stagger are allowed)'
  )
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the Claude prompt Markdown for the given export input.
 * The prompt is self-contained: it references no local file path and no
 * other exported file. It is deterministic (no timestamps).
 */
export function generatePrompt(input: ExportInput): string {
  const { template, resolved } = input
  const sections = [
    `# ${template.name}`,
    '',
    intentSection(template),
    '',
    templateSection(template, resolved.values),
    '',
    timingSection(input),
    '',
    formatSection(input),
    '',
    constraintsSection(template)
  ]

  return sections.join('\n')
}
