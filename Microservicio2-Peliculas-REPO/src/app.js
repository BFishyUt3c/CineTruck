import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import 'dotenv/config'
import { initDB } from './db/database.js'
import * as database from './db/database.js'  
import movieRoutes    from './modules/movies/movie.routes.js'
import directorRoutes from './modules/directors/director.routes.js'
import genreRoutes    from './modules/genres/genre.routes.js'
import actorRoutes    from './modules/actors/actor.routes.js'
import reviewRoutes   from './modules/reviews/review.routes.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors)
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Movies Microservice API',
      description: 'API REST para gestión de películas',
      version: '1.0.0'
    }
  }                              
})
await fastify.register(swaggerUi, {
  routePrefix: '/docs'
})

await initDB()

fastify.register(movieRoutes,    { prefix: '/api' })
fastify.register(directorRoutes, { prefix: '/api' })
fastify.register(genreRoutes,    { prefix: '/api' })
fastify.register(actorRoutes,    { prefix: '/api' })
fastify.register(reviewRoutes,   { prefix: '/api' })  

fastify.get('/health', async () => ({ status: 'ok' }))

fastify.get('/api/todos_los_registros', async (request, reply) => {
  const [[movies], [directors], [genres], [actors], [reviews], [movie_directors], [movie_genres], [movie_actors]] = await Promise.all([
    database.db.query('SELECT * FROM movies'),       
    database.db.query('SELECT * FROM directors'),
    database.db.query('SELECT * FROM genres'),
    database.db.query('SELECT * FROM actors'),
    database.db.query('SELECT * FROM reviews'),
    database.db.query('SELECT * FROM movie_directors'),
    database.db.query('SELECT * FROM movie_genres'),
    database.db.query('SELECT * FROM movie_actors'),
  ])
  return { movies, directors, genres, actors, reviews, movie_directors, movie_genres, movie_actors }
})

try {
  await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}