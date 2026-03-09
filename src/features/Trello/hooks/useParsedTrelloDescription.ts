export function useParsedTrelloDescription(raw: string) {
  const breadcrumbRegex = /```json\n\/\/ BREADCRUMBS\n([\s\S]*?)```/m
  const videoInfoRegex = /```json\n\/\/ VIDEO_INFO\n([\s\S]*?)```/m

  const breadcrumbMatch = raw.match(breadcrumbRegex)
  const videoMatch = raw.match(videoInfoRegex)

  const breadcrumbsData = breadcrumbMatch ? JSON.parse(breadcrumbMatch[1]) : null
  const breadcrumbsBlock = breadcrumbMatch?.[0] ?? ''
  const videoInfoBlock = videoMatch?.[0] ?? ''

  let cleaned = raw
  if (breadcrumbsBlock) cleaned = cleaned.replace(breadcrumbsBlock, '')
  if (videoInfoBlock) cleaned = cleaned.replace(videoInfoBlock, '')

  return {
    mainDescription: cleaned.trim(),
    breadcrumbsData,
    breadcrumbsBlock,
    videoInfoBlock
  }
}
