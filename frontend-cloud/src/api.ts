import axios from "axios";

// ================================
// BASE URLS — cada micro en su puerto real
// ================================

const BASE_URLS = {
  usuarios:  import.meta.env.VITE_USERS_URL  || "https://u6p8yge820.execute-api.us-east-1.amazonaws.com/users",
  peliculas: import.meta.env.VITE_MOVIES_URL || "https://u6p8yge820.execute-api.us-east-1.amazonaws.com/movies",
  foros:     import.meta.env.VITE_FOROS_URL  || "https://u6p8yge820.execute-api.us-east-1.amazonaws.com/foros",
  orquestador: import.meta.env.VITE_MS4_URL  || "https://u6p8yge820.execute-api.us-east-1.amazonaws.com/orquestador",
  analytics: import.meta.env.VITE_MS5_URL    || "https://u6p8yge820.execute-api.us-east-1.amazonaws.com/analytics",
};

// ================================
// AXIOS FACTORY
// ================================

const createAPI = (baseURL: string) => {
  const api = axios.create({
    baseURL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error("API ERROR:", error);
      if (error.response) {
        console.error("STATUS:", error.response.status);
        console.error("DATA:", error.response.data);
      }
      return Promise.reject(error);
    }
  );

  return api;
};

// ================================
// INSTANCIAS
// ================================

export const usersAPI       = createAPI(BASE_URLS.usuarios);
export const moviesAPI      = createAPI(BASE_URLS.peliculas);
export const forumsAPI      = createAPI(BASE_URLS.foros);
export const ms4API         = createAPI(BASE_URLS.orquestador);
export const analyticsAPI   = createAPI(BASE_URLS.analytics);

// Helper para adjuntar Authorization header en tiempo de ejecución
const authHeader = (token: string) => ({ headers: { Authorization: token } });

//
// =========================================
// MICRO 1 — USERS SERVICE  (puerto 8000)
// =========================================
//

/** GET /auth/me  → usuario actual */
export const getMe = (token: string) =>
  usersAPI.get("/auth/me", authHeader(token));

/** GET /auth/login  → login con Basic auth */
export const loginBasic = (token: string) =>
  usersAPI.get("/auth/login", authHeader(token));

/** POST /auth/registro  → { nombre, email, password, pais } */
export const register = (data: {
  nombre: string;
  email: string;
  password: string;
  pais: string;
}) => usersAPI.post("/auth/registro", data);

/** GET /usuarios  (admin) */
export const getUsers = (token: string) =>
  usersAPI.get("/usuarios", authHeader(token));

/** GET /usuarios/:id */
export const getUser = (id: number, token: string) =>
  usersAPI.get(`/usuarios/${id}`, authHeader(token));

/** PUT /usuarios/:id  → { nombre, pais } (y opcionalmente password) */
export const updateUser = (
  id: number,
  data: { nombre: string; pais: string; password?: string },
  token: string
) => usersAPI.put(`/usuarios/${id}`, data, authHeader(token));

/** DELETE /usuarios/:id */
export const deleteUser = (id: number, token: string) =>
  usersAPI.delete(`/usuarios/${id}`, authHeader(token));

/** GET /usuarios/:id/peliculas_vistas */
export const getPeliculasVistas = (id: number, token: string) =>
  usersAPI.get(`/usuarios/${id}/peliculas_vistas`, authHeader(token));

/** POST /interno/usuarios/:userId/vista/:peliculaId  (sin auth requerida) */
export const marcarVista = (userId: number, peliculaId: number) =>
  usersAPI.post(`/interno/usuarios/${userId}/vista/${peliculaId}`);

/** DELETE /interno/usuarios/:userId/vista/:peliculaId */
export const quitarVista = (userId: number, peliculaId: number) =>
  usersAPI.delete(`/interno/usuarios/${userId}/vista/${peliculaId}`);

//
// =========================================
// MICRO 2 — MOVIES SERVICE  (puerto 3000)
// =========================================
//

/** GET /api/todos_los_registros  → dump completo de películas */
export const getAllMoviesDump = () =>
  moviesAPI.get("/api/todos_los_registros");

/** GET /api/movies?page=&size= */
export const getMovies = (page = 0, size = 20) =>
  moviesAPI.get(`/api/movies?page=${page}&size=${size}`);

/** GET /api/movies/:id */
export const getMovie = (id: number) =>
  moviesAPI.get(`/api/movies/${id}`);

