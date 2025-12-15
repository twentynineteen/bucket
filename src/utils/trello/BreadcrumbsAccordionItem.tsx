import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@components/ui/accordion'
import { Breadcrumb } from '@utils/types'
import React from 'react'

import { formatBreadcrumbDate } from '../breadcrumbsComparison'
import FileList from './FileList'
import KeyValueRow from './KeyValueRow'

interface Props {
  data: Breadcrumb
}

const BreadcrumbsAccordionItem: React.FC<Props> = ({ data }) => {
  if (!data) return null

  return (
    <AccordionItem value="breadcrumbs">
      <AccordionTrigger className="font-semibold">Breadcrumbs</AccordionTrigger>
      <AccordionContent>
        <div className="text-muted-foreground space-y-2 text-sm">
          {data.projectTitle && (
            <KeyValueRow label="Project Title" value={data.projectTitle} />
          )}
          {data.createdBy && (
            <KeyValueRow
              label="Created By"
              value={
                typeof data.createdBy === 'string'
                  ? data.createdBy
                  : data.createdBy?.data || 'Unknown User'
              }
            />
          )}
          {data.creationDateTime && (
            <KeyValueRow
              label="Created On"
              value={formatBreadcrumbDate(data.creationDateTime)}
            />
          )}
          {data.parentFolder && <KeyValueRow label="Folder" value={data.parentFolder} />}
          {data.files && <FileList files={data.files} />}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default BreadcrumbsAccordionItem
