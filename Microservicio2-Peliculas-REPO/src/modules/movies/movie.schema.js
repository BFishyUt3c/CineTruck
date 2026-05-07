export const createMovieSchema = {
  body: {
    type: 'object',
    required: ['title', 'year'],
    properties: {
      title:      { type: 'string' },
      year:       { type: 'integer' },
      duration:   { type: 'integer' },
      synopsis:   { type: 'string' },
      poster_url: { type: 'string' },
      genres: {
        type: 'array',
        items: { type: 'string' }
      },
      directors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name:        { type: 'string' },
            nationality: { type: 'string' },
            birth_date:  { type: 'string' }
          }
        }
      },
      actors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name:        { type: 'string' },
            nationality: { type: 'string' },
            birth_date:  { type: 'string' },
            role:        { type: 'string' }
          }
        }
      }
    }
  }
}

export const updateMovieSchema = {
  body: {
    type: 'object',
    properties: {
      title:      { type: 'string' },
      year:       { type: 'integer' },
      duration:   { type: 'integer' },
      synopsis:   { type: 'string' },
      poster_url: { type: 'string' },
      genres: {
        type: 'array',
        items: { type: 'string' }
      },
      directors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name:        { type: 'string' },
            nationality: { type: 'string' },
            birth_date:  { type: 'string' }
          }
        }
      },
      actors: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name:        { type: 'string' },
            nationality: { type: 'string' },
            birth_date:  { type: 'string' },
            role:        { type: 'string' }
          }
        }
      }
    }
  }
}

export const addRelationSchema = {
  body: {
    type: 'object',
    required: ['id'],
    properties: {
      id:   { type: 'integer' },
      role: { type: 'string' }
    }
  }
}