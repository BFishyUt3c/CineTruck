import { db, initDB } from './database.js'

const genres = [
  'Acción', 'Drama', 'Comedia', 'Terror', 'Ciencia Ficción',
  'Romance', 'Thriller', 'Animación', 'Documental', 'Fantasía',
  'Aventura', 'Crimen', 'Misterio', 'Biografía', 'Historia'
]

const directors = [
  { name: 'Christopher Nolan',    nationality: 'Británico',      birth_date: '1970-07-30' },
  { name: 'Denis Villeneuve',     nationality: 'Canadiense',     birth_date: '1967-10-03' },
  { name: 'Martin Scorsese',      nationality: 'Estadounidense', birth_date: '1942-11-17' },
  { name: 'Quentin Tarantino',    nationality: 'Estadounidense', birth_date: '1963-03-27' },
  { name: 'Steven Spielberg',     nationality: 'Estadounidense', birth_date: '1946-12-18' },
  { name: 'Pedro Almodóvar',      nationality: 'Español',        birth_date: '1949-09-25' },
  { name: 'Bong Joon-ho',         nationality: 'Surcoreano',     birth_date: '1969-09-14' },
  { name: 'Alfonso Cuarón',       nationality: 'Mexicano',       birth_date: '1961-11-28' },
  { name: 'James Cameron',        nationality: 'Canadiense',     birth_date: '1954-08-16' },
  { name: 'Ridley Scott',         nationality: 'Británico',      birth_date: '1937-11-30' },
  { name: 'David Fincher',        nationality: 'Estadounidense', birth_date: '1962-08-28' },
  { name: 'Stanley Kubrick',      nationality: 'Estadounidense', birth_date: '1928-07-26' },
  { name: 'Francis Ford Coppola', nationality: 'Estadounidense', birth_date: '1939-04-07' },
  { name: 'Guillermo del Toro',   nationality: 'Mexicano',       birth_date: '1964-10-09' },
  { name: 'Wes Anderson',         nationality: 'Estadounidense', birth_date: '1969-05-01' }
]

const actors = [
  { name: 'Leonardo DiCaprio',  nationality: 'Estadounidense', birth_date: '1974-11-11' },
  { name: 'Meryl Streep',       nationality: 'Estadounidense', birth_date: '1949-06-22' },
  { name: 'Tom Hanks',          nationality: 'Estadounidense', birth_date: '1956-07-09' },
  { name: 'Cate Blanchett',     nationality: 'Australiana',    birth_date: '1969-05-14' },
  { name: 'Joaquin Phoenix',    nationality: 'Estadounidense', birth_date: '1974-10-28' },
  { name: 'Natalie Portman',    nationality: 'Israelí',        birth_date: '1981-06-09' },
  { name: 'Denzel Washington',  nationality: 'Estadounidense', birth_date: '1954-12-28' },
  { name: 'Scarlett Johansson', nationality: 'Estadounidense', birth_date: '1984-11-22' },
  { name: 'Brad Pitt',          nationality: 'Estadounidense', birth_date: '1963-12-18' },
  { name: 'Charlize Theron',    nationality: 'Sudafricana',    birth_date: '1975-08-07' },
  { name: 'Robert De Niro',     nationality: 'Estadounidense', birth_date: '1943-08-17' },
  { name: 'Cillian Murphy',     nationality: 'Irlandés',       birth_date: '1976-05-25' },
  { name: 'Timothée Chalamet',  nationality: 'Estadounidense', birth_date: '1995-12-27' },
  { name: 'Zendaya',            nationality: 'Estadounidense', birth_date: '1996-09-01' },
  { name: 'Ana de Armas',       nationality: 'Cubana',         birth_date: '1988-04-30' },
  { name: 'Ryan Gosling',       nationality: 'Canadiense',     birth_date: '1980-11-12' },
  { name: 'Emma Stone',         nationality: 'Estadounidense', birth_date: '1988-11-06' },
  { name: 'Florence Pugh',      nationality: 'Británica',      birth_date: '1996-01-03' },
  { name: 'Tom Holland',        nationality: 'Británico',      birth_date: '1996-06-01' },
  { name: 'Margot Robbie',      nationality: 'Australiana',    birth_date: '1990-07-02' }
]

