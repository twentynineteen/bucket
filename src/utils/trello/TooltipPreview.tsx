import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@components/ui/tooltip'
import React from 'react'

interface TooltipPreviewProps {
  trigger: React.ReactNode
  content: string | React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

const TooltipPreview: React.FC<TooltipPreviewProps> = ({
  trigger,
  content,
  side = 'top',
  align = 'start'
}) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="border-border text-muted-foreground max-h-[300px] max-w-[400px] overflow-auto rounded border bg-white p-3 font-mono text-xs whitespace-pre-wrap shadow-sm"
        >
          {typeof content === 'string' ? <pre>{content}</pre> : content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default TooltipPreview
