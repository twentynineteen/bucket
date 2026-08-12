import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle
} from './alert-dialog'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from './dialog'

/**
 * These assert the overflow contract of the two dialog primitives, which #157
 * showed is load-bearing rather than cosmetic: with no cap and no scroll
 * container, a dialog taller than the viewport ran off both edges and its own
 * footer buttons became unreachable.
 *
 * jsdom has no layout engine, so these pin the CSS contract rather than measured
 * geometry. The geometry was verified in a real browser: uncapped, a 733px
 * dialog in a 591px viewport sat at top -71 / bottom 662 with
 * `overflow-y: visible` and nothing scrollable; capped, the same dialog fits and
 * its Cancel and Upload buttons scroll into reach.
 */
const tallContent = <div style={{ height: 4000 }}>tall</div>

describe('DialogContent overflow contract', () => {
  it('caps its height so it cannot outgrow the viewport', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tall dialog</DialogTitle>
          {tallContent}
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByRole('dialog').className).toContain('max-h-[85vh]')
  })

  it('scrolls its own content, so nothing is unreachable', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tall dialog</DialogTitle>
          {tallContent}
          <DialogFooter>
            <button>Confirm</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByRole('dialog').className).toContain('overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('lets a consumer override the cap', () => {
    // Three dialogs already set their own cap. tailwind-merge must drop the
    // default rather than emit both, or the winner depends on CSS source order.
    render(
      <Dialog open>
        <DialogContent className="max-h-[60vh]">
          <DialogTitle>Custom cap</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    const className = screen.getByRole('dialog').className
    expect(className).toContain('max-h-[60vh]')
    expect(className).not.toContain('max-h-[85vh]')
  })
})

describe('AlertDialogContent overflow contract', () => {
  it('caps and scrolls, so its confirm button stays reachable', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete everything?</AlertDialogTitle>
          {tallContent}
          <AlertDialogFooter>
            <AlertDialogAction>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    const className = screen.getByRole('alertdialog').className
    expect(className).toContain('max-h-[85vh]')
    expect(className).toContain('overflow-y-auto')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
