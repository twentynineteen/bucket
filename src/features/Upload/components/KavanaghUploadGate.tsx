/**
 * The Kavanagh gate's own surface in the Sprout upload flow (issue #180, B9)
 *
 * Split out of `UploadSprout` rather than inlined: the opt-in, the two verdict
 * banners and the override dialog are one cohesive thing, and folding them into
 * the page's body took it past the complexity the repo lints for.
 *
 * The policy these render lives in `useKavanaghForUpload`. Everything here is
 * presentation, which is why a warning and a failure look as different as they
 * do - a warning is information, a failure is a decision (D14).
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import { Checkbox } from '@shared/ui/checkbox'
import { Label } from '@shared/ui/label'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import React from 'react'

import type { UseKavanaghForUploadResult } from '../hooks/useKavanaghForUpload'

/** The opt-in, and whatever the last run concluded. */
export const KavanaghGateControls: React.FC<{
  kavanagh: UseKavanaghForUploadResult
  uploading: boolean
}> = ({ kavanagh, uploading }) => (
  <>
    {/*
      Opt-in per video and off until asked for (D13): a check costs a full
      decode pass, and not every upload needs one.
    */}
    <div className="mb-4 flex items-start gap-2">
      <Checkbox
        id="kavanagh-before-upload"
        checked={kavanagh.enabled}
        onCheckedChange={(checked) => kavanagh.setEnabled(checked === true)}
        disabled={uploading || kavanagh.checking}
      />
      <div className="grid gap-0.5 leading-none">
        <Label
          htmlFor="kavanagh-before-upload"
          className="text-sm leading-none font-medium"
        >
          Check with Kavanagh before uploading
        </Label>
        <p className="text-muted-foreground text-xs">
          {kavanagh.available
            ? 'Checks the watermark and the closing sting first. A failure asks before uploading.'
            : (kavanagh.unavailableReason ?? 'Kavanagh cannot run at the moment.')}
        </p>
      </div>
    </div>

    {/*
      A warning is shown but never blocks (D14). Blocking on an out-of-date
      references folder would teach people to click through the override, which
      costs more than it saves.
    */}
    {kavanagh.report?.verdict === 'warning' && (
      <div
        role="status"
        className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
      >
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-amber-500"
          aria-hidden="true"
        />
        <div className="text-foreground">
          <p className="font-medium">Uploaded with a warning.</p>
          <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
            {kavanagh.report.problemMessages.map((problem, index) => (
              <li key={`${index}-${problem.slice(0, 24)}`}>{problem}</li>
            ))}
          </ul>
        </div>
      </div>
    )}

    {kavanagh.report?.verdict === 'pass' && !uploading && (
      <p className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
        <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden="true" />
        Kavanagh passed this render.
      </p>
    )}
  </>
)

/**
 * The confirm standing between a failed render and Sprout.
 *
 * An AlertDialog rather than a toast or a disabled button: it is the repo's
 * convention for a destructive confirm, and publishing a render that failed its
 * checks is exactly that.
 */
export const KavanaghBlockDialog: React.FC<{
  kavanagh: UseKavanaghForUploadResult
  onOverride: () => void
}> = ({ kavanagh, onOverride }) => (
  <AlertDialog open={kavanagh.block !== null}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {kavanagh.block?.error
            ? 'This render was not checked'
            : 'This render failed its checks'}
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2">
            <p>
              {kavanagh.block?.error
                ? kavanagh.block.error.message
                : 'Kavanagh found the following. Uploading anyway publishes it to Sprout as it is.'}
            </p>
            {kavanagh.block?.report && (
              <ul className="space-y-1 text-xs">
                {kavanagh.block.report.problemMessages.map((problem, index) => (
                  <li key={`${index}-${problem.slice(0, 24)}`}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={kavanagh.dismiss}>Do not upload</AlertDialogCancel>
        <AlertDialogAction onClick={onOverride}>Upload anyway</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
