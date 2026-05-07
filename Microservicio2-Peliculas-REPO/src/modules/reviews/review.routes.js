import {
  getReviewsByMovie, createReview, updateReview, deleteReview
} from './review.controller.js'

import { createReviewSchema, updateReviewSchema } from './review.schema.js'

export default async function reviewRoutes(fastify) {
  fastify.get   ('/movies/:id/reviews', getReviewsByMovie)
  fastify.post  ('/movies/:id/reviews', { schema: createReviewSchema }, createReview)
  fastify.put   ('/reviews/:id',        { schema: updateReviewSchema }, updateReview)
  fastify.delete('/reviews/:id',        deleteReview)
}