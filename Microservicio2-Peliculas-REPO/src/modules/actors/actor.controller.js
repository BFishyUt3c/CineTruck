import { db } from '../../db/database.js'

export async function getActors(request, reply) {
  const { page = 1, limit = 20, name } = request.query

  const pageNum  = parseInt(page, 10)
  const limitNum = parseInt(limit, 10)
  const offset   = (pageNum - 1) * limitNum

  let query = 'SELECT * FROM actors WHERE 1=1'
  const params = []

  if (name) {
    query += ' AND name LIKE ?'
    params.push(`%${name}%`)
  }

  query += ` LIMIT ${limitNum} OFFSET ${offset}`

  const [actors] = await db.query(query, params)

  const [total] = await db.query(
    'SELECT COUNT(*) as count FROM actors'
  )

  reply.send({
    data: actors,
    total: total[0].count,
    page: pageNum,
    limit: limitNum
  })
}

export async function getActorById(request, reply) {
  const { id } = request.params

  const [actors] = await db.execute('SELECT * FROM actors WHERE id = ?', [id])
  if (actors.length === 0) return reply.status(404).send({ error: 'Actor no encontrado' })

  const [movies] = await db.execute(`
    SELECT m.id, m.title, m.year, m.rating, ma.role FROM movies m
    JOIN movie_actors ma ON ma.movie_id = m.id
    WHERE ma.actor_id = ?
  `, [id])

  reply.send({ ...actors[0], movies })
}

export async function createActor(request, reply) {
  const { name, nationality, birth_date } = request.body

  const [existing] = await db.execute('SELECT id FROM actors WHERE name = ?', [name])
  if (existing.length > 0) return reply.status(409).send({ error: 'El actor ya existe' })

  const [result] = await db.execute(
    'INSERT INTO actors (name, nationality, birth_date) VALUES (?, ?, ?)',
    [name, nationality ?? null, birth_date ?? null]
  )

  reply.status(201).send({ id: result.insertId, name })
}

export async function updateActor(request, reply) {
  const { id } = request.params
  const [actors] = await db.execute('SELECT * FROM actors WHERE id = ?', [id])
  if (actors.length === 0) return reply.status(404).send({ error: 'Actor no encontrado' })

  const actor   = actors[0]
  const updated = { ...actor, ...request.body }

  await db.execute(
    'UPDATE actors SET name=?, nationality=?, birth_date=? WHERE id=?',
    [updated.name, updated.nationality, updated.birth_date, id]
  )

  reply.send({ message: 'Actor actualizado', id: Number(id) })
}

export async function deleteActor(request, reply) {
  const { id } = request.params
  const [actors] = await db.execute('SELECT id FROM actors WHERE id = ?', [id])
  if (actors.length === 0) return reply.status(404).send({ error: 'Actor no encontrado' })

  await db.execute('DELETE FROM actors WHERE id = ?', [id])
  reply.send({ message: 'Actor eliminado', id: Number(id) })
}