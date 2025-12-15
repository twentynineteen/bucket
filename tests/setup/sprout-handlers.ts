import { http, HttpResponse } from 'msw'

export const sproutHandlers = [
  // Mock video upload
  http.post('https://api.sproutvideo.com/v1/videos', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.includes('Bearer') || authHeader.includes('invalid')) {
      return new HttpResponse(null, { status: 401 })
    }

    // Simulate successful upload
    return HttpResponse.json({
      id: 'mock-video-id-' + Date.now(),
      title: 'Mock Video Title',
      created_at: new Date().toISOString(),
      duration: 120,
      assets: {
        poster_frames: ['https://cdn.sproutvideo.com/mock/frame_0000.jpg']
      },
      embed_code: '<iframe src="..."></iframe>',
      embedded_url: 'https://sproutvideo.com/videos/mock-id'
    })
  }),

  // Mock video fetch
  http.get('https://api.sproutvideo.com/v1/videos/:videoId', ({ params }) => {
    return HttpResponse.json({
      id: params.videoId,
      title: `Mock Video ${params.videoId}`,
      assets: {
        poster_frames: ['https://cdn.sproutvideo.com/mock/frame.jpg']
      }
    })
  })
]
