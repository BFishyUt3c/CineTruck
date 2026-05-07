import {
  getDirectors, getDirectorById, createDirector, updateDirector, deleteDirector
} from './director.controller.js'

import { createDirectorSchema, updateDirectorSchema } from './director.schema.js'

export default async function directorRoutes(fastify) {
  fastify.get   ('/directors',      getDirectors)
  fastify.get   ('/directors/:id',  getDirectorById)
  fastify.post  ('/directors',      { schema: createDirectorSchema }, createDirector)
  fastify.put   ('/directors/:id',  { schema: updateDirectorSchema }, updateDirector)
  fastify.delete('/directors/:id',  deleteDirector)
}