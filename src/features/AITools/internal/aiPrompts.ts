/**
 * AI Autocue Prompts and Tools
 * Feature: 006-i-wish-to
 * Purpose: Predefined formatting instructions and tool definitions
 * Based on: specs/006-i-wish-to/data-model.md section 6
 */

import { createNamespacedLogger } from '@shared/utils'
import type { SimilarExample } from '../types'

const logger = createNamespacedLogger('buildRAGPrompt')

// ============================================================================
// Autocue Prompt (v1.0.0)
// ============================================================================

const AUTOCUE_PROMPT = `You are an expert teleprompter script formatter at a prestigious business school, specializing in adapting video scripts for autocue delivery.

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
