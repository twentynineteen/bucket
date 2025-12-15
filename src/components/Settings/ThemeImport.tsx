/**
 * ThemeImport Component
 *
 * Future feature: Allow users to import custom theme JSON files.
 * Currently a placeholder/stub for the architecture.
 */

import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import React from 'react'

export function ThemeImport() {
  const [isImporting, setIsImporting] = React.useState(false)

  const handleImportClick = () => {
    setIsImporting(true)
    // TODO: Implement file picker and theme import logic
    alert('Custom theme import feature coming soon!')
    setIsImporting(false)
  }

  return (
    <div className="border-border mt-4 rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        <Upload className="h-4 w-4" />
        <h4 className="font-medium">Custom Themes</h4>
      </div>
      <p className="text-muted-foreground mb-3 text-sm">
        Import custom theme JSON files to add your own color schemes.
      </p>
      <Button
        onClick={handleImportClick}
        disabled={isImporting}
        variant="outline"
        size="sm"
      >
        {isImporting ? 'Importing...' : 'Import Theme'}
      </Button>
      <p className="text-muted-foreground mt-2 text-xs">
        Feature coming soon. Custom themes will be saved locally and persist across
        sessions.
      </p>
    </div>
  )
}
