export const createReviewSchema = {
  body: {
    type: 'object',
    required: ['author', 'rating'],
    properties: {
      author:  { type: 'string' },
      rating:  { type: 'number', minimum: 0, maximum: 10 },
      comment: { type: 'string' }
    }
  }
}

export const updateReviewSchema = {
  body: {
    type: 'object',
    properties: {
      author:  { type: 'string' },
      rating:  { type: 'number', minimum: 0, maximum: 10 },
      comment: { type: 'string' }
    }
  }
}