import {
  getGenres, getGenreById, createGenre, updateGenre, deleteGenre
} from './genre.controller.js'

import { createGenreSchema, updateGenreSchema } from './genre.schema.js'

export default async function genreRoutes(fastify) {
  fastify.get   ('/genres',     getGenres)
  fastify.get   ('/genres/:id', getGenreById)
  fastify.post  ('/genres',     { schema: createGenreSchema }, createGenre)
  fastify.put   ('/genres/:id', { schema: updateGenreSchema }, updateGenre)
  fastify.delete('/genres/:id', deleteGenre)
}