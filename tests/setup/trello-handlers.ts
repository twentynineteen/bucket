import { http, HttpResponse } from 'msw'

export const trelloHandlers = [
  // Mock successful card fetch
  http.get('https://api.trello.com/1/cards/:cardId', ({ params, request }) => {
    const { cardId } = params
    const url = new URL(request.url)
    const apiKey = url.searchParams.get('key')
    const token = url.searchParams.get('token')

    // Simulate auth failure
    if (apiKey === 'invalid' || token === 'invalid') {
      return new HttpResponse(null, { status: 401 })
    }

    // Mock card not found
    if (cardId === 'nonexistent') {
      return new HttpResponse(null, { status: 404 })
    }

    // Return mock card data
    return HttpResponse.json({
      id: cardId,
      name: `Mock Card ${cardId}`,
      desc: 'Mock description',
      url: `https://trello.com/c/${cardId}/mock-card`,
      idBoard: 'mock-board-id'
    })
  }),

  // Mock board fetch
  http.get('https://api.trello.com/1/boards/:boardId', ({ params }) => {
    return HttpResponse.json({
      id: params.boardId,
      name: 'Mock Board Name'
    })
  })
]
