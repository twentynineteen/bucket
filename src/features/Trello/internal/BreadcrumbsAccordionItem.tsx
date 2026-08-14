import { AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion'
import { AlertTriangle } from 'lucide-react'
import { Breadcrumb } from '@shared/types'
import React, { useMemo } from 'react'

import { cn, formatBreadcrumbDate } from '@shared/utils'
import { useVerifiedPaths } from '../hooks/useVerifiedPaths'
import FileList from './FileList'
import KeyValueRow from './KeyValueRow'

interface Props {
  data: Breadcrumb
}

const BreadcrumbsAccordionItem: React.FC<Props> = ({ data }) => {
  // Hooks must run unconditionally, so the early return below sits after them.
  const files = data?.files
  const parentFolder = data?.parentFolder

  // The folder and every recorded file path go to one batched probe (issue
  // #168). A card can record hundreds of footage paths, so one call per row
  // would be one IPC message per row.
  const probed = useMemo(
    () => [...(parentFolder ? [parentFolder] : []), ...(files ?? []).map((f) => f.path)],
    [parentFolder, files]
  )
  const { isPresent } = useVerifiedPaths(probed)

  if (!data) return null

  const folderNotFound = parentFolder ? isPresent(parentFolder) === false : false

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
          {parentFolder && (
            /*
              Labelled "as recorded" rather than presented as current state.
              These breadcrumbs were parsed out of a card description and were
              authored on whichever machine baked the project, so the folder is
              a record of where the footage was, not a claim about this machine.
              Matches the `**Location (as recorded):**` line the card is written
              with in Baker/hooks/useAppendBreadcrumbs.ts.
            */
            <KeyValueRow
              label="Folder (as recorded)"
              value={
                <>
                  <span className={cn(folderNotFound && 'line-through')}>
                    {parentFolder}
                  </span>
                  {folderNotFound && (
                    <>
                      <AlertTriangle
                        role="img"
                        aria-label="Not found on this machine"
                        className="text-warning mx-1.5 inline h-3.5 w-3.5 align-text-bottom"
                      />
                      <span className="text-warning">not found on this machine</span>
                    </>
                  )}
                </>
              }
            />
          )}
          {files && <FileList files={files} isPresent={isPresent} />}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default BreadcrumbsAccordionItem
