import React from 'react'

interface Props {
  src: string
  alt?: string
}

const VideoThumbnail: React.FC<Props> = ({ src, alt = 'Thumbnail' }) => (
  <img src={src} alt={alt} className="mt-2 max-w-xs rounded border" />
)

export default VideoThumbnail
