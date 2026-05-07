export const createGenreSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' }
    }
  }
}

export const updateGenreSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }
}