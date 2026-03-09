import { SproutUploadResponse } from '@shared/types/types'
import React from 'react'

interface Props {
  video: SproutUploadResponse
}

const VideoInfoTooltip: React.FC<Props> = ({ video }) => {
  const { title, duration, created_at, id, assets, embed_code } = video

  const thumbnail = assets?.poster_frames?.[0] ?? ''
  const url = `https://sproutvideo.com/videos/${id}`

  const formattedBlock = `<!-- VIDEO_INFO -->

**🎬 Video Title:** [${title}](${url})
**🕒 Duration:** ${Math.round(duration)} seconds
**📅 Uploaded:** ${new Date(created_at).toLocaleString()}

![Thumbnail](${thumbnail})

## Embed Code

\`\`\`html
${embed_code}
\`\`\`
`

  return (
    <pre className="text-muted-foreground font-mono text-xs whitespace-pre-wrap">
      {formattedBlock}
    </pre>
  )
}

export default VideoInfoTooltip
