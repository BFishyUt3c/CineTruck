import mysql from 'mysql2/promise'
import 'dotenv/config'

export let db

export async function initDB() {
  // Primero conectarse sin especificar BD para crearla
  const tempPool = await mysql.createPool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 1
  })

  // Crear BD si no existe
  await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``)
  await tempPool.end()

  // Ahora conectar con la BD ya existente
  db = await mysql.createPool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  })

  await db.execute(`
    CREATE TABLE IF NOT EXISTS directors (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      name        VARCHAR(255) NOT NULL UNIQUE,
      nationality VARCHAR(100),
      birth_date  DATE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS genres (
      id   INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actors (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      name        VARCHAR(255) NOT NULL UNIQUE,
      nationality VARCHAR(100),
      birth_date  DATE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS movies (
      id         INT PRIMARY KEY AUTO_INCREMENT,
      title      VARCHAR(255) NOT NULL,
      year       INT NOT NULL,
      duration   INT,
      synopsis   TEXT,
      rating     DECIMAL(3,1) DEFAULT 0,
      poster_url VARCHAR(500)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id         INT PRIMARY KEY AUTO_INCREMENT,
      movie_id   INT NOT NULL,
      author     VARCHAR(255) NOT NULL,
      rating     DECIMAL(3,1) NOT NULL CHECK(rating >= 0 AND rating <= 10),
      comment    TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS movie_directors (
      movie_id    INT NOT NULL,
      director_id INT NOT NULL,
      PRIMARY KEY (movie_id, director_id),
      FOREIGN KEY (movie_id)    REFERENCES movies(id)    ON DELETE CASCADE,
      FOREIGN KEY (director_id) REFERENCES directors(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS movie_genres (
      movie_id INT NOT NULL,
      genre_id INT NOT NULL,
      PRIMARY KEY (movie_id, genre_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id)  ON DELETE CASCADE,
      FOREIGN KEY (genre_id) REFERENCES genres(id)  ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS movie_actors (
      movie_id INT NOT NULL,
      actor_id INT NOT NULL,
      role     VARCHAR(255),
      PRIMARY KEY (movie_id, actor_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id)  ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(id)  ON DELETE CASCADE
    )
  `)

  await db.query(`
    CREATE TRIGGER IF NOT EXISTS update_rating_on_insert
    AFTER INSERT ON reviews
    FOR EACH ROW
    UPDATE movies
    SET rating = (
      SELECT ROUND(AVG(rating), 1)
      FROM reviews WHERE movie_id = NEW.movie_id
    )
    WHERE id = NEW.movie_id
  `)

  await db.query(`
    CREATE TRIGGER IF NOT EXISTS update_rating_on_update
    AFTER UPDATE ON reviews
    FOR EACH ROW
    UPDATE movies
    SET rating = (
      SELECT ROUND(AVG(rating), 1)
      FROM reviews WHERE movie_id = NEW.movie_id
    )
    WHERE id = NEW.movie_id
  `)

  await db.query(`
    CREATE TRIGGER IF NOT EXISTS update_rating_on_delete
    AFTER DELETE ON reviews
    FOR EACH ROW
    UPDATE movies
    SET rating = (
      SELECT ROUND(AVG(rating), 1)
      FROM reviews WHERE movie_id = OLD.movie_id
    )
    WHERE id = OLD.movie_id
  `)

  console.log('Base de datos inicializada')
}