const authors  = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Pedro', 'Laura', 'Diego', 'Valeria']
const comments = [
  'Una obra maestra del cine moderno.',
  'Actuaciones increíbles, historia muy bien contada.',
  'Visualmente impresionante, aunque algo lenta.',
  'No me esperaba ese final, excelente.',
  'La mejor película que he visto en años.',
  'Muy entretenida, la recomiendo.',
  'Historia profunda con personajes bien desarrollados.',
  'Fotografía y dirección excepcionales.',
  'Me dejó pensando días después de verla.',
  'Superó todas mis expectativas.'
]

async function getOrCreate(table, field, value, extra = {}) {
  const [rows] = await db.execute(`SELECT * FROM ${table} WHERE ${field} = ?`, [value])
  if (rows.length > 0) return rows[0]
  const fields  = [field, ...Object.keys(extra)]
  const values  = [value, ...Object.values(extra)]
  const [result] = await db.execute(
    `INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
    values
  )
  return { id: result.insertId, [field]: value, ...extra }
}

export async function seedDatabase() {

console.log('Verificando si ya existe data...')
try {
  const [rows] = await db.execute('SELECT COUNT(*) as total FROM movies')
  const total = Array.isArray(rows) && rows[0] ? Number(rows[0].total) : 0
  if (total > 0) {
    console.log(`Seed omitido: ya existen ${total} peliculas en la BD.`)
    return
  }
} catch (e) {
  console.log('No se pudo verificar movies, se intentara seed igual.')
}

console.log('Insertando géneros...')
const genreIds = {}
for (const name of genres) {
  const g = await getOrCreate('genres', 'name', name)
  genreIds[name] = g.id
}

console.log('Insertando directores...')
const directorIds = []
for (const d of directors) {
  const dir = await getOrCreate('directors', 'name', d.name, { nationality: d.nationality, birth_date: d.birth_date })
  directorIds.push(dir.id)
}

console.log('Insertando actores...')
const actorIds = []
for (const a of actors) {
  const act = await getOrCreate('actors', 'name', a.name, { nationality: a.nationality, birth_date: a.birth_date })
  actorIds.push(act.id)
}

console.log('Insertando 20,000 películas...')
const genreNames = Object.keys(genreIds)

for (let i = 1; i <= 20000; i++) {
  const year     = 1950 + Math.floor(Math.random() * 75)
  const duration = 80   + Math.floor(Math.random() * 120)
  const title    = `Película ${i} (${year})`
  const synopsis = `Sinopsis de la película número ${i}.`

  const [result]  = await db.execute(
    'INSERT INTO movies (title, year, duration, synopsis) VALUES (?, ?, ?, ?)',
    [title, year, duration, synopsis]
  )
  const movieId = result.insertId

  const numGenres  = 1 + Math.floor(Math.random() * 3)
  const usedGenres = new Set()
  for (let g = 0; g < numGenres; g++) {
    const gName = genreNames[Math.floor(Math.random() * genreNames.length)]
    if (!usedGenres.has(gName)) {
      await db.execute('INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)', [movieId, genreIds[gName]])
      usedGenres.add(gName)
    }
  }

  const dId = directorIds[Math.floor(Math.random() * directorIds.length)]
  await db.execute('INSERT IGNORE INTO movie_directors (movie_id, director_id) VALUES (?, ?)', [movieId, dId])

  const numActors  = 1 + Math.floor(Math.random() * 4)
  const usedActors = new Set()
  for (let a = 0; a < numActors; a++) {
    const aId = actorIds[Math.floor(Math.random() * actorIds.length)]
    if (!usedActors.has(aId)) {
      await db.execute('INSERT IGNORE INTO movie_actors (movie_id, actor_id, role) VALUES (?, ?, ?)', [movieId, aId, `Personaje ${a + 1}`])
      usedActors.add(aId)
    }
  }

  const numReviews = 1 + Math.floor(Math.random() * 5)
  for (let r = 0; r < numReviews; r++) {
    const author  = authors[Math.floor(Math.random() * authors.length)]
    const rating  = Math.round(Math.random() * 100) / 10
    const comment = comments[Math.floor(Math.random() * comments.length)]
    await db.execute(
      'INSERT INTO reviews (movie_id, author, rating, comment) VALUES (?, ?, ?, ?)',
      [movieId, author, rating, comment]
    )
  }

  if (i % 1000 === 0) console.log(`${i}/20000 películas insertadas...`)
}

console.log('Seed completado.')
}

// Si se ejecuta directamente (CLI)
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log('\nIniciando seed database...\n')
    await initDB()
    await seedDatabase()
    console.log('\nSeed completado exitosamente\n')
    process.exit(0)
  } catch (err) {
    console.error('Error en seed:', err)
    process.exit(1)
  }
}
