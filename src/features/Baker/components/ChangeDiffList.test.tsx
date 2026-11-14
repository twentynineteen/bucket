/**
 * ChangeDiffList: per-file change rows. With `basePath` the rows read relative
 * to the project folder ("Footage/Camera 1/A001.MXF"), and the full path stays
 * in the row's `title`.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ChangeRow } from '../utils/changeRows'
import { ChangeCounts, ChangeDiffList } from './ChangeDiffList'

const row = (label: string, overrides: Partial<ChangeRow> = {}): ChangeRow => ({
  type: 'added',
  label,
  impact: 'high',
  ...overrides
})

const PROJECT = '/Volumes/Media/Client/Show'

describe('ChangeDiffList basePath', () => {
  it('strips the project folder from the front of each row label', () => {
    render(
      <ChangeDiffList
        basePath={PROJECT}
        rows={[row(`${PROJECT}/Footage/Camera 1/A001.MXF`)]}
      />
    )

    expect(screen.getByText('Footage/Camera 1/A001.MXF')).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(PROJECT))).not.toBeInTheDocument()
  })

  it('keeps the full path in the row title', () => {
    render(
      <ChangeDiffList
        basePath={PROJECT}
        rows={[row(`${PROJECT}/Footage/Camera 1/A001.MXF`)]}
      />
    )

    expect(screen.getByText('Footage/Camera 1/A001.MXF')).toHaveAttribute(
      'title',
      `${PROJECT}/Footage/Camera 1/A001.MXF`
    )
  })

  it('shows labels unchanged when no basePath is given', () => {
    render(<ChangeDiffList rows={[row(`${PROJECT}/Footage/A001.MXF`)]} />)

    expect(screen.getByText(`${PROJECT}/Footage/A001.MXF`)).toBeInTheDocument()
  })

  it('ignores a trailing slash on basePath', () => {
    render(
      <ChangeDiffList
        basePath={`${PROJECT}/`}
        rows={[row(`${PROJECT}/Footage/A001.MXF`)]}
      />
    )

    expect(screen.getByText('Footage/A001.MXF')).toBeInTheDocument()
  })

  it('handles Windows separators', () => {
    render(
      <ChangeDiffList
        basePath={'C:\\Media\\Show'}
        rows={[row('C:\\Media\\Show\\Footage\\A001.MXF')]}
      />
    )

    expect(screen.getByText('Footage\\A001.MXF')).toBeInTheDocument()
  })

  it('leaves a label alone when it is not inside the project folder', () => {
    render(
      <ChangeDiffList
        basePath={PROJECT}
        rows={[row('/Volumes/Other/Footage/A001.MXF')]}
      />
    )

    expect(screen.getByText('/Volumes/Other/Footage/A001.MXF')).toBeInTheDocument()
  })

  it('does not strip a sibling folder that only shares the same prefix', () => {
    render(
      <ChangeDiffList basePath={PROJECT} rows={[row(`${PROJECT}2/Footage/A001.MXF`)]} />
    )

    expect(screen.getByText(`${PROJECT}2/Footage/A001.MXF`)).toBeInTheDocument()
  })

  it('leaves a label that is not a path, such as a field name, alone', () => {
    render(<ChangeDiffList basePath={PROJECT} rows={[row('Number of cameras')]} />)

    expect(screen.getByText('Number of cameras')).toBeInTheDocument()
  })
})

describe('ChangeDiffList rows', () => {
  it('marks each row with its sign: + added, ~ modified, − removed', () => {
    render(
      <ChangeDiffList
        rows={[
          row('new.mxf', { type: 'added' }),
          row('edited.mxf', { type: 'modified' }),
          row('gone.mxf', { type: 'removed' })
        ]}
      />
    )

    expect(screen.getByLabelText('added')).toHaveTextContent('+')
    expect(screen.getByLabelText('modified')).toHaveTextContent('~')
    expect(screen.getByLabelText('removed')).toHaveTextContent('−')
  })

  it('colours a modified row with the readable warning text token', () => {
    render(<ChangeDiffList rows={[row('edited.mxf', { type: 'modified' })]} />)

    expect(screen.getByLabelText('modified')).toHaveClass('text-warning-text')
  })

  it('caps long lists and reveals the rest on "+ n more files"', async () => {
    const user = userEvent.setup()
    render(
      <ChangeDiffList
        cap={2}
        rows={[row('a.mxf'), row('b.mxf'), row('c.mxf'), row('d.mxf')]}
      />
    )

    expect(screen.queryByText('c.mxf')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ 2 more files…' }))

    expect(screen.getByText('c.mxf')).toBeInTheDocument()
    expect(screen.getByText('d.mxf')).toBeInTheDocument()
  })
})

describe('ChangeCounts', () => {
  it('shows only the counts that are above zero, with the readable warning token', () => {
    render(<ChangeCounts counts={{ added: 2, modified: 1, removed: 0 }} />)

    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByText('~1')).toHaveClass('text-warning-text')
    expect(screen.queryByText(/−/)).not.toBeInTheDocument()
  })
})
