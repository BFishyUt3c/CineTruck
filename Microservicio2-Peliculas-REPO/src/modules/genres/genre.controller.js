import { db } from '../../db/database.js'

export async function getGenres(request, reply) {
  const [genres] = await db.execute('SELECT * FROM genres')
  reply.send({ data: genres })
}

export async function getGenreById(request, reply) {
  const { id } = request.params

  const [genres] = await db.execute('SELECT * FROM genres WHERE id = ?', [id])
  if (genres.length === 0) return reply.status(404).send({ error: 'Género no encontrado' })

  const [movies] = await db.execute(`
    SELECT m.id, m.title, m.year, m.rating FROM movies m
    JOIN movie_genres mg ON mg.movie_id = m.id
    WHERE mg.genre_id = ?
  `, [id])

  reply.send({ ...genres[0], movies })
}

export async function createGenre(request, reply) {
  const { name } = request.body

  const [existing] = await db.execute('SELECT id FROM genres WHERE name = ?', [name])
  if (existing.length > 0) return reply.status(409).send({ error: 'El género ya existe' })

  const [result] = await db.execute('INSERT INTO genres (name) VALUES (?)', [name])
  reply.status(201).send({ id: result.insertId, name })
}

export async function updateGenre(request, reply) {
  const { id } = request.params
  const [genres] = await db.execute('SELECT * FROM genres WHERE id = ?', [id])
  if (genres.length === 0) return reply.status(404).send({ error: 'Género no encontrado' })

  await db.execute('UPDATE genres SET name=? WHERE id=?', [request.body.name, id])
  reply.send({ message: 'Género actualizado', id: Number(id) })
}

export async function deleteGenre(request, reply) {
  const { id } = request.params
  const [genres] = await db.execute('SELECT id FROM genres WHERE id = ?', [id])
  if (genres.length === 0) return reply.status(404).send({ error: 'Género no encontrado' })

  await db.execute('DELETE FROM genres WHERE id = ?', [id])
  reply.send({ message: 'Género eliminado', id: Number(id) })
}