/** POST /api/movies */
export const createMovie = (data: unknown) =>
  moviesAPI.post("/api/movies", data);

/** PUT /api/movies/:id */
export const updateMovie = (id: number, data: unknown) =>
  moviesAPI.put(`/api/movies/${id}`, data);

/** DELETE /api/movies/:id */
export const deleteMovie = (id: number) =>
  moviesAPI.delete(`/api/movies/${id}`);

// — Géneros —
export const getGenres     = ()                      => moviesAPI.get("/api/genres");
export const getGenre      = (id: number)            => moviesAPI.get(`/api/genres/${id}`);
export const createGenre   = (data: unknown)         => moviesAPI.post("/api/genres", data);
export const updateGenre   = (id: number, data: unknown) => moviesAPI.put(`/api/genres/${id}`, data);
export const deleteGenre   = (id: number)            => moviesAPI.delete(`/api/genres/${id}`);

// Asociar/desasociar género a película
export const addGenreToMovie    = (movieId: number, genreId: number) => moviesAPI.post(`/api/movies/${movieId}/genres/${genreId}`);
export const removeGenreFromMovie = (movieId: number, genreId: number) => moviesAPI.delete(`/api/movies/${movieId}/genres/${genreId}`);

// — Directores —
export const getDirectors  = ()                      => moviesAPI.get("/api/directors");
export const getDirector   = (id: number)            => moviesAPI.get(`/api/directors/${id}`);
export const createDirector = (data: unknown)        => moviesAPI.post("/api/directors", data);
export const updateDirector = (id: number, data: unknown) => moviesAPI.put(`/api/directors/${id}`, data);
export const deleteDirector = (id: number)           => moviesAPI.delete(`/api/directors/${id}`);

export const addDirectorToMovie     = (movieId: number, directorId: number) => moviesAPI.post(`/api/movies/${movieId}/directors/${directorId}`);
export const removeDirectorFromMovie = (movieId: number, directorId: number) => moviesAPI.delete(`/api/movies/${movieId}/directors/${directorId}`);

// — Actores —
export const getActors   = ()                        => moviesAPI.get("/api/actors");
export const getActor    = (id: number)              => moviesAPI.get(`/api/actors/${id}`);
export const createActor = (data: unknown)           => moviesAPI.post("/api/actors", data);
export const updateActor = (id: number, data: unknown) => moviesAPI.put(`/api/actors/${id}`, data);
export const deleteActor = (id: number)              => moviesAPI.delete(`/api/actors/${id}`);

export const addActorToMovie     = (movieId: number, actorId: number) => moviesAPI.post(`/api/movies/${movieId}/actors/${actorId}`);
export const removeActorFromMovie = (movieId: number, actorId: number) => moviesAPI.delete(`/api/movies/${movieId}/actors/${actorId}`);

// — Reseñas —
/** GET /api/movies/:id/reviews */
export const getReviews = (movieId: number) =>
  moviesAPI.get(`/api/movies/${movieId}/reviews`);

/** POST /api/movies/:id/reviews  → { author, rating, comment } */
export const createReview = (
  movieId: number,
  data: { author: string; rating: number; comment: string }
) => moviesAPI.post(`/api/movies/${movieId}/reviews`, data);

/** PUT /api/reviews/:id */
export const updateReview = (id: number, data: unknown) =>
  moviesAPI.put(`/api/reviews/${id}`, data);

/** DELETE /api/reviews/:id */
export const deleteReview = (id: number) =>
  moviesAPI.delete(`/api/reviews/${id}`);

//
// =========================================
// MICRO 3 — FOROS SERVICE  (puerto 8080)
// =========================================
//

// — Threads —
/** GET /api/threads  → lista completa sin paginar */
export const getThreadsAll = () =>
  forumsAPI.get("/api/threads");

/** GET /api/threads/all?page=&size= → paginado */
export const getThreadsPaginated = (page = 0, size = 10) =>
  forumsAPI.get(`/api/threads/all?page=${page}&size=${size}`);

/** GET /api/threads/:id */
export const getThread = (id: string) =>
  forumsAPI.get(`/api/threads/${id}`);

/** GET /api/threads/movie/:movieId */
export const getThreadsByMovie = (movieId: string) =>
  forumsAPI.get(`/api/threads/movie/${movieId}`);

/** POST /api/threads  → { userId, movieId, title, body } */
export const createThread = (data: {
  userId: string;
  movieId: string;
  title: string;
  body: string;
}) => forumsAPI.post("/api/threads", data);

