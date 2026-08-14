import { AlertTriangle } from 'lucide-react'
import { FootageData } from '@shared/types'
import React from 'react'

import { cn } from '@shared/utils'

interface Props {
  files: FootageData[]
  /**
   * Whether each recorded path was found on this machine (issue #168).
   * `undefined` while the probe has not answered, in which case nothing is
   * marked - a row must never claim a cause mid-check.
   */
  isPresent?: (path: string) => boolean | undefined
}

const FileList: React.FC<Props> = ({ files, isPresent }) => (
  <>
    <p>
      <span className="text-foreground font-medium">Files:</span> {files.length} file(s)
    </p>
    <ul className="ml-5 list-disc">
      {files.map((file) => {
        const notFound = isPresent?.(file.path) === false
        return (
          <li key={file.path}>
            <span
              className={cn(notFound && 'line-through')}
              title={notFound ? `Not found on this machine: ${file.path}` : file.path}
            >
              {file.name} (Camera {file.camera})
            </span>
            {notFound && (
              <AlertTriangle
                role="img"
                aria-label="Not found on this machine"
                className="text-warning ml-1.5 inline h-3.5 w-3.5 align-text-bottom"
              />
            )}
          </li>
        )
      })}
    </ul>
  </>
)

export default FileList
