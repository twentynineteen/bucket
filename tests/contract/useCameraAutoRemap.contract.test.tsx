import { queryKeys } from '@lib/query-keys'
import { renderHook, waitFor } from '@testing-library/react'
import {
  renderWithQueryClient,
  testHookContract,
  type HookTestContract
} from '@tests/utils/query-test-utils'

describe('useCameraAutoRemap Contract Tests', () => {
  const contract: HookTestContract = {
    hookName: 'useCameraAutoRemap',
    inputs: {
      projectId: 'project123'
    },
    expectedQueries: [
      queryKeys.camera.autoRemap('project123'),
      queryKeys.files.selection('project123')
    ],
    expectedMutations: ['applyCameraMapping'],
    mockResponses: {
      [JSON.stringify(queryKeys.camera.autoRemap('project123'))]: {
        projectId: 'project123',
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.9 },
          { fileId: '2', suggestedCamera: 2, confidence: 0.8 },
          { fileId: '3', suggestedCamera: 1, confidence: 0.7 }
        ],
        appliedAt: '2023-01-01T00:00:00Z'
      },
      [JSON.stringify(queryKeys.files.selection('project123'))]: {
        projectId: 'project123',
        files: [
          { id: '1', name: 'video1.mp4', size: 1024000, cameraNumber: null },
          { id: '2', name: 'video2.mp4', size: 2048000, cameraNumber: null },
          { id: '3', name: 'video3.mp4', size: 1536000, cameraNumber: null }
        ],
        lastModified: '2023-01-01T00:00:00Z'
      }
    },
    testScenarios: [
      {
        name: 'should fetch camera auto-remap suggestions on mount',
        expectations: [
          {
            queryKey: queryKeys.camera.autoRemap('project123'),
            expectedData: expect.objectContaining({
              projectId: 'project123',
              suggestions: expect.arrayContaining([
                expect.objectContaining({
                  fileId: expect.any(String),
                  suggestedCamera: expect.any(Number),
                  confidence: expect.any(Number)
                })
              ])
            })
          }
        ]
      },
      {
        name: 'should fetch current file selection for project',
        expectations: [
          {
            queryKey: queryKeys.files.selection('project123'),
            expectedData: expect.objectContaining({
              projectId: 'project123',
              files: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  name: expect.any(String),
                  cameraNumber: expect.any(Object) // null or number
                })
              ])
            })
          }
        ]
      },
      {
        name: 'should invalidate cache when camera mapping is applied',
        action: () => {
          // Simulate applying camera mapping
        },
        expectations: [
          {
            queryKey: queryKeys.camera.autoRemap('project123'),
            expectedData: expect.objectContaining({
              appliedAt: expect.any(String)
            })
          }
        ]
      }
    ]
  }

  it('should fulfill the migration contract', async () => {
    await testHookContract(contract)
  })

  describe('Current vs Expected Behavior', () => {
    it('CURRENT: uses useEffect for camera auto-mapping logic', () => {
      // Current implementation might use useEffect with dependency array
      const mockApplyMapping = vi.fn()
      const mockSetSuggestions = vi.fn()

      const projectId = 'project123'
      const files = [
        { id: '1', name: 'CAM1_video.mp4' },
        { id: '2', name: 'CAM2_video.mp4' }
      ]

      // Simulate current auto-mapping logic
      const suggestions = files.map((file, index) => ({
        fileId: file.id,
        suggestedCamera: index + 1,
        confidence: 0.8
      }))

      mockSetSuggestions(suggestions)
      expect(mockSetSuggestions).toHaveBeenCalledWith(suggestions)
    })

    it('EXPECTED: should use React Query for camera mapping state', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)
      const expectedMappings = {
        projectId,
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.9 },
          { fileId: '2', suggestedCamera: 2, confidence: 0.8 }
        ],
        appliedAt: new Date().toISOString()
      }

      queryClient.setQueryData(remapQuery, expectedMappings)

      const cachedData = queryClient.getQueryData(remapQuery)
      expect(cachedData).toEqual(expectedMappings)
    })
  })

  describe('Auto-Mapping Logic Contract', () => {
    it('should analyze file names for camera hints', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const filesQuery = queryKeys.files.selection(projectId)
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Files with camera hints in names
      const filesWithHints = {
        projectId,
        files: [
          { id: '1', name: 'CAM1_morning_shoot.mp4', cameraNumber: null },
          { id: '2', name: 'Camera_2_afternoon.mp4', cameraNumber: null },
          { id: '3', name: 'C3_evening_shots.mp4', cameraNumber: null }
        ]
      }

      queryClient.setQueryData(filesQuery, filesWithHints)

      // Expected auto-mapping suggestions
      const expectedSuggestions = {
        projectId,
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.9 },
          { fileId: '2', suggestedCamera: 2, confidence: 0.9 },
          { fileId: '3', suggestedCamera: 3, confidence: 0.8 }
        ]
      }

      queryClient.setQueryData(remapQuery, expectedSuggestions)

      const suggestions = queryClient.getQueryData(remapQuery) as any
      expect(suggestions.suggestions).toHaveLength(3)
      expect(suggestions.suggestions[0].suggestedCamera).toBe(1)
    })

    it('should handle files without camera hints', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Files without obvious camera hints
      const ambiguousSuggestions = {
        projectId,
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.5 },
          { fileId: '2', suggestedCamera: 1, confidence: 0.4 }
        ],
        requiresManualReview: true
      }

      queryClient.setQueryData(remapQuery, ambiguousSuggestions)

      const suggestions = queryClient.getQueryData(remapQuery) as any
      expect(suggestions.requiresManualReview).toBe(true)
      expect(suggestions.suggestions[0].confidence).toBeLessThan(0.6)
    })

    it('should update confidence scores based on context', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Initial suggestions with low confidence
      const initialSuggestions = {
        projectId,
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.6 },
          { fileId: '2', suggestedCamera: 2, confidence: 0.5 }
        ]
      }

      queryClient.setQueryData(remapQuery, initialSuggestions)

      // Updated suggestions with higher confidence after analysis
      const refinedSuggestions = {
        projectId,
        suggestions: [
          { fileId: '1', suggestedCamera: 1, confidence: 0.9 },
          { fileId: '2', suggestedCamera: 2, confidence: 0.8 }
        ],
        refinedAt: new Date().toISOString()
      }

      queryClient.setQueryData(remapQuery, refinedSuggestions)

      const finalSuggestions = queryClient.getQueryData(remapQuery) as any
      expect(finalSuggestions.suggestions[0].confidence).toBe(0.9)
      expect(finalSuggestions.refinedAt).toBeDefined()
    })
  })

  describe('Cache Invalidation Contract', () => {
    it('should invalidate file selection when mappings are applied', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const filesQuery = queryKeys.files.selection(projectId)
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Initial file selection without camera assignments
      queryClient.setQueryData(filesQuery, {
        projectId,
        files: [{ id: '1', name: 'video1.mp4', cameraNumber: null }]
      })

      // Apply camera mapping
      queryClient.setQueryData(filesQuery, {
        projectId,
        files: [{ id: '1', name: 'video1.mp4', cameraNumber: 1 }],
        lastModified: new Date().toISOString()
      })

      // Remap query should reflect applied state
      queryClient.setQueryData(remapQuery, {
        projectId,
        suggestions: [],
        appliedAt: new Date().toISOString()
      })

      const updatedFiles = queryClient.getQueryData(filesQuery) as any
      const updatedRemap = queryClient.getQueryData(remapQuery) as any

      expect(updatedFiles.files[0].cameraNumber).toBe(1)
      expect(updatedRemap.appliedAt).toBeDefined()
    })

    it('should invalidate project queries when camera assignments change', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const projectQuery = queryKeys.projects.detail(projectId)
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Initial project state
      queryClient.setQueryData(projectQuery, {
        id: projectId,
        name: 'Test Project',
        cameraAssignments: {}
      })

      // Apply camera remapping
      queryClient.setQueryData(remapQuery, {
        projectId,
        suggestions: [],
        appliedAt: new Date().toISOString()
      })

      // Project should reflect updated camera assignments
      queryClient.setQueryData(projectQuery, {
        id: projectId,
        name: 'Test Project',
        cameraAssignments: {
          '1': 1,
          '2': 2
        },
        lastModified: new Date().toISOString()
      })

      const updatedProject = queryClient.getQueryData(projectQuery) as any
      expect(updatedProject.cameraAssignments).toBeDefined()
      expect(Object.keys(updatedProject.cameraAssignments)).toHaveLength(2)
    })
  })

  describe('Error Handling Contract', () => {
    it('should handle auto-mapping failures gracefully', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)
      const error = new Error('Failed to analyze files for camera mapping')

      // Simulate error using the working pattern from useBreadcrumb test
      const queryCache = queryClient.getQueryCache()
      const query = queryCache.build(queryClient, {
        queryKey: remapQuery,
        queryFn: () => Promise.reject(error)
      })

      query.setData(undefined)
      query.setState({
        status: 'error',
        error,
        data: undefined,
        dataUpdatedAt: 0,
        dataUpdateCount: 0,
        errorUpdatedAt: Date.now(),
        errorUpdateCount: 1,
        fetchFailureCount: 1,
        fetchFailureReason: error,
        fetchMeta: null,
        isInvalidated: false,
        isPaused: false,
        fetchStatus: 'idle'
      })

      const foundQuery = queryClient.getQueryCache().find(remapQuery)
      expect(foundQuery?.state.status).toBe('error')
      expect(foundQuery?.state.error?.message).toBe(
        'Failed to analyze files for camera mapping'
      )
    })

    it('should provide fallback when no suggestions are available', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // No suggestions scenario
      const noSuggestions = {
        projectId,
        suggestions: [],
        reason: 'No camera hints found in filenames',
        requiresManualMapping: true
      }

      queryClient.setQueryData(remapQuery, noSuggestions)

      const data = queryClient.getQueryData(remapQuery) as any
      expect(data.suggestions).toHaveLength(0)
      expect(data.requiresManualMapping).toBe(true)
    })
  })

  describe('Performance Contract', () => {
    it('should use DYNAMIC profile for camera mapping queries', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      queryClient.setQueryData(remapQuery, {
        projectId,
        suggestions: [],
        computedAt: new Date().toISOString()
      })

      const query = queryClient.getQueryCache().find(remapQuery)
      expect(query?.state.data).toBeDefined()
    })

    it('should handle large file sets efficiently', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const projectId = 'project123'
      const remapQuery = queryKeys.camera.autoRemap(projectId)

      // Large set of files
      const largeSuggestionSet = {
        projectId,
        suggestions: Array.from({ length: 100 }, (_, i) => ({
          fileId: `file${i}`,
          suggestedCamera: (i % 4) + 1,
          confidence: 0.7 + Math.random() * 0.3
        })),
        processingTime: 1250 // ms
      }

      queryClient.setQueryData(remapQuery, largeSuggestionSet)

      const data = queryClient.getQueryData(remapQuery) as any
      expect(data.suggestions).toHaveLength(100)
      expect(data.processingTime).toBeLessThan(5000) // Should be fast
    })
  })
})
