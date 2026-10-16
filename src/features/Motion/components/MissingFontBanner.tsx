/**
 * MissingFontBanner - Banner explaining that Cabrito is not installed (issue #336).
 */
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert'
import { Info } from 'lucide-react'
import React from 'react'

export interface MissingFontBannerProps {
  visible: boolean
}

const MissingFontBanner: React.FC<MissingFontBannerProps> = ({ visible }) => {
  if (!visible) return null

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Font not installed</AlertTitle>
      <AlertDescription>
        Cabrito Semi Norm Bold is not installed. Previews will use a system font as a
        fallback. Install <code>Cabrito.otf</code> in <code>~/Library/Fonts</code> for
        accurate previews.
      </AlertDescription>
    </Alert>
  )
}

export default MissingFontBanner
