import { db } from '../../db/database.js'

async function getOrCreateGenre(name) {
  const [rows] = await db.execute('SELECT * FROM genres WHERE name = ?', [name])
  if (rows.length > 0) return rows[0]
  const [result] = await db.execute('INSERT INTO genres (name) VALUES (?)', [name])
  return { id: result.insertId, name }
}

async function getOrCreateDirector({ name, nationality, birth_date }) {
  const [rows] = await db.execute('SELECT * FROM directors WHERE name = ?', [name])
  if (rows.length > 0) return rows[0]
  const [result] = await db.execute(
    'INSERT INTO directors (name, nationality, birth_date) VALUES (?, ?, ?)',
    [name, nationality ?? null, birth_date ?? null]
  )
  return { id: result.insertId, name }
}

async function getOrCreateActor({ name, nationality, birth_date }) {
  const [rows] = await db.execute('SELECT * FROM actors WHERE name = ?', [name])
  if (rows.length > 0) return rows[0]
  const [result] = await db.execute(
    'INSERT INTO actors (name, nationality, birth_date) VALUES (?, ?, ?)',
    [name, nationality ?? null, birth_date ?? null]
  )
  return { id: result.insertId, name }
}

export async function getMovies(request, reply) {
  const { page = 1, limit = 20, year, title } = request.query

  const pageNum  = Number(page)
  const limitNum = Number(limit)
  const offset   = (pageNum - 1) * limitNum

  let query = 'SELECT * FROM movies WHERE 1=1'
  const params = []

  if (year) {
    query += ' AND year = ?'
    params.push(year)
  }

  if (title) {
    query += ' AND title LIKE ?'
    params.push(`%${title}%`)
  }

  query += ` LIMIT ${limitNum} OFFSET ${offset}`

  const [movies] = await db.query(query, params)
  const [total]  = await db.query('SELECT COUNT(*) as count FROM movies')

  reply.send({
    data: movies,
    total: total[0].count,
    page: pageNum,
    limit: limitNum
  })
}

export async function getMovieById(request, reply) {
  const { id } = request.params

  const [movies] = await db.execute('SELECT * FROM movies WHERE id = ?', [id])
  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })

  const movie = movies[0]

  const [directors] = await db.execute(`
    SELECT d.id, d.name, d.nationality, d.birth_date FROM directors d
    JOIN movie_directors md ON md.director_id = d.id
    WHERE md.movie_id = ?
  `, [id])

  const [genres] = await db.execute(`
    SELECT g.id, g.name FROM genres g
    JOIN movie_genres mg ON mg.genre_id = g.id
    WHERE mg.movie_id = ?
  `, [id])

  const [actors] = await db.execute(`
    SELECT a.id, a.name, a.nationality, a.birth_date, ma.role FROM actors a
    JOIN movie_actors ma ON ma.actor_id = a.id
    WHERE ma.movie_id = ?
  `, [id])

  const [reviews] = await db.execute(`
    SELECT id, author, rating, comment, created_at
    FROM reviews WHERE movie_id = ?
  `, [id])

  reply.send({ ...movie, genres, directors, actors, reviews })
}

export async function createMovie(request, reply) {
  const {
    title, year, duration, synopsis, poster_url,
    genres = [], directors = [], actors = []
  } = request.body

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.execute(
      'INSERT INTO movies (title, year, duration, synopsis, poster_url) VALUES (?, ?, ?, ?, ?)',
      [title, year, duration ?? null, synopsis ?? null, poster_url ?? null]
    )
    const movieId = result.insertId

    for (const genreName of genres) {
      const genre = await getOrCreateGenre(genreName)
      await conn.execute(
        'INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
        [movieId, genre.id]
      )
    }

    for (const directorData of directors) {
      const director = await getOrCreateDirector(directorData)
      await conn.execute(
        'INSERT IGNORE INTO movie_directors (movie_id, director_id) VALUES (?, ?)',
        [movieId, director.id]
      )
    }

    for (const actorData of actors) {
      const actor = await getOrCreateActor(actorData)
      await conn.execute(
        'INSERT IGNORE INTO movie_actors (movie_id, actor_id, role) VALUES (?, ?, ?)',
        [movieId, actor.id, actorData.role ?? null]
      )
    }

    await conn.commit()
    reply.status(201).send({ id: movieId, title })
  } catch (err) {
    await conn.rollback()
    reply.status(500).send({ error: 'Error al crear la película', detail: err.message })
  } finally {
    conn.release()
  }
}

