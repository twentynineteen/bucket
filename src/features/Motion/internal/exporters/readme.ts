/**
 * README exporter (issue #331)
 *
 * Generates a README.md with install and run steps per selected target,
 * required fonts, image credits, and Premiere routes.
 */
import type { ExportInput, Layer, MotionTarget, MotionTemplate } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
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

function hasImageParam(template: MotionTemplate): boolean {
  return Object.values(template.params).some(def => def.kind === 'image')
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function aeSection(input: ExportInput): string {
  const lines: string[] = []
  lines.push('## After Effects')
  lines.push('')
  lines.push(`1. Open After Effects.`)
  lines.push(
    `2. Go to **File > Scripts > Run Script File** and select \`${input.template.id}.jsx\`.`
  )
  lines.push('3. The script creates the composition and all layers automatically.')
  lines.push('')

  if (input.mogrt || input.targets.includes('mogrt-via-ae')) {
    lines.push('### Motion Graphics Template (.mogrt)')
    lines.push('')
    lines.push(
      'The script also produces a `.mogrt` file next to itself. ' + 'For this to work:'
    )
    lines.push('')
    lines.push(
      '- **Allow Scripts to Write Files and Access Network** must be enabled ' +
        'in Edit > Preferences > Scripting & Expressions (or After Effects > ' +
        'Settings > Scripting & Expressions on macOS).'
    )
    lines.push(
      `- The \`.mogrt\` file (\`${input.template.id}.mogrt\`) is written next to the script.`
    )
    lines.push('')
  }

  return lines.join('\n')
}

function resolveSection(): string {
  const lines: string[] = []
  lines.push('## DaVinci Resolve')
  lines.push('')
  lines.push('Copy the `.setting` file to the Fusion Templates Titles folder:')
  lines.push('')
  lines.push(
    '- **macOS**: `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Templates/Edit/Titles/`'
  )
  lines.push(
    '- **Windows**: `%ProgramData%\\Blackmagic Design\\DaVinci Resolve\\Fusion\\Templates\\Edit\\Titles\\`'
  )
  lines.push('')
  lines.push(
    'The title then appears in the Effects Library under Titles. ' +
      'Drag it onto the timeline to use.'
  )
  lines.push('')
  return lines.join('\n')
}

function videoSection(input: ExportInput): string {
  const { width, height, fps } = input.format
  const lines: string[] = []
  lines.push('## Video')
  lines.push('')
  lines.push(
    `The \`.mov\` file is encoded as ProRes 4444 with alpha at ${width}×${height}, ${fps} fps. ` +
      'Import it directly into any editor that supports ProRes.'
  )
  lines.push('')
  return lines.join('\n')
}

function premiereSection(template: MotionTemplate): string {
  const lines: string[] = []
  lines.push('## Premiere Pro')
  lines.push('')

  const isParticle = templateHasParticles(template)

  if (!isParticle) {
    lines.push('Two routes to use this graphic in Premiere:')
    lines.push('')
    lines.push(
      '1. **Import the `.mogrt`**: Open Essential Graphics, click the "+" button, ' +
        'browse to the `.mogrt` file produced by the After Effects script. ' +
        'Drag it onto the timeline and edit text and colours in the Essential Graphics panel.'
    )
    lines.push(
      '2. **Place the `.mov`**: Import the video file directly. ' +
        'It has an alpha channel, so it layers transparently over other footage.'
    )
  } else {
    lines.push(
      'Import the `.mov` video file directly. ' +
        'It has an alpha channel, so it layers transparently over other footage.'
    )
  }

  lines.push('')
  return lines.join('\n')
}

function fontsSection(template: MotionTemplate): string {
  if (template.fonts.length === 0) return ''

  const lines: string[] = []
  lines.push('## Fonts')
  lines.push('')

  for (const font of template.fonts) {
    if (font === 'CabritoSemi-NorBol') {
      lines.push(
        '- **Cabrito Semi Norm Bold** (PostScript name: CabritoSemi-NorBol). ' +
          'Install this font on your system before running the scripts. ' +
          'If the font is missing, the After Effects script shows an alert ' +
          'listing the missing fonts and falls back to Arial.'
      )
    } else {
      lines.push(`- ${font}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

function creditsSection(template: MotionTemplate): string {
  if (!template.credits || template.credits.length === 0) return ''

  const lines: string[] = []
  lines.push('## Credits')
  lines.push('')

  for (const credit of template.credits) {
    lines.push(
      `- **${credit.title}** by ${credit.author} - [${credit.url}](${credit.url}) (${credit.licence})`
    )
  }

  lines.push('')
  return lines.join('\n')
}

function notesSection(notes: string[]): string {
  if (notes.length === 0) return ''

  const lines: string[] = []
  lines.push('## Notes')
  lines.push('')

  for (const note of notes) {
    lines.push(`- ${note}`)
  }

  lines.push('')
  return lines.join('\n')
}

function imageParamSection(template: MotionTemplate, input: ExportInput): string {
  if (!hasImageParam(template)) return ''

  // Check if user picked an image
  const hasPickedImage = Object.entries(template.params).some(([id, def]) => {
    if (def.kind !== 'image') return false
    const val = input.values[id]
    return val && typeof val === 'object' && 'pickedPath' in val
  })

  if (!hasPickedImage) return ''

  const lines: string[] = []
  lines.push(
    'The file `source.png` in this folder is the particle source image. ' +
      'Points are re-derived from it and the seed at runtime - ' +
      'the point list is not stored.'
  )
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the README.md Markdown for the given export input.
 * @param notes - exporter notes from other generators (e.g. Resolve Follower rounding)
 */
export function generateReadme(input: ExportInput, notes?: string[]): string {
  const { template, targets } = input
  const selectedTargets = new Set<MotionTarget>(targets)

  const sections: string[] = []
  sections.push(`# ${template.name}`)
  sections.push('')
  sections.push(template.description)
  sections.push('')

  // Target-specific install sections
  if (selectedTargets.has('ae') || selectedTargets.has('mogrt-via-ae')) {
    sections.push(aeSection(input))
  }

  if (selectedTargets.has('resolve')) {
    sections.push(resolveSection())
  }

  if (selectedTargets.has('video')) {
    sections.push(videoSection(input))
  }

  // Premiere always shown (uses mogrt or video)
  sections.push(premiereSection(template))

  // Fonts
  const fonts = fontsSection(template)
  if (fonts) sections.push(fonts)

  // Credits
  const credits = creditsSection(template)
  if (credits) sections.push(credits)

  // Notes
  const allNotes = [...(notes ?? [])]
  const imageNote = imageParamSection(template, input)
  if (imageNote) {
    // Add image note inline
    sections.push(imageNote)
  }
  const notesBlock = notesSection(allNotes)
  if (notesBlock) sections.push(notesBlock)

  return sections.join('\n')
}
