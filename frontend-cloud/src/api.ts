import axios from "axios";

// ================================
// BASE URLS — cada micro en su puerto real
// ================================

const BASE_URLS = {
  usuarios:  import.meta.env.VITE_USERS_URL  || "https://eak650mv9j.execute-api.us-east-1.amazonaws.com/users",
  peliculas: import.meta.env.VITE_MOVIES_URL || "https://eak650mv9j.execute-api.us-east-1.amazonaws.com/movies",
  foros:     import.meta.env.VITE_FOROS_URL  || "https://eak650mv9j.execute-api.us-east-1.amazonaws.com/foro",
  orquestador: import.meta.env.VITE_MS4_URL  || "https://eak650mv9j.execute-api.us-east-1.amazonaws.com/orquestador",
  analytics: import.meta.env.VITE_MS5_URL    || "https://eak650mv9j.execute-api.us-east-1.amazonaws.com/analytics",
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

//micro1
export const getMe = (token: string) =>
  usersAPI.get("/auth/me", authHeader(token));

export const loginBasic = (token: string) =>
  usersAPI.get("/auth/login", authHeader(token));

export const register = (data: {
  nombre: string;
  email: string;
  password: string;
  pais: string;
}) => usersAPI.post("/auth/registro", data);

export const getUsers = (token: string) =>
  usersAPI.get("/usuarios", authHeader(token));

export const getUser = (id: number, token: string) =>
  usersAPI.get(`/usuarios/${id}`, authHeader(token));

export const updateUser = (
  id: number,
  data: { nombre: string; pais: string; password?: string },
  token: string
) => usersAPI.put(`/usuarios/${id}`, data, authHeader(token));

export const deleteUser = (id: number, token: string) =>
  usersAPI.delete(`/usuarios/${id}`, authHeader(token));

export const getPeliculasVistas = (id: number, token: string) =>
  usersAPI.get(`/usuarios/${id}/peliculas_vistas`, authHeader(token));

export const marcarVista = (userId: number, peliculaId: number) =>
  usersAPI.post(`/interno/usuarios/${userId}/vista/${peliculaId}`);

export const quitarVista = (userId: number, peliculaId: number) =>
  usersAPI.delete(`/interno/usuarios/${userId}/vista/${peliculaId}`);

//micro2

export const getAllMoviesDump = () =>
  moviesAPI.get("/api/todos_los_registros");

export const getMovies = (page = 0, size = 20) =>
  moviesAPI.get(`/api/movies?page=${page}&size=${size}`);

export const getMovie = (id: number) =>
  moviesAPI.get(`/api/movies/${id}`);

export const createMovie = (data: unknown) =>
  moviesAPI.post("/api/movies", data);

export const updateMovie = (id: number, data: unknown) =>
  moviesAPI.put(`/api/movies/${id}`, data);

export const deleteMovie = (id: number) =>
  moviesAPI.delete(`/api/movies/${id}`);

export const getGenres     = ()                      => moviesAPI.get("/api/genres");
export const getGenre      = (id: number)            => moviesAPI.get(`/api/genres/${id}`);
export const createGenre   = (data: unknown)         => moviesAPI.post("/api/genres", data);
export const updateGenre   = (id: number, data: unknown) => moviesAPI.put(`/api/genres/${id}`, data);
export const deleteGenre   = (id: number)            => moviesAPI.delete(`/api/genres/${id}`);

export const addGenreToMovie    = (movieId: number, genreId: number) => moviesAPI.post(`/api/movies/${movieId}/genres/${genreId}`);
export const removeGenreFromMovie = (movieId: number, genreId: number) => moviesAPI.delete(`/api/movies/${movieId}/genres/${genreId}`);

export const getDirectors  = ()                      => moviesAPI.get("/api/directors");
export const getDirector   = (id: number)            => moviesAPI.get(`/api/directors/${id}`);
export const createDirector = (data: unknown)        => moviesAPI.post("/api/directors", data);
export const updateDirector = (id: number, data: unknown) => moviesAPI.put(`/api/directors/${id}`, data);
export const deleteDirector = (id: number)           => moviesAPI.delete(`/api/directors/${id}`);

export const addDirectorToMovie     = (movieId: number, directorId: number) => moviesAPI.post(`/api/movies/${movieId}/directors/${directorId}`);
export const removeDirectorFromMovie = (movieId: number, directorId: number) => moviesAPI.delete(`/api/movies/${movieId}/directors/${directorId}`);

export const getActors   = ()                        => moviesAPI.get("/api/actors");
export const getActor    = (id: number)              => moviesAPI.get(`/api/actors/${id}`);
export const createActor = (data: unknown)           => moviesAPI.post("/api/actors", data);
export const updateActor = (id: number, data: unknown) => moviesAPI.put(`/api/actors/${id}`, data);
export const deleteActor = (id: number)              => moviesAPI.delete(`/api/actors/${id}`);

export const addActorToMovie     = (movieId: number, actorId: number) => moviesAPI.post(`/api/movies/${movieId}/actors/${actorId}`);
export const removeActorFromMovie = (movieId: number, actorId: number) => moviesAPI.delete(`/api/movies/${movieId}/actors/${actorId}`);

export const getReviews = (movieId: number) =>
  moviesAPI.get(`/api/movies/${movieId}/reviews`);

export const createReview = (
  movieId: number,
  data: { author: string; rating: number; comment: string }
) => moviesAPI.post(`/api/movies/${movieId}/reviews`, data);

export const updateReview = (id: number, data: unknown) =>
  moviesAPI.put(`/api/reviews/${id}`, data);

export const deleteReview = (id: number) =>
  moviesAPI.delete(`/api/reviews/${id}`);

//micro3

export const getThreadsAll = () =>
  forumsAPI.get("/api/threads");

export const getThreadsPaginated = (page = 0, size = 10) =>
  forumsAPI.get(`/api/threads/all?page=${page}&size=${size}`);

export const getThread = (id: string) =>
  forumsAPI.get(`/api/threads/${id}`);

export const getThreadsByMovie = (movieId: string) =>
  forumsAPI.get(`/api/threads/movie/${movieId}`);

export const createThread = (data: {
  userId: string;
  movieId: string;
  title: string;
  body: string;
}) => forumsAPI.post("/api/threads", data);

export const deleteThread = (id: string) =>
  forumsAPI.delete(`/api/threads/${id}`);

export const getPostsPaginated = (page = 0, size = 10) =>
  forumsAPI.get(`/api/posts/all?page=${page}&size=${size}`);

export const getPostsByThread = (threadId: string) =>
  forumsAPI.get(`/api/posts/thread/${threadId}`);

export const getPost = (id: string) =>
  forumsAPI.get(`/api/posts/${id}`);

export const createPost = (data: {
  threadId: string;
  userId: string;
  body: string;
}) => forumsAPI.post("/api/posts", data);

export const deletePost = (id: string) =>
  forumsAPI.delete(`/api/posts/${id}`);

export const getMessagesByThread = (threadId: string) =>
  forumsAPI.get(`/api/messages/thread/${threadId}`);

export const createMessage = (data: unknown) =>
  forumsAPI.post("/api/messages", data);

export const deleteMessage = (id: string) =>
  forumsAPI.delete(`/api/messages/${id}`);

//micro4
export const getUserProfile = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}`);

export const getUserStats = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/stats`);

