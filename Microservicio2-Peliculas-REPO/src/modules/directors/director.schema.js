export const createDirectorSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name:        { type: 'string' },
      nationality: { type: 'string' },
      birth_date:  { type: 'string' }
    }
  }
}

export const updateDirectorSchema = {
  body: {
    type: 'object',
    properties: {
      name:        { type: 'string' },
      nationality: { type: 'string' },
      birth_date:  { type: 'string' }
    }
  }
}