import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@components/ui/accordion'
import React from 'react'

interface Props {
  description: string
}

const DescriptionAccordionItem: React.FC<Props> = ({ description }) => {
  return (
    <AccordionItem value="description">
      <AccordionTrigger className="focus:outline-hidden focus-visible:outline-hidden">
        Description
      </AccordionTrigger>
      <AccordionContent>
        <div className="bg-muted max-h-48 w-[460px] overflow-auto rounded border p-3 text-sm break-words whitespace-pre-wrap focus:outline-hidden focus-visible:outline-hidden">
          {description.trim() || 'No description.'}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default DescriptionAccordionItem
