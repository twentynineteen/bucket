import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@components/ui/accordion'
import React from 'react'

interface VideoInfoAccordionProps {
  title: string
  duration: string
  uploaded: string
  thumbnail?: string
  url: string
}

const VideoInfoAccordion: React.FC<VideoInfoAccordionProps> = ({
  title,
  duration,
  uploaded,
  thumbnail,
  url
}) => {
  return (
    <AccordionItem value="videoinfo">
      <AccordionTrigger className="font-semibold">Video Info</AccordionTrigger>
      <AccordionContent>
        <div className="text-muted-foreground space-y-2 text-sm">
          <p>
            <span className="text-foreground font-medium">Title:</span> {title}
          </p>
          <p>
            <span className="text-foreground font-medium">Duration:</span> {duration}
          </p>
          <p>
            <span className="text-foreground font-medium">Uploaded:</span> {uploaded}
          </p>
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Thumbnail"
              className="mt-2 max-w-xs rounded border"
            />
          )}
          <p>
            <span className="text-foreground font-medium">URL:</span>{' '}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline"
            >
              Open Video
            </a>
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default VideoInfoAccordion
