import type { BreadcrumbsFile, FileInfo } from '@/types/baker'
import {
  getErrorMessage,
  hasSchemaIssues,
  recoverBreadcrumbs,
  validateBreadcrumbs,
  type ValidationResult
} from '@utils/breadcrumbsValidation'
import { describe, expect, it } from 'vitest'

describe('breadcrumbsValidation', () => {
  describe('validateBreadcrumbs', () => {
    describe('root validation', () => {
      it('should reject null data', () => {
        const result = validateBreadcrumbs(null)

        expect(result.isValid).toBe(false)
        expect(result.canRecover).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].field).toBe('root')
        expect(result.errors[0].message).toContain('Invalid or missing breadcrumbs data')
      })

      it('should reject undefined data', () => {
        const result = validateBreadcrumbs(undefined)

        expect(result.isValid).toBe(false)
        expect(result.canRecover).toBe(false)
      })

      it('should reject non-object data', () => {
        const result = validateBreadcrumbs('invalid')

        expect(result.isValid).toBe(false)
        expect(result.canRecover).toBe(false)
      })
    })

    describe('projectTitle validation', () => {
      it('should accept valid string project title', () => {
        const data = {
          projectTitle: 'Test Project',
          numberOfCameras: 1
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.projectTitle).toBe('Test Project')
        expect(result.errors).toHaveLength(0)
      })

      it('should reject missing project title', () => {
        const data = {
          numberOfCameras: 1
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(false)
        const titleError = result.errors.find(e => e.field === 'projectTitle')
        expect(titleError).toBeDefined()
        expect(titleError?.message).toContain('required')
      })

      it('should convert non-string project title with warning', () => {
        const data = {
          projectTitle: 12345,
          numberOfCameras: 1
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.projectTitle).toBe('12345')
        const warning = result.warnings.find(w => w.field === 'projectTitle')
        expect(warning).toBeDefined()
      })
    })

    describe('numberOfCameras validation', () => {
      it('should accept valid number of cameras', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 3
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.numberOfCameras).toBe(3)
        expect(result.errors).toHaveLength(0)
      })

      it('should default to 1 when numberOfCameras is undefined', () => {
        const data = {
          projectTitle: 'Test'
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.numberOfCameras).toBe(1)
        const warning = result.warnings.find(w => w.field === 'numberOfCameras')
        expect(warning).toBeDefined()
      })

      it('should convert string number to integer with warning', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: '5'
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.numberOfCameras).toBe(5)
        const warning = result.warnings.find(w => w.field === 'numberOfCameras')
        expect(warning?.message).toContain('converted to integer')
      })

      it('should reject negative number of cameras', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: -1
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(false)
        const error = result.errors.find(e => e.field === 'numberOfCameras')
        expect(error?.message).toContain('must be at least 1')
      })

      it('should reject zero cameras', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 0
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(false)
      })

      it('should reject non-numeric cameras value', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 'invalid'
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(false)
        const error = result.errors.find(e => e.field === 'numberOfCameras')
        expect(error).toBeDefined()
      })
    })

    describe('files array validation', () => {
      it('should accept valid files array', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 2,
          files: [
            { camera: 1, name: 'file1.mp4', path: '/path/to/file1.mp4' },
            { camera: 2, name: 'file2.mp4', path: '/path/to/file2.mp4' }
          ]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files).toHaveLength(2)
        expect(result.recoveredData?.files?.[0].camera).toBe(1)
        expect(result.errors).toHaveLength(0)
      })

      it('should clear files when files is not an array', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: 'invalid'
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files).toEqual([])
        const warning = result.warnings.find(w => w.field === 'files')
        expect(warning?.message).toContain('should be an array')
      })

      it('should skip invalid file objects', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: [
            { camera: 1, name: 'file1.mp4', path: '/path/to/file1.mp4' },
            null,
            'invalid',
            { camera: 2, name: 'file2.mp4', path: '/path/to/file2.mp4' }
          ]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files).toHaveLength(2)
        expect(result.warnings.filter(w => w.field.startsWith('files['))).toHaveLength(2)
      })

      it('should default invalid camera number to 1', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 2,
          files: [{ camera: 0, name: 'file1.mp4', path: '/path/to/file1.mp4' }]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files?.[0].camera).toBe(1)
        const warning = result.warnings.find(w => w.field === 'files[0].camera')
        expect(warning?.message).toContain('Invalid camera number')
      })

      it('should default missing camera to 1', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: [{ name: 'file1.mp4', path: '/path/to/file1.mp4' }]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files?.[0].camera).toBe(1)
        const warning = result.warnings.find(w => w.field === 'files[0].camera')
        expect(warning?.message).toContain('Missing camera number')
      })

      it('should use placeholder for invalid file name', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: [{ camera: 1, name: '', path: '/path/to/file.mp4' }]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files?.[0].name).toBe('Unknown_File_1')
        const warning = result.warnings.find(w => w.field === 'files[0].name')
        expect(warning).toBeDefined()
      })

      it('should use placeholder for missing path', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: [{ camera: 1, name: 'file1.mp4', path: '' }]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files?.[0].path).toBe('file1.mp4')
        const warning = result.warnings.find(w => w.field === 'files[0].path')
        expect(warning?.message).toContain('Missing path')
      })

      it('should trim whitespace from file name and path', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          files: [{ camera: 1, name: '  file1.mp4  ', path: '  /path/to/file1.mp4  ' }]
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.files?.[0].name).toBe('file1.mp4')
        expect(result.recoveredData?.files?.[0].path).toBe('/path/to/file1.mp4')
      })
    })

    describe('timestamp validation', () => {
      it('should accept valid ISO timestamp', () => {
        const timestamp = '2024-01-01T12:00:00Z'
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          creationDateTime: timestamp
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.creationDateTime).toBe(timestamp)
      })

      it('should use current time for invalid timestamp', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          creationDateTime: 'invalid-date'
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.creationDateTime).toBeDefined()
        const warning = result.warnings.find(w => w.field === 'creationDateTime')
        expect(warning?.message).toContain('Invalid timestamp')
      })

      it('should handle lastModified timestamp', () => {
        const timestamp = '2024-01-01T12:00:00Z'
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          lastModified: timestamp
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.lastModified).toBe(timestamp)
      })
    })

    describe('string field validation', () => {
      it('should trim and validate parentFolder', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          parentFolder: '  /parent/folder  '
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.parentFolder).toBe('/parent/folder')
      })

      it('should convert non-string fields to strings', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          createdBy: 12345
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.createdBy).toBe('12345')
        const warning = result.warnings.find(w => w.field === 'createdBy')
        expect(warning).toBeDefined()
      })
    })

    describe('folderSizeBytes validation', () => {
      it('should accept valid folder size', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          folderSizeBytes: 1024000
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.folderSizeBytes).toBe(1024000)
      })

      it('should accept zero bytes', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          folderSizeBytes: 0
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.folderSizeBytes).toBe(0)
      })

      it('should reject negative folder size', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: 1,
          folderSizeBytes: -100
        }

        const result = validateBreadcrumbs(data)

        expect(result.recoveredData?.folderSizeBytes).toBeUndefined()
        const warning = result.warnings.find(w => w.field === 'folderSizeBytes')
        expect(warning?.message).toContain('Invalid folder size')
      })
    })

    describe('recovery capability', () => {
      it('should mark as recoverable when only warnings exist', () => {
        const data = {
          projectTitle: 'Test',
          numberOfCameras: '2' // Will be converted with warning
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(true)
        expect(result.canRecover).toBe(true)
        expect(result.recoveredData).toBeDefined()
      })

      it('should mark as not recoverable when errors exist', () => {
        const data = {
          numberOfCameras: 1 // Missing projectTitle (error)
        }

        const result = validateBreadcrumbs(data)

        expect(result.isValid).toBe(false)
        expect(result.canRecover).toBe(false)
      })
    })
  })

  describe('recoverBreadcrumbs', () => {
    it('should recover valid breadcrumbs data', () => {
      const data = {
        projectTitle: 'Test Project',
        numberOfCameras: 2,
        files: [{ camera: 1, name: 'file1.mp4', path: '/path/to/file1.mp4' }]
      }

      const result = recoverBreadcrumbs(data, '/projects/Test Project')

      expect(result.projectTitle).toBe('Test Project')
      expect(result.numberOfCameras).toBe(2)
      expect(result.files).toHaveLength(1)
    })

    it('should create fallback breadcrumbs for invalid data', () => {
      const result = recoverBreadcrumbs(null, '/projects/MyProject')

      expect(result.projectTitle).toBe('MyProject')
      expect(result.numberOfCameras).toBe(1)
      expect(result.files).toEqual([])
      expect(result.createdBy).toBe('Baker (Recovered)')
    })

    it('should extract project name from path', () => {
      const result = recoverBreadcrumbs({}, '/path/to/My Project Name')

      expect(result.projectTitle).toBe('My Project Name')
    })

    it('should extract parent folder from path', () => {
      const result = recoverBreadcrumbs({}, '/path/to/project')

      expect(result.parentFolder).toBe('/path/to')
    })

    it('should handle Windows-style paths', () => {
      const result = recoverBreadcrumbs({}, 'C:\\Users\\Projects\\MyProject')

      expect(result.projectTitle).toBe('MyProject')
      expect(result.parentFolder).toContain('Users')
    })
  })

  describe('hasSchemaIssues', () => {
    it('should return true for null data', () => {
      expect(hasSchemaIssues(null)).toBe(true)
    })

    it('should return true for non-object data', () => {
      expect(hasSchemaIssues('invalid')).toBe(true)
    })

    it('should detect missing path in files', () => {
      const data = {
        files: [
          { camera: 1, name: 'file1.mp4' } // Missing path
        ]
      }

      expect(hasSchemaIssues(data)).toBe(true)
    })

    it('should detect invalid path type in files', () => {
      const data = {
        files: [
          { camera: 1, name: 'file1.mp4', path: 123 } // Invalid path type
        ]
      }

      expect(hasSchemaIssues(data)).toBe(true)
    })

    it('should return false for valid schema', () => {
      const data = {
        files: [{ camera: 1, name: 'file1.mp4', path: '/path/to/file1.mp4' }]
      }

      expect(hasSchemaIssues(data)).toBe(false)
    })

    it('should return false when files array is empty', () => {
      const data = {
        files: []
      }

      expect(hasSchemaIssues(data)).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('should return empty string for valid data', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        canRecover: true
      }

      expect(getErrorMessage(result)).toBe('')
    })

    it('should return single error message', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [{ field: 'test', message: 'Test error', severity: 'error' }],
        warnings: [],
        canRecover: false
      }

      expect(getErrorMessage(result)).toBe('Test error')
    })

    it('should return count for multiple errors', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          { field: 'test1', message: 'Error 1', severity: 'error' },
          { field: 'test2', message: 'Error 2', severity: 'error' }
        ],
        warnings: [],
        canRecover: false
      }

      const message = getErrorMessage(result)
      expect(message).toContain('2 validation errors')
    })
  })
})
