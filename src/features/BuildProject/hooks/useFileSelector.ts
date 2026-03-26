import { openFileDialog } from '../api'

import type { FootageFile } from '../types'

export async function selectFiles(): Promise<FootageFile[]> {
  const selectedPaths = await openFileDialog()

  if (!selectedPaths) return []

  return (Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths]).map((path) => ({
    file: { path, name: path.split('/').pop() || 'unknown' },
    camera: 1
  }))
}