export async function updateMovie(request, reply) {
  const { id } = request.params
  const [movies] = await db.execute('SELECT * FROM movies WHERE id = ?', [id])
  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })

  const movie = movies[0]
  const { title, year, duration, synopsis, poster_url, genres, directors, actors } = request.body

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const updated = {
      title:      title      ?? movie.title,
      year:       year       ?? movie.year,
      duration:   duration   ?? movie.duration,
      synopsis:   synopsis   ?? movie.synopsis,
      poster_url: poster_url ?? movie.poster_url
    }

    await conn.execute(
      'UPDATE movies SET title=?, year=?, duration=?, synopsis=?, poster_url=? WHERE id=?',
      [updated.title, updated.year, updated.duration, updated.synopsis, updated.poster_url, id]
    )

    if (genres) {
      await conn.execute('DELETE FROM movie_genres WHERE movie_id = ?', [id])
      for (const genreName of genres) {
        const genre = await getOrCreateGenre(genreName)
        await conn.execute(
          'INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)',
          [id, genre.id]
        )
      }
    }

    if (directors) {
      await conn.execute('DELETE FROM movie_directors WHERE movie_id = ?', [id])
      for (const directorData of directors) {
        const director = await getOrCreateDirector(directorData)
        await conn.execute(
          'INSERT IGNORE INTO movie_directors (movie_id, director_id) VALUES (?, ?)',
          [id, director.id]
        )
      }
    }

    if (actors) {
      await conn.execute('DELETE FROM movie_actors WHERE movie_id = ?', [id])
      for (const actorData of actors) {
        const actor = await getOrCreateActor(actorData)
        await conn.execute(
          'INSERT IGNORE INTO movie_actors (movie_id, actor_id, role) VALUES (?, ?, ?)',
          [id, actor.id, actorData.role ?? null]
        )
      }
    }

    await conn.commit()
    reply.send({ message: 'Película actualizada', id: Number(id) })
  } catch (err) {
    await conn.rollback()
    reply.status(500).send({ error: 'Error al actualizar la película', detail: err.message })
  } finally {
    conn.release()
  }
}

export async function deleteMovie(request, reply) {
  const [movies] = await db.execute('SELECT * FROM movies WHERE id = ?', [request.params.id])
  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })

  await db.execute('DELETE FROM movies WHERE id = ?', [request.params.id])
  reply.send({ message: 'Película eliminada', id: Number(request.params.id) })
}

export async function addDirectorToMovie(request, reply) {
  const { id } = request.params
  const { id: director_id } = request.body

  const [movies]    = await db.execute('SELECT id FROM movies    WHERE id = ?', [id])
  const [directors] = await db.execute('SELECT id FROM directors WHERE id = ?', [director_id])

  if (movies.length === 0)    return reply.status(404).send({ error: 'Película no encontrada' })
  if (directors.length === 0) return reply.status(404).send({ error: 'Director no encontrado' })

  await db.execute('INSERT IGNORE INTO movie_directors (movie_id, director_id) VALUES (?, ?)', [id, director_id])
  reply.status(201).send({ message: 'Director agregado a la película' })
}

export async function removeDirectorFromMovie(request, reply) {
  const { id, directorId } = request.params
  await db.execute('DELETE FROM movie_directors WHERE movie_id = ? AND director_id = ?', [id, directorId])
  reply.send({ message: 'Director eliminado de la película' })
}

export async function addGenreToMovie(request, reply) {
  const { id } = request.params
  const { id: genre_id } = request.body

  const [movies] = await db.execute('SELECT id FROM movies WHERE id = ?', [id])
  const [genres] = await db.execute('SELECT id FROM genres WHERE id = ?', [genre_id])

  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })
  if (genres.length === 0) return reply.status(404).send({ error: 'Género no encontrado' })

  await db.execute('INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)', [id, genre_id])
  reply.status(201).send({ message: 'Género agregado a la película' })
}

export async function removeGenreFromMovie(request, reply) {
  const { id, genreId } = request.params
  await db.execute('DELETE FROM movie_genres WHERE movie_id = ? AND genre_id = ?', [id, genreId])
  reply.send({ message: 'Género eliminado de la película' })
}

export async function addActorToMovie(request, reply) {
  const { id } = request.params
  const { id: actor_id, role } = request.body

  const [movies] = await db.execute('SELECT id FROM movies WHERE id = ?', [id])
  const [actors] = await db.execute('SELECT id FROM actors WHERE id = ?', [actor_id])

  if (movies.length === 0) return reply.status(404).send({ error: 'Película no encontrada' })
  if (actors.length === 0) return reply.status(404).send({ error: 'Actor no encontrado' })

  await db.execute('INSERT IGNORE INTO movie_actors (movie_id, actor_id, role) VALUES (?, ?, ?)', [id, actor_id, role ?? null])
  reply.status(201).send({ message: 'Actor agregado a la película' })
}

export async function removeActorFromMovie(request, reply) {
  const { id, actorId } = request.params
  await db.execute('DELETE FROM movie_actors WHERE movie_id = ? AND actor_id = ?', [id, actorId])
  reply.send({ message: 'Actor eliminado de la película' })
}