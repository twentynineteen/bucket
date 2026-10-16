/**
 * PreviewStage - dark neutral checkerboard backdrop for motion previews
 * (issue #336).
 *
 * Broadcast graphics are designed over footage, so the preview must always
 * sit on a dark stage regardless of the app theme. Hard-coded dark colours
 * (#1c1c1c / #262626, 12px squares) are intentional here - theme tokens
 * would make the stage light in Light theme, hiding white-on-transparent
 * graphics.
 *
 * Exported for #337 to reuse via direct import (not through the barrel).
 */
import React from 'react'

export interface PreviewStageProps {
  children: React.ReactNode
}

const PreviewStage: React.FC<PreviewStageProps> = ({ children }) => {
  return (
    <div
      className="preview-stage relative aspect-video overflow-hidden rounded-t-xl"
      style={{
        // Hard-coded dark checkerboard - theme tokens don't apply here
        // because broadcast graphics are white-on-transparent and must
        // always sit on a dark stage.
        backgroundImage: [
          'linear-gradient(45deg, #262626 25%, transparent 25%)',
          'linear-gradient(-45deg, #262626 25%, transparent 25%)',
          'linear-gradient(45deg, transparent 75%, #262626 75%)',
          'linear-gradient(-45deg, transparent 75%, #262626 75%)'
        ].join(', '),
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
        backgroundColor: '#1c1c1c'
      }}
    >
      {children}
    </div>
  )
}

export default PreviewStage
