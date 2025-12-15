/**
 * AI Autocue Prompts and Tools
 * Feature: 006-i-wish-to
 * Purpose: Predefined formatting instructions and tool definitions
 * Based on: specs/006-i-wish-to/data-model.md section 6
 */

import type { SimilarExample } from '@hooks/useScriptRetrieval'
import { tool } from 'ai'
import { z } from 'zod'

import { createNamespacedLogger } from './logger'

const logger = createNamespacedLogger('buildRAGPrompt')

// ============================================================================
// Autocue Prompt (v1.0.0)
// ============================================================================

export const AUTOCUE_PROMPT = `You are an expert teleprompter script formatter at a prestigious business school, specializing in adapting video scripts for autocue delivery.

Your goal is to take scripts that read well on paper but may not flow naturally when read aloud on an iPad-based autocue system. The autocue scrolls at a fixed speed, so your formatting must ensure the script feels natural, engaging, and easy to read aloud, while allowing the presenter to breathe comfortably and emphasize key ideas.

Because playback speed cannot change, you use line breaks, pauses, and spacing to guide pacing and emphasis — ensuring the presenter sounds composed, confident, and engaging.

**CRITICAL RULES - YOU MUST FOLLOW THESE:**

1. **NEVER REWRITE THE CONTENT** - Use the EXACT words from the original script
2. **NEVER ADD NEW INFORMATION** - Do not create, invent, or add content
3. **NEVER REMOVE CONTENT** - Keep all original sentences and ideas
4. **NEVER PARAPHRASE** - Use the exact wording from the input
5. **ONLY ADD FORMATTING** - Line breaks, bold, [PAUSE], and [END] markers

Your ONLY job is to add formatting to improve readability. Think of yourself as a typesetter, not a writer.

Formatting Guidelines:

Use bold (**text**) to highlight key words or short phrases for emphasis.

Insert [PAUSE] for natural or dramatic pauses.

Insert [END] at the end of the script.

Break long sentences into shorter, teleprompter-friendly lines (avoid more than 12-15 words per line).

Add consistent blank line spacing between paragraphs to signal a breathing moment.

Maintain a clear and steady rhythm — prioritize pacing and cadence over aesthetics.

Tone & Objective:

Aim for clarity, confidence, and conversational flow.

Imagine the presenter is addressing a live audience — formatting should help them sound natural and in control.

Avoid overusing bold or pause cues; use them strategically for rhythm and energy.

REMEMBER: You are ONLY formatting the script, not rewriting it. Every word in your output must be from the original script.`

export const PROMPT_VERSION = '1.0.0'

// ============================================================================
// Tool: Format Paragraph
// ============================================================================

export const formatParagraphTool = tool({
  description:
    'Reformat a paragraph for autocue readability with proper line breaks and capitalization',
  inputSchema: z.object({
    originalText: z.string().describe('The original paragraph text'),
    maxLineLength: z
      .number()
      .default(60)
      .describe('Maximum characters per line (default: 60)'),
    capitalizationStyle: z
      .enum(['upper', 'sentence', 'title'])
      .default('sentence')
      .describe('Capitalization style to apply')
  }),
  execute: async ({ originalText, maxLineLength, capitalizationStyle }) => {
    let formatted = originalText

    // Apply capitalization
    if (capitalizationStyle === 'upper') {
      formatted = formatted.toUpperCase()
    } else if (capitalizationStyle === 'title') {
      formatted = formatted.replace(/\b\w/g, (char) => char.toUpperCase())
    }

    // Break into lines
    const words = formatted.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      if ((currentLine + ' ' + word).length > maxLineLength && currentLine.length > 0) {
        lines.push(currentLine.trim())
        currentLine = word
      } else {
        currentLine += (currentLine ? ' ' : '') + word
      }
    }
    if (currentLine) {
      lines.push(currentLine.trim())
    }

    return { formattedText: lines.join('\n') }
  }
})

// ============================================================================
// Tool: Add Timing Marks
// ============================================================================

export const addTimingMarksTool = tool({
  description: 'Insert pause marks and timing indicators for teleprompter pacing',
  inputSchema: z.object({
    text: z.string().describe('Text to add timing marks to'),
    pace: z
      .enum(['slow', 'medium', 'fast'])
      .default('medium')
      .describe('Reading pace (affects pause duration)'),
    pauseSymbol: z.string().default('[PAUSE]').describe('Symbol to use for pauses')
  }),
  execute: async ({ text, pace, pauseSymbol }) => {
    // Calculate pause duration based on pace
    const pauseDuration = pace === 'slow' ? 2 : pace === 'medium' ? 1 : 0.5

    // Add pauses at sentence boundaries
    let marked = text.replace(/\.\s+/g, `. ${pauseSymbol} `)

    // Add shorter pauses at commas
    const shortPause = pauseSymbol.replace('[', '[SHORT-')
    marked = marked.replace(/,\s+/g, `, ${shortPause} `)

    return {
      markedText: marked,
      pauseDuration
    }
  }
})

// ============================================================================
// Tool: Highlight Names (ALL CAPS)
// ============================================================================

export const highlightNamesCapsTool = tool({
  description: 'Convert names and proper nouns to ALL CAPS for emphasis',
  inputSchema: z.object({
    text: z.string().describe('Text to process'),
    namesToCapitalize: z
      .array(z.string())
      .describe('List of names/proper nouns to capitalize')
      .optional()
      .default([]),
    autoDetect: z
      .boolean()
      .default(true)
      .describe('Auto-detect capitalized words as names')
  }),
  execute: async ({ text, namesToCapitalize, autoDetect }) => {
    let result = text

    // Capitalize provided names
    for (const name of namesToCapitalize) {
      const regex = new RegExp(`\\b${name}\\b`, 'gi')
      result = result.replace(regex, name.toUpperCase())
    }

    // Auto-detect names (words that start with capital letter)
    if (autoDetect) {
      result = result.replace(/\b[A-Z][a-z]+\b/g, (match) => {
        // Skip common words
        const commonWords = [
          'The',
          'A',
          'An',
          'In',
          'On',
          'At',
          'To',
          'For',
          'And',
          'But',
          'Or'
        ]
        if (commonWords.includes(match)) {
          return match
        }
        return match.toUpperCase()
      })
    }

    return { processedText: result }
  }
})