export const getUserHistory = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/history`);

export const getUserGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/groups`);

export const getCreatedGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/created-groups`);

export const getParticipatedGroups = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/participated-groups`);

export const getUserTopGenres = (userId: number) =>
  ms4API.get(`/api/v1/users/${userId}/top-genres`);

export const getMovieStats = () =>
  ms4API.get("/api/v1/movies/stats");

//micro5
export const getTopCalificadas = () =>
  analyticsAPI.get("/api/peliculas/top-calificadas");

export const getPeliculasCompleta = () =>
  analyticsAPI.get("/api/peliculas/completa");

export const getActoresTop = () =>
  analyticsAPI.get("/api/peliculas/actores-top");

export const getPeliculasPorGenero = () =>
  analyticsAPI.get("/api/peliculas/generos");

export const getDirectoresTop = () =>
  analyticsAPI.get("/api/peliculas/directores-top");

export const getUsuariosPorPais = () =>
  analyticsAPI.get("/api/usuarios/por-pais");

export const getUsuariosPeliculasVistasTop = () =>
  analyticsAPI.get("/api/usuarios/peliculas-vistas-top");

export const getUsuariosResumen = () =>
  analyticsAPI.get("/api/usuarios/resumen");

export const getForosMasActivos = () =>
  analyticsAPI.get("/api/foros/mas-activos");

export const getForosActividad = () =>
  analyticsAPI.get("/api/foros/actividad");

export const getForosResumen = () =>
  analyticsAPI.get("/api/foros/resumen");

export const getForosPorPelicula = (movieId: number | string) =>
  analyticsAPI.get(`/api/foros/por-pelicula/${movieId}`);