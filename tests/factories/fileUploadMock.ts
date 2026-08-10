/**
 * Factory for `useFileUpload` mock return values.
 *
 * Deliberately NOT named `use*`: a `use` prefix makes lint treat it as a hook
 * and reject calls from plain test helpers.
 *
 * `UseFileUploadReturn` is mocked at ~30 call sites across Baker and Trello
 * tests, most of them uncast object literals. Every field added to the hook was
 * therefore a compile error at all of them. Spreading this factory instead means
 * the next field costs one edit here rather than thirty.
 *
 *   vi.mocked(useFileUpload).mockReturnValue(
 *     createFileUploadMock({ selectedFile: '/tmp/clip.mp4' })
 *   )
 */
import { vi } from 'vitest'

type UseFileUploadReturn = ReturnType<
  typeof import('@features/Upload')['useFileUpload']
>

export function createFileUploadMock(
  overrides: Partial<UseFileUploadReturn> = {}
): UseFileUploadReturn {
  return {
    selectedFile: null,
    uploading: false,
    response: null,
    localDuration: null,
    selectedFolder: null,
    setSelectedFolder: vi.fn(),
    selectFile: vi.fn().mockResolvedValue(null),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    resetUploadState: vi.fn(),
    ...overrides
  }
}
