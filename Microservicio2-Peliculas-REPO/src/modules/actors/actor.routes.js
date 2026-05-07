import {
  getActors, getActorById, createActor, updateActor, deleteActor
} from './actor.controller.js'

import { createActorSchema, updateActorSchema } from './actor.schema.js'

export default async function actorRoutes(fastify) {
  fastify.get   ('/actors',     getActors)
  fastify.get   ('/actors/:id', getActorById)
  fastify.post  ('/actors',     { schema: createActorSchema }, createActor)
  fastify.put   ('/actors/:id', { schema: updateActorSchema }, updateActor)
  fastify.delete('/actors/:id', deleteActor)
}