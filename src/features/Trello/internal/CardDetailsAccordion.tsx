import { Accordion } from '@shared/ui/accordion'
import { type VideoInfoData } from '@features/BuildProject'
import { Breadcrumb } from '@shared/types'
import React from 'react'

import BreadcrumbsAccordionItem from './BreadcrumbsAccordionItem'
import DescriptionAccordionItem from './DescriptionAccordionItem'
import VideoInfoAccordionItem from './VideoInfoAccordionItem'

interface Props {
  description: string
  breadcrumbsData?: Breadcrumb
  breadcrumbsBlock?: string
  videoInfoBlock?: string
  videoInfoData?: VideoInfoData | null
}

const CardDetailsAccordion: React.FC<Props> = ({
  description,
  breadcrumbsData,
  breadcrumbsBlock,
  videoInfoBlock,
  videoInfoData
}) => {
  return (
    <Accordion type="single" collapsible className="w-full">
      <DescriptionAccordionItem description={description} />
      {breadcrumbsBlock && <BreadcrumbsAccordionItem data={breadcrumbsData} />}
      {videoInfoBlock && videoInfoData && <VideoInfoAccordionItem data={videoInfoData} />}
    </Accordion>
  )
}

export default CardDetailsAccordion