/** DELETE /api/threads/:id */
export const deleteThread = (id: string) =>
  forumsAPI.delete(`/api/threads/${id}`);

// — Posts —
/** GET /api/posts/all?page=&size= */
export const getPostsPaginated = (page = 0, size = 10) =>
  forumsAPI.get(`/api/posts/all?page=${page}&size=${size}`);

/** GET /api/posts/thread/:threadId */
export const getPostsByThread = (threadId: string) =>
  forumsAPI.get(`/api/posts/thread/${threadId}`);

/** GET /api/posts/:id */
export const getPost = (id: string) =>
  forumsAPI.get(`/api/posts/${id}`);

/** POST /api/posts  → { threadId, userId, body } */
export const createPost = (data: {
  threadId: string;
  userId: string;
  body: string;
}) => forumsAPI.post("/api/posts", data);

/** DELETE /api/posts/:id */
export const deletePost = (id: string) =>
  forumsAPI.delete(`/api/posts/${id}`);

// — Messages —
/** GET /api/messages/thread/:threadId */
export const getMessagesByThread = (threadId: string) =>
  forumsAPI.get(`/api/messages/thread/${threadId}`);

/** POST /api/messages */
export const createMessage = (data: unknown) =>
  forumsAPI.post("/api/messages", data);

/** DELETE /api/messages/:id */
export const deleteMessage = (id: string) =>
  forumsAPI.delete(`/api/messages/${id}`);

//
// =========================================
// MICRO 4 — ORQUESTADOR  (puerto 8004)
// =========================================
//

/** GET /api/v1/users/:userId → perfil completo */
export const getUserProfile = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}`);

/** GET /api/v1/users/:userId/stats */
export const getUserStats = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/stats`);

/** GET /api/v1/users/:userId/history */
export const getUserHistory = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/history`);

/** GET /api/v1/users/:userId/groups  → threads disponibles */
export const getUserGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/groups`);

/** GET /api/v1/users/:userId/created-groups */
export const getCreatedGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/created-groups`);

/** GET /api/v1/users/:userId/participated-groups */
export const getParticipatedGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/participated-groups`);

/** GET /api/v1/users/:userId/top-genres */
export const getUserTopGenres = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/top-genres`);

/** GET /api/v1/movies/stats */
export const getMovieStats = () =>
  ms4API.get("/api/v1/movies/stats");

//
// =========================================
// MICRO 5 — ANALYTICS / DATALAKE  (puerto 8005)
// =========================================
//

// — Películas —
/** GET /api/peliculas/top-calificadas */
export const getTopCalificadas = () =>
  analyticsAPI.get("/api/peliculas/top-calificadas");

/** GET /api/peliculas/completa */
export const getPeliculasCompleta = () =>
  analyticsAPI.get("/api/peliculas/completa");

/** GET /api/peliculas/actores-top */
export const getActoresTop = () =>
  analyticsAPI.get("/api/peliculas/actores-top");

/** GET /api/peliculas/generos */
export const getPeliculasPorGenero = () =>
  analyticsAPI.get("/api/peliculas/generos");

/** GET /api/peliculas/directores-top */
export const getDirectoresTop = () =>
  analyticsAPI.get("/api/peliculas/directores-top");

// — Usuarios —
/** GET /api/usuarios/por-pais */
export const getUsuariosPorPais = () =>
  analyticsAPI.get("/api/usuarios/por-pais");

/** GET /api/usuarios/peliculas-vistas-top */
export const getUsuariosPeliculasVistasTop = () =>
  analyticsAPI.get("/api/usuarios/peliculas-vistas-top");

/** GET /api/usuarios/resumen */
export const getUsuariosResumen = () =>
  analyticsAPI.get("/api/usuarios/resumen");

// — Foros —
/** GET /api/foros/mas-activos */
export const getForosMasActivos = () =>
  analyticsAPI.get("/api/foros/mas-activos");

/** GET /api/foros/actividad */
export const getForosActividad = () =>
  analyticsAPI.get("/api/foros/actividad");

/** GET /api/foros/resumen */
export const getForosResumen = () =>
  analyticsAPI.get("/api/foros/resumen");

/** GET /api/foros/por-pelicula/:movie_id */
export const getForosPorPelicula = (movieId: number | string) =>
  analyticsAPI.get(`/api/foros/por-pelicula/${movieId}`);