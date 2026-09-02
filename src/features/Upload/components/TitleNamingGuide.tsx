/**
 * The Sprout title naming guide (issue #270)
 *
 * Split out of `UploadSprout` for the same reason the Kavanagh gate is: the
 * colon rule, the category picker, the templates and the advisory are one
 * cohesive thing, and folding them into the page's body would take it past the
 * complexity the repo lints for.
 *
 * The colon block is hard and always shown (a colon breaks the embed code). The
 * guide itself - picker, templates, advisory - is behind the "Show naming guide"
 * toggle. The advisory speaks as soon as a specific format is selected and the
 * title is non-blank, the prefilled filename included (#274): filenames here are
 * usually already dash-formatted, so gating on a manual edit hid the warning in
 * the one case that mattered - accepting a prefilled title that does not match.
 * It never blocks, because it can only judge shape, not correctness; colons
 * remain the sole hard block.
 */

import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Label } from '@shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import React from 'react'

import { useTitleNamingGuide } from '../hooks/useTitleNamingGuide'
import {
  NAMING_CATEGORIES,
  OTHER_CATEGORY_ID,
  hasColon,
  matchTitle,
  stripColons
} from '../internal/namingConventions'

export const TitleNamingGuide: React.FC<{
  /** The current title, whatever its source. */
  title: string
  /** Applies a repaired title (used by "Remove colons"). */
  onTitleChange: (next: string) => void
}> = ({ title, onTitleChange }) => {
  const { showGuide, setShowGuide, category, setCategory } = useTitleNamingGuide()

  const colon = hasColon(title)
  const selected = NAMING_CATEGORIES.find((c) => c.id === category)
  // Advisory shows as soon as a specific format is selected and the title is
  // non-blank - the prefilled title included (#274). Filenames here are usually
  // already dash-formatted, so gating on a manual edit hid the warning in the
  // one case that matters: accepting a prefilled title that does not match the
  // chosen format. Still advisory only; colons remain the sole hard block.
  const advisory =
    title.trim() !== '' && category !== OTHER_CATEGORY_ID
      ? matchTitle(title, category)
      : 'none'

  return (
    <div className="space-y-2">
      {/*
        The colon rule is hard and independent of the guide toggle (B3.4): a
        colon breaks the Sprout embed code, so the title cannot go up as it is.
      */}
      {colon && (
        <div className="text-destructive flex items-start gap-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1.5">
            <p>Colons break the embed code, so this title cannot be used.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTitleChange(stripColons(title))}
            >
              Remove colons
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="show-naming-guide"
          checked={showGuide}
          onCheckedChange={(checked) => setShowGuide(checked === true)}
        />
        <Label htmlFor="show-naming-guide" className="text-xs font-medium">
          Show naming guide
        </Label>
      </div>

      {showGuide && (
        <div className="border-border space-y-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="naming-category" className="text-xs">
              Format
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="naming-category" className="h-8 text-xs">
                <SelectValue placeholder="Choose a format" />
              </SelectTrigger>
              <SelectContent>
                {NAMING_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_CATEGORY_ID}>Other / not listed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="space-y-0.5">
              <p className="text-foreground text-xs font-medium">
                {selected.sproutTemplate}
              </p>
              <p className="text-muted-foreground text-xs">{selected.example}</p>
              {selected.trelloReference && (
                <p className="text-muted-foreground pt-1 text-xs">
                  Trello card: {selected.trelloReference}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No specific format - just keep colons out of the title.
            </p>
          )}

          {advisory === 'match' && selected && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Looks like the {selected.label} format.
            </p>
          )}
          {advisory === 'mismatch' && selected && (
            <p className="text-warning flex items-start gap-1.5 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Expected format: {selected.sproutTemplate}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
