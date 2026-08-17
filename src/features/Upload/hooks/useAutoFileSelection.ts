import { useEffect } from 'react'

interface AutoFileSelectionProps {
  files: string[]
  selectedFilePath: string | null
  selectFile: (filePath: string) => void
  criteria?: { preferVideo?: boolean; preferImage?: boolean }
}

/**
 * Keeps a file selected whenever the available list offers one: on first
 * load, and again whenever the list changes under a cleared selection - the
 * template switch on the Posterframe page swaps the whole background folder,
 * and the preview must repopulate with the new folder's first image (issue
 * #189 B3.8, amendment).
 *
 * Previously this ran inside a react-query queryFn keyed only on `criteria`,
 * so a changed file list never re-ran selection while the query was fresh:
 * switching template left the preview empty. Selection is a side effect, not
 * data fetching, so it is an effect.
 */
export function useAutoFileSelection({
  files,
  selectedFilePath,
  selectFile,
  criteria = {}
}: AutoFileSelectionProps): void {
  const { preferVideo, preferImage } = criteria

  useEffect(() => {
    if (selectedFilePath || files.length === 0) return

    if (preferVideo) {
      const video = files.find((file) => /\.(mp4|mov|avi|mkv)$/i.test(file))
      if (video) {
        selectFile(video)
        return
      }
    }

    if (preferImage) {
      const image = files.find((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      if (image) {
        selectFile(image)
        return
      }
    }

    selectFile(files[0])
  }, [files, selectedFilePath, selectFile, preferVideo, preferImage])
}
