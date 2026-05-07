import {
  getMovies, getMovieById, createMovie, updateMovie, deleteMovie,
  addDirectorToMovie, removeDirectorFromMovie,
  addGenreToMovie, removeGenreFromMovie,
  addActorToMovie, removeActorFromMovie
} from './movie.controller.js'

import { createMovieSchema, updateMovieSchema, addRelationSchema } from './movie.schema.js'

export default async function movieRoutes(fastify) {
  fastify.get   ('/movies',                          getMovies)
  fastify.get   ('/movies/:id',                      getMovieById)
  fastify.post  ('/movies',     { schema: createMovieSchema }, createMovie)
  fastify.put   ('/movies/:id', { schema: updateMovieSchema }, updateMovie)
  fastify.delete('/movies/:id',                      deleteMovie)

  fastify.post  ('/movies/:id/genres/:genreId',       { schema: addRelationSchema }, addGenreToMovie)
  fastify.delete('/movies/:id/genres/:genreId',       removeGenreFromMovie)

  fastify.post  ('/movies/:id/directors/:directorId', { schema: addRelationSchema }, addDirectorToMovie)
  fastify.delete('/movies/:id/directors/:directorId', removeDirectorFromMovie)

  fastify.post  ('/movies/:id/actors/:actorId',       { schema: addRelationSchema }, addActorToMovie)
  fastify.delete('/movies/:id/actors/:actorId',       removeActorFromMovie)
}