import { extractVideoInfoBlock } from '@utils/extractVideoInfoBlock'
import { createNamespacedLogger } from '@utils/logger'
import { TrelloCard, updateCard } from '@utils/TrelloCards'
import { SproutUploadResponse } from '@utils/types'

const logger = createNamespacedLogger('useAppendVideoInfo')

export function useAppendVideoInfo(apiKey: string | null, token: string | null) {
  const applyVideoInfoToCard = async (card: TrelloCard, video: SproutUploadResponse) => {
    if (!apiKey || !token) throw new Error('API key or token is missing.')

    const existingBlock = extractVideoInfoBlock(card.desc)
    if (existingBlock) {
      logger.log('Video info already appended.')
      return
    }

    const formattedDate = new Date(video.created_at).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    const durationMin = Math.floor(video.duration / 60)
    const durationSec = video.duration % 60
    const duration = `${durationMin} min ${durationSec} sec`

    const thumbnail = video.assets.poster_frames[0]
    const videoUrl = `https://sproutvideo.com/videos/${video.id}`

    const markdownBlock = `
<!-- VIDEO_INFO -->
**Title**: [${video.title}](${videoUrl})  
**Duration**: ${duration}  
**Uploaded**: ${formattedDate}

![Thumbnail](${thumbnail})


## Embed Code

\`\`\`html
${video.embed_code}
\`\`\`


`.trim()

    const updatedDesc = `${card.desc.trim()}\n\n---\n\n${markdownBlock}`

    await updateCard(card.id, { desc: updatedDesc }, apiKey, token)
    logger.log('Video info block appended.')
  }

  return { applyVideoInfoToCard }
}
