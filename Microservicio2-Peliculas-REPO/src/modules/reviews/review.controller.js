import { db } from '../../db/database.js'

export async function getReviewsByMovie(request, reply) {
  const { id } = request.params
  const { page = 1, limit = 20 } = request.query

  const [movies] = await db.execute('SELECT id FROM movies WHERE id = ?', [id])
  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })

  const [reviews] = await db.execute(
    'SELECT * FROM reviews WHERE movie_id = ? LIMIT ? OFFSET ?',
    [id, Number(limit), (Number(page) - 1) * Number(limit)]
  )

  const [total] = await db.execute(
    'SELECT COUNT(*) as count FROM reviews WHERE movie_id = ?', [id]
  )

  reply.send({ data: reviews, total: total[0].count, page: Number(page), limit: Number(limit) })
}

export async function createReview(request, reply) {
  const { id } = request.params
  const { author, rating, comment } = request.body

  const [movies] = await db.execute('SELECT id FROM movies WHERE id = ?', [id])
  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })

  const [result] = await db.execute(
    'INSERT INTO reviews (movie_id, author, rating, comment) VALUES (?, ?, ?, ?)',
    [id, author, rating, comment ?? null]
  )

  reply.status(201).send({ id: result.insertId, movie_id: Number(id), author, rating })
}

export async function updateReview(request, reply) {
  const { id } = request.params
  const [reviews] = await db.execute('SELECT * FROM reviews WHERE id = ?', [id])
  if (reviews.length === 0) return reply.status(404).send({ error: 'Reseña no encontrada' })

  const review  = reviews[0]
  const updated = { ...review, ...request.body }

  await db.execute(
    'UPDATE reviews SET author=?, rating=?, comment=? WHERE id=?',
    [updated.author, updated.rating, updated.comment, id]
  )

  reply.send({ message: 'Reseña actualizada', id: Number(id) })
}

export async function deleteReview(request, reply) {
  const { id } = request.params
  const [reviews] = await db.execute('SELECT id FROM reviews WHERE id = ?', [id])
  if (reviews.length === 0) return reply.status(404).send({ error: 'Reseña no encontrada' })

  await db.execute('DELETE FROM reviews WHERE id = ?', [id])
  reply.send({ message: 'Reseña eliminada', id: Number(id) })
}