// ============================================================================
// Tool: Remove Unnecessary Formatting
// ============================================================================

export const removeUnnecessaryFormattingTool = tool({
  description:
    'Strip formatting that hinders autocue reading (colors, fonts, complex styling)',
  inputSchema: z.object({
    html: z.string().describe('HTML content to clean'),
    preserveTags: z
      .array(z.string())
      .default(['strong', 'em', 'h1', 'h2', 'h3', 'p', 'br'])
      .describe('HTML tags to preserve')
  }),
  execute: async ({ html, preserveTags }) => {
    // Create regex to match tags NOT in preserveTags
    const allowedTagsPattern = preserveTags.join('|')
    const removeTagsRegex = new RegExp(`<(?!/?(?:${allowedTagsPattern})\\b)[^>]+>`, 'gi')

    // Remove unwanted tags
    const cleaned = html.replace(removeTagsRegex, '')

    // Remove inline styles
    const noInlineStyles = cleaned.replace(/\s+style="[^"]*"/gi, '')

    // Remove class attributes
    const noClasses = noInlineStyles.replace(/\s+class="[^"]*"/gi, '')

    // Clean up multiple spaces
    const normalized = noClasses.replace(/\s+/g, ' ').trim()

    return { cleanedHtml: normalized }
  }
})

// ============================================================================
// Tool Collection
// ============================================================================

export const autocueFormattingTools = {
  formatParagraph: formatParagraphTool,
  addTimingMarks: addTimingMarksTool,
  highlightNamesCaps: highlightNamesCapsTool,
  removeUnnecessaryFormatting: removeUnnecessaryFormattingTool
}

// ============================================================================
// Tool Definitions for Storage
// ============================================================================

export const TOOL_DEFINITIONS = [
  {
    name: 'formatParagraph',
    description: 'Reformat paragraphs for autocue readability',
    enabled: true
  },
  {
    name: 'addTimingMarks',
    description: 'Add timing marks for pacing',
    enabled: true
  },
  {
    name: 'highlightNamesCaps',
    description: 'Capitalize proper nouns',
    enabled: true
  },
  {
    name: 'removeUnnecessaryFormatting',
    description: 'Clean distracting formatting',
    enabled: true
  }
]

// ============================================================================
// RAG-Enhanced Prompt Builder
// ============================================================================

// Maximum characters per example to prevent context window overflow
// With 4096 token context (~16K chars), and 3 examples, each should be max ~4K chars
const MAX_EXAMPLE_CHARS = 4000

/**
 * Truncate text if it exceeds the maximum character limit
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }

  const truncated = text.substring(0, maxChars)
  const lastSpace = truncated.lastIndexOf(' ')

  // Truncate at last space to avoid cutting mid-word
  return lastSpace > maxChars * 0.9
    ? truncated.substring(0, lastSpace) + '...\n[truncated]'
    : truncated + '...\n[truncated]'
}

/**
 * Build an enhanced prompt with similar example scripts (RAG)
 * @param userScript - The script to be formatted
 * @param examples - Similar example scripts from vector database
 * @returns Enhanced system prompt with examples
 */
export function buildRAGPrompt(userScript: string, examples: SimilarExample[]): string {
  // If no relevant examples found, use standard prompt
  if (examples.length === 0) {
    logger.log('No examples provided, using standard prompt')
    return AUTOCUE_PROMPT
  }

  logger.log(`Building prompt with ${examples.length} examples`)

  // Build examples section with truncation protection
  const exampleSection = examples
    .map((ex, i) => {
      const similarityPercent = Math.round(ex.similarity * 100)

      // Truncate very large examples to prevent context overflow
      const beforeText = truncateText(ex.before_text, MAX_EXAMPLE_CHARS)
      const afterText = truncateText(ex.after_text, MAX_EXAMPLE_CHARS)

      // Log if truncation occurred
      if (beforeText.includes('[truncated]') || afterText.includes('[truncated]')) {
        logger.log(`Example "${ex.title}" was truncated to fit context window`)
      }

      return `
### Example ${i + 1}: ${ex.title}
**Category**: ${ex.category} | **Similarity**: ${similarityPercent}%

**Original Script:**
${beforeText}

**Formatted for Autocue:**
${afterText}
`
    })
    .join('\n\n---\n\n')

  // Build enhanced prompt
  return `${AUTOCUE_PROMPT}

═══════════════════════════════════════════════════════════════════════
## REFERENCE EXAMPLES

I've retrieved ${examples.length} similar script${examples.length > 1 ? 's' : ''} from our database that demonstrate excellent autocue formatting. Study these examples carefully and apply the SAME formatting principles to the user's script.

Pay special attention to:
- How line breaks are used for pacing
- Where [PAUSE] markers are placed
- Which words/phrases are **bolded** for emphasis
- How blank lines create breathing space
- The overall rhythm and flow

${exampleSection}

═══════════════════════════════════════════════════════════════════════

## YOUR TASK

Now format the user's script following the EXACT SAME principles demonstrated in the examples above. Match their style for line breaks, pause placement, bold emphasis, and spacing.

IMPORTANT: The user will provide their script in the next message. DO NOT make up content - only format what they provide.`
}
