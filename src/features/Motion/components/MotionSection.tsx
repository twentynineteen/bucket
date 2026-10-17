/**
 * Motion Settings Section (issue #333)
 *
 * Library folder picker and default format selector. Reads and writes
 * motion_prefs.json through Motion api.ts - nothing touches api_keys.json.
 *
 * Must NOT import internal/builtins.ts or internal/templates/ (L5.6) - the
 * Settings page lazy-loads this section and must not pull in the built-in
 * templates.
 */
import { Button } from '@shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { AlertTriangle } from 'lucide-react'
import React from 'react'
import { pickFolder } from '../api'
import { useMotionPrefs } from '../hooks/useMotionPrefs'
import type { MotionFormat } from '../types'

// ---------------------------------------------------------------------------
// Format options
// ---------------------------------------------------------------------------

interface FormatOption {
  label: string
  value: string
  format: MotionFormat
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    label: '3840×2160 @ 24 fps',
    value: '3840-2160-24',
    format: { width: 3840, height: 2160, fps: 24 }
  },
  {
    label: '3840×2160 @ 25 fps',
    value: '3840-2160-25',
    format: { width: 3840, height: 2160, fps: 25 }
  },
  {
    label: '3840×2160 @ 30 fps',
    value: '3840-2160-30',
    format: { width: 3840, height: 2160, fps: 30 }
  },
  {
    label: '3840×2160 @ 50 fps',
    value: '3840-2160-50',
    format: { width: 3840, height: 2160, fps: 50 }
  },
  {
    label: '3840×2160 @ 60 fps',
    value: '3840-2160-60',
    format: { width: 3840, height: 2160, fps: 60 }
  },
  {
    label: '1920×1080 @ 24 fps',
    value: '1920-1080-24',
    format: { width: 1920, height: 1080, fps: 24 }
  },
  {
    label: '1920×1080 @ 25 fps',
    value: '1920-1080-25',
    format: { width: 1920, height: 1080, fps: 25 }
  },
  {
    label: '1920×1080 @ 30 fps',
    value: '1920-1080-30',
    format: { width: 1920, height: 1080, fps: 30 }
  },
  {
    label: '1920×1080 @ 50 fps',
    value: '1920-1080-50',
    format: { width: 1920, height: 1080, fps: 50 }
  },
  {
    label: '1920×1080 @ 60 fps',
    value: '1920-1080-60',
    format: { width: 1920, height: 1080, fps: 60 }
  }
]

function formatToValue(f: MotionFormat): string {
  return `${f.width}-${f.height}-${f.fps}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MotionSection: React.FC = () => {
  const { prefs, isLoading, isError, updatePrefs } = useMotionPrefs()

  const chooseLibraryFolder = async () => {
    const folder = await pickFolder({ title: 'Choose library folder' })
    if (folder) {
      await updatePrefs({ libraryFolder: folder })
    }
  }

  const clearLibraryFolder = async () => {
    await updatePrefs({ libraryFolder: null })
  }

  const handleFormatChange = async (value: string) => {
    const option = FORMAT_OPTIONS.find(o => o.value === value)
    if (option) {
      await updatePrefs({ defaultFormat: option.format })
    }
  }

  if (isError) {
    return (
      <section
        id="motion"
        className="border-border scroll-mt-16 space-y-4 rounded-lg border p-6"
      >
        <div className="border-b pb-2">
          <h3 className="text-foreground text-lg font-semibold">Motion</h3>
        </div>
        <div role="alert" className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Motion settings could not be loaded.</span>
        </div>
      </section>
    )
  }

  const disabled = isLoading

  return (
    <section
      id="motion"
      className="border-border scroll-mt-16 space-y-4 rounded-lg border p-6"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">Motion</h3>
        <p className="text-muted-foreground text-sm">
          Motion graphics template library and default export settings
        </p>
      </div>

      {/* Library folder */}
      <div>
        <label className="mb-2 block text-sm font-medium">Library folder</label>
        <p className="text-muted-foreground mb-2 text-xs">
          A folder of user-made template JSON files. Top-level *.json only.
        </p>
        <div className="flex items-center gap-2">
          <Button
            onClick={chooseLibraryFolder}
            disabled={disabled}
            className="rounded border px-3 py-1"
          >
            Choose library folder
          </Button>
          {prefs.libraryFolder && (
            <Button
              onClick={clearLibraryFolder}
              disabled={disabled}
              variant="outline"
              className="rounded border px-3 py-1"
            >
              Clear library folder
            </Button>
          )}
        </div>
        {prefs.libraryFolder && (
          <p className="text-muted-foreground mt-1 text-sm">{prefs.libraryFolder}</p>
        )}
      </div>

      {/* Default format */}
      <div>
        <label htmlFor="motion-default-format" className="mb-2 block text-sm font-medium">
          Default format
        </label>
        <Select
          value={formatToValue(prefs.defaultFormat)}
          onValueChange={handleFormatChange}
          disabled={disabled}
        >
          <SelectTrigger
            id="motion-default-format"
            className="w-64"
            aria-label="Default format"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}

export default MotionSection
