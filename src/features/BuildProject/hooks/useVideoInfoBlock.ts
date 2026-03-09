import { useMemo } from 'react'

import type { VideoInfoData } from '../types'

// Re-export the type for backward compatibility
export type { VideoInfoData }

export function useVideoInfoBlock(description: string) {
  return useMemo(() => {
    // Match everything between <!-- VIDEO_INFO --> and the next ---
    const blockRegex = /<!-- VIDEO_INFO -->([\s\S]*?)(?=\n---|\n<!--|$)/m
    const blockMatch = description.match(blockRegex)

    if (!blockMatch) {
      return {
        videoInfoBlock: null,
        videoInfoData: null
      }
    }

    const block = blockMatch[0]

    // Use updated patterns that match the emoji-labeled fields
    const titleMatch = block.match(/\*\*🎬 Video Title:\*\* \[(.*?)\]\((.*?)\)/)
    const durationMatch = block.match(/\*\*🕒 Duration:\*\* (.+)/)
    const uploadedMatch = block.match(/\*\*📅 Uploaded:\*\* (.+)/)
    const thumbnailMatch = block.match(/!\[Thumbnail\]\((.*?)\)/)

    const data: VideoInfoData = {
      title: titleMatch?.[1] ?? '',
      url: titleMatch?.[2] ?? '',
      duration: durationMatch?.[1] ?? '',
      uploaded: uploadedMatch?.[1] ?? '',
      thumbnail: thumbnailMatch?.[1] ?? undefined
    }

    return {
      videoInfoBlock: block,
      videoInfoData: data
    }
  }, [description])
}
