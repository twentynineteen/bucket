import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@components/ui/accordion'
import { VideoInfoData } from '@hooks/useVideoInfoBlock'
import React from 'react'

import KeyValueRow from './KeyValueRow'
import VideoThumbnail from './VideoThumbnail'

interface Props {
  data: VideoInfoData
}

const VideoInfoAccordionItem: React.FC<Props> = ({ data }) => {
  return (
    <AccordionItem value="videoinfo">
      <AccordionTrigger className="font-semibold">Video Info</AccordionTrigger>
      <AccordionContent>
        <div className="text-muted-foreground space-y-2 text-sm">
          <KeyValueRow label="Title" value={data.title} />
          <KeyValueRow label="Duration" value={data.duration} />
          <KeyValueRow label="Uploaded" value={data.uploaded} />
          {data.thumbnail && <VideoThumbnail src={data.thumbnail} />}
          <KeyValueRow
            label="URL"
            value={
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Open Video
              </a>
            }
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default VideoInfoAccordionItem
