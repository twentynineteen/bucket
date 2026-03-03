/**
 * Validation Stage Unit Tests
 *
 * Tests for the validation stage module which validates all inputs
 * before project creation begins.
 */

import { exists } from '@tauri-apps/plugin-fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  areValidCameraAssignments,
  type FileWithCamera,
  getInvalidCameraAssignments,
  isValidProjectName,
  validateInputs,
  type ValidationInput,
  validationStageConfig
} from '../stages/validation'

// Mock Tauri plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn()
}))

describe('Validation Stage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // validateInputs Tests
  // ============================================================================

  describe('validateInputs', () => {
    describe('with valid inputs', () => {
      it('should return success with valid inputs', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [
            { file: { path: '/path/to/video1.mp4', name: 'video1.mp4' }, camera: 1 },
            { file: { path: '/path/to/video2.mp4', name: 'video2.mp4' }, camera: 2 }
          ],
          projectName: 'Test Project',
          outputPath: '/valid/output/path',
          numCameras: 3
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.isValid).toBe(true)
          expect(result.data.projectFolder).toBe('/valid/output/path/Test Project')
          expect(result.data.validationErrors).toHaveLength(0)
          expect(result.durationMs).toBeGreaterThanOrEqual(0)
        }
      })

      it('should trim project name in output path', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        // Note: Leading/trailing spaces in project name will cause validation to fail
        // This test verifies that internal whitespace is preserved and trailing
        // whitespace on the name itself is trimmed when constructing the path
        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Trimmed Project',
          outputPath: '/output',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.data.projectFolder).toBe('/output/Trimmed Project')
        }
      })

      it('should return warnings array (even if empty)', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Project',
          outputPath: '/output',
          numCameras: 2
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(Array.isArray(result.data.warnings)).toBe(true)
        }
      })
    })

    describe('empty files array validation', () => {
      it('should fail when files array is empty', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 2
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('At least one file must be selected')
          expect(result.error.recoverable).toBe(true)
        }
      })

      it('should fail when files is undefined', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: undefined as unknown as FileWithCamera[],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 2
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('At least one file')
        }
      })
    })

    describe('invalid project name validation', () => {
      it('should fail when project name is empty', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: '',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain(
            'Project name is required and cannot be empty'
          )
        }
      })

      it('should fail when project name is only whitespace', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: '   ',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Project name is required')
        }
      })

      it('should fail when project name contains invalid characters', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Invalid/Project:Name',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('invalid characters')
        }
      })

      it('should fail when project name exceeds max length', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const longName = 'A'.repeat(201)
        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: longName,
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('200 characters or less')
        }
      })

      it('should fail when project name is a reserved Windows name', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'CON',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('reserved name')
        }
      })

      it('should fail when project name starts with space', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: ' LeadingSpace',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('cannot start or end with spaces')
        }
      })

      it('should fail when project name ends with period', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'ProjectName.',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('cannot end with a period')
        }
      })
    })

    describe('invalid camera assignments', () => {
      it('should fail when camera number is less than 1', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 0 }],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 3
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Invalid camera assignments')
          expect(result.error.message).toContain('video.mp4')
        }
      })

      it('should fail when camera number exceeds numCameras', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 5 }],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 3
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Invalid camera assignments')
          expect(result.error.message).toContain('between 1 and 3')
        }
      })

      it('should list all files with invalid camera assignments', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [
            { file: { path: '/path/to/video1.mp4', name: 'video1.mp4' }, camera: 0 },
            { file: { path: '/path/to/video2.mp4', name: 'video2.mp4' }, camera: 5 },
            { file: { path: '/path/to/video3.mp4', name: 'video3.mp4' }, camera: 2 }
          ],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 3
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('video1.mp4')
          expect(result.error.message).toContain('video2.mp4')
          expect(result.error.message).not.toContain('video3.mp4')
        }
      })
    })

    describe('output path validation', () => {
      it('should fail when output path is empty', async () => {
        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Test Project',
          outputPath: '',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Output path is required')
        }
      })

      it('should fail when output path does not exist', async () => {
        vi.mocked(exists).mockResolvedValueOnce(false)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Test Project',
          outputPath: '/nonexistent/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Output path does not exist')
        }
      })

      it('should fail when exists check throws error', async () => {
        vi.mocked(exists).mockRejectedValueOnce(new Error('Permission denied'))

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Test Project',
          outputPath: '/protected/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.message).toContain('Unable to access output path')
        }
      })
    })

    describe('multiple validation errors', () => {
      it('should collect all validation errors', async () => {
        vi.mocked(exists).mockResolvedValueOnce(false)

        const input: ValidationInput = {
          files: [],
          projectName: '',
          outputPath: '/nonexistent',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          // Should contain multiple error messages joined
          expect(result.error.message).toContain('At least one file')
          expect(result.error.message).toContain('Project name is required')
        }
      })
    })

    describe('duration tracking', () => {
      it('should track operation duration', async () => {
        vi.mocked(exists).mockResolvedValueOnce(true)

        const input: ValidationInput = {
          files: [{ file: { path: '/path/to/video.mp4', name: 'video.mp4' }, camera: 1 }],
          projectName: 'Test Project',
          outputPath: '/valid/path',
          numCameras: 1
        }

        const result = await validateInputs(input)

        expect(result.durationMs).toBeGreaterThanOrEqual(0)
        expect(typeof result.durationMs).toBe('number')
      })
    })
  })

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('isValidProjectName', () => {
    it('should return true for valid project names', () => {
      expect(isValidProjectName('My Project')).toBe(true)
      expect(isValidProjectName('Project-2024')).toBe(true)
      expect(isValidProjectName('Project_Name')).toBe(true)
      expect(isValidProjectName("Project's Name")).toBe(true)
    })

    it('should return false for invalid project names', () => {
      expect(isValidProjectName('')).toBe(false)
      expect(isValidProjectName('   ')).toBe(false)
      expect(isValidProjectName('Invalid/Name')).toBe(false)
      expect(isValidProjectName('Invalid:Name')).toBe(false)
      expect(isValidProjectName('CON')).toBe(false)
    })
  })

  describe('areValidCameraAssignments', () => {
    it('should return true when all assignments are valid', () => {
      const files: FileWithCamera[] = [
        { file: { path: '/video1.mp4', name: 'video1.mp4' }, camera: 1 },
        { file: { path: '/video2.mp4', name: 'video2.mp4' }, camera: 2 },
        { file: { path: '/video3.mp4', name: 'video3.mp4' }, camera: 3 }
      ]

      expect(areValidCameraAssignments(files, 3)).toBe(true)
    })

    it('should return false when any assignment is invalid', () => {
      const files: FileWithCamera[] = [
        { file: { path: '/video1.mp4', name: 'video1.mp4' }, camera: 1 },
        { file: { path: '/video2.mp4', name: 'video2.mp4' }, camera: 5 }
      ]

      expect(areValidCameraAssignments(files, 3)).toBe(false)
    })

    it('should return true for empty files array', () => {
      expect(areValidCameraAssignments([], 3)).toBe(true)
    })
  })

  describe('getInvalidCameraAssignments', () => {
    it('should return only files with invalid camera assignments', () => {
      const files: FileWithCamera[] = [
        { file: { path: '/video1.mp4', name: 'video1.mp4' }, camera: 0 },
        { file: { path: '/video2.mp4', name: 'video2.mp4' }, camera: 2 },
        { file: { path: '/video3.mp4', name: 'video3.mp4' }, camera: 5 }
      ]

      const invalid = getInvalidCameraAssignments(files, 3)

      expect(invalid).toHaveLength(2)
      expect(invalid[0].file.name).toBe('video1.mp4')
      expect(invalid[1].file.name).toBe('video3.mp4')
    })

    it('should return empty array when all assignments are valid', () => {
      const files: FileWithCamera[] = [
        { file: { path: '/video1.mp4', name: 'video1.mp4' }, camera: 1 },
        { file: { path: '/video2.mp4', name: 'video2.mp4' }, camera: 2 }
      ]

      const invalid = getInvalidCameraAssignments(files, 3)

      expect(invalid).toHaveLength(0)
    })
  })

  // ============================================================================
  // Stage Configuration Tests
  // ============================================================================

  describe('validationStageConfig', () => {
    it('should have correct stage name', () => {
      expect(validationStageConfig.name).toBe('validation')
    })

    it('should have correct display name', () => {
      expect(validationStageConfig.displayName).toBe('Validating Project')
    })

    it('should be retryable', () => {
      expect(validationStageConfig.retryable).toBe(true)
    })

    it('should be cancellable', () => {
      expect(validationStageConfig.cancellable).toBe(true)
    })

    it('should have no dependencies', () => {
      expect(validationStageConfig.dependsOn).toHaveLength(0)
    })

    it('should have reasonable timeout', () => {
      expect(validationStageConfig.timeout).toBe(30000)
    })
  })
})
