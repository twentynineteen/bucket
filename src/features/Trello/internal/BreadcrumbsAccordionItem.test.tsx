/**
 * BreadcrumbsAccordionItem tests - issue #168, area B5
 *
 * The breadcrumbs shown here are parsed out of a Trello card description, so
 * they were authored on whichever machine baked the project. Rendering
 * `data.parentFolder` behind a bare truthiness gate presented someone else's
 * filesystem as this machine's current state.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@testing-library/jest-dom'

import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Accordion } from '@shared/ui/accordion'
import type { Breadcrumb } from '@shared/types'
import * as trelloApi from '../api'
import BreadcrumbsAccordionItem from './BreadcrumbsAccordionItem'

vi.mock('../api')

const NOT_FOUND_LABEL = 'Not found on this machine'

const RECORDED_FOLDER = '/Volumes/Archive/Shoots'
const FILE_A = `${RECORDED_FOLDER}/Project A/Footage/A001.mov`
const FILE_B = `${RECORDED_FOLDER}/Project A/Footage/A002.mov`

const data: Breadcrumb = {
  projectTitle: 'Project A',
  numberOfCameras: 1,
  parentFolder: RECORDED_FOLDER,
  createdBy: 'Someone Else',
  creationDateTime: '2026-01-01T00:00:00Z',
  files: [
    { camera: 1, name: 'A001.mov', path: FILE_A },
    { camera: 1, name: 'A002.mov', path: FILE_B }
  ]
}

const renderItem = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return render(
    <QueryClientProvider client={client}>
      <Accordion type="single" defaultValue="breadcrumbs" collapsible>
        <BreadcrumbsAccordionItem data={data} />
      </Accordion>
    </QueryClientProvider>
  )
}

const answerProbe = (present: (path: string) => boolean) => {
  vi.mocked(trelloApi.pathsExist).mockImplementation(async (paths: string[]) =>
    paths.map(present)
  )
}

beforeEach(() => {
  answerProbe(() => true)
})

describe('B5 - Trello card breadcrumbs', () => {
  it('B5.1 labels the folder as recorded rather than as current state', async () => {
    renderItem()

    expect(await screen.findByText('Folder (as recorded):')).toBeInTheDocument()
    expect(screen.queryByText('Folder:')).not.toBeInTheDocument()
  })

  it('B5.2 marks the recorded folder when it does not resolve here', async () => {
    answerProbe((path) => path !== RECORDED_FOLDER)
    renderItem()

    expect(await screen.findByLabelText(NOT_FOUND_LABEL)).toBeInTheDocument()
    expect(screen.getByText(RECORDED_FOLDER)).toHaveClass('line-through')
  })

  it('B5.2 leaves the recorded folder unmarked when it does resolve here', async () => {
    renderItem()

    await waitFor(() => expect(trelloApi.pathsExist).toHaveBeenCalled())

    expect(screen.queryByLabelText(NOT_FOUND_LABEL)).not.toBeInTheDocument()
    expect(screen.getByText(RECORDED_FOLDER)).not.toHaveClass('line-through')
  })

  it('B5.3 strikes through a file row whose recorded path does not resolve here', async () => {
    answerProbe((path) => path !== FILE_B)
    renderItem()

    const marked = await screen.findByLabelText(NOT_FOUND_LABEL)

    expect(marked).toBeInTheDocument()
    expect(screen.getByText(/A002\.mov/)).toHaveClass('line-through')
    expect(screen.getByText(/A001\.mov/)).not.toHaveClass('line-through')
  })

  it('B5.4 marks nothing while the probe is in flight', async () => {
    vi.mocked(trelloApi.pathsExist).mockReturnValue(new Promise(() => {}))
    renderItem()

    await waitFor(() => expect(trelloApi.pathsExist).toHaveBeenCalled())

    expect(screen.queryByLabelText(NOT_FOUND_LABEL)).not.toBeInTheDocument()
    expect(screen.getByText(RECORDED_FOLDER)).not.toHaveClass('line-through')
    expect(screen.getByText(/A001\.mov/)).not.toHaveClass('line-through')
  })

  it('B5.5 covers the folder and every file path in one batched probe', async () => {
    renderItem()

    await waitFor(() => expect(trelloApi.pathsExist).toHaveBeenCalled())

    expect(vi.mocked(trelloApi.pathsExist).mock.calls).toHaveLength(1)
    expect(vi.mocked(trelloApi.pathsExist).mock.calls[0][0]).toEqual(
      expect.arrayContaining([RECORDED_FOLDER, FILE_A, FILE_B])
    )
  })
})
