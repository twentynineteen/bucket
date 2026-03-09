export function extractVideoInfoBlock(description: string): string | null {
  const match = description.match(/<!-- VIDEO_INFO -->[\s\S]*?(?=\n---|\n<!--|$)/m)
  return match ? match[0] : null
}
