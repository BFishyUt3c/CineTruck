import { db } from '../../db/database.js'

export async function getDirectors(request, reply) {
  const { page = 1, limit = 20, name } = request.query

  const pageNum  = Number(page)
  const limitNum = Number(limit)
  const offset   = (pageNum - 1) * limitNum

  let query = 'SELECT * FROM directors WHERE 1=1'
  const params = []

  if (name) {
    query += ' AND name LIKE ?'
    params.push(`%${name}%`)
  }

  query += ` LIMIT ${limitNum} OFFSET ${offset}`

  const [directors] = await db.query(query, params)

  const [total] = await db.query('SELECT COUNT(*) as count FROM directors')

  reply.send({
    data: directors,
    total: total[0].count,
    page: pageNum,
    limit: limitNum
  })
}

export async function getDirectorById(request, reply) {
  const { id } = request.params

  const [directors] = await db.execute('SELECT * FROM directors WHERE id = ?', [id])
  if (directors.length === 0) return reply.status(404).send({ error: 'Director no encontrado' })

  const [movies] = await db.execute(`
    SELECT m.id, m.title, m.year, m.rating FROM movies m
    JOIN movie_directors md ON md.movie_id = m.id
    WHERE md.director_id = ?
  `, [id])

  reply.send({ ...directors[0], movies })
}

export async function createDirector(request, reply) {
  const { name, nationality, birth_date } = request.body

  const [existing] = await db.execute('SELECT id FROM directors WHERE name = ?', [name])
  if (existing.length > 0) return reply.status(409).send({ error: 'El director ya existe' })

  const [result] = await db.execute(
    'INSERT INTO directors (name, nationality, birth_date) VALUES (?, ?, ?)',
    [name, nationality ?? null, birth_date ?? null]
  )

  reply.status(201).send({ id: result.insertId, name })
}

export async function updateDirector(request, reply) {
  const { id } = request.params
  const [directors] = await db.execute('SELECT * FROM directors WHERE id = ?', [id])
  if (directors.length === 0) return reply.status(404).send({ error: 'Director no encontrado' })

  const director = directors[0]
  const updated  = { ...director, ...request.body }

  await db.execute(
    'UPDATE directors SET name=?, nationality=?, birth_date=? WHERE id=?',
    [updated.name, updated.nationality, updated.birth_date, id]
  )

  reply.send({ message: 'Director actualizado', id: Number(id) })
}

export async function deleteDirector(request, reply) {
  const { id } = request.params
  const [directors] = await db.execute('SELECT id FROM directors WHERE id = ?', [id])
  if (directors.length === 0) return reply.status(404).send({ error: 'Director no encontrado' })

  await db.execute('DELETE FROM directors WHERE id = ?', [id])
  reply.send({ message: 'Director eliminado', id: Number(id) })
}