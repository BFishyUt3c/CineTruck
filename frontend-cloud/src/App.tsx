import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8004';

type Tab = 'inicio' | 'peliculas' | 'foro' | 'perfil' | 'analytics';

interface Movie {
  id: number;
  title?: string;
  titulo?: string;
  description?: string;
  descripcion?: string;
  synopsis?: string;
  poster?: string;
  poster_url?: string;
  backdrop?: string;
  year?: number;
  año?: number;
  duration?: number;
  duracion?: number;
  rating?: number;
  genres?: Array<{ id?: number; name?: string } | string>;
  directors?: Array<{ id?: number; name?: string } | string>;
  actors?: Array<{ id?: number; name?: string } | string>;
}

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  pais: string;
  rol?: string;
  fecha_registro?: string;
}

interface Thread {
  id?: string;
  _id?: string;
  userId?: string | number;
  movieId?: string | number;
  title?: string;
  body?: string;
}

interface PostItem {
  id?: string;
  _id?: string;
  threadId?: string;
  userId?: string | number;
  body?: string;
  date?: string;
}

interface TrendingTalkItem {
  movie_id: number | string;
  score: number;
  threads: number;
  posts: number;
  mensajes: number;
  movie?: Movie;
}

interface DashboardHome {
  hero_movie?: Movie;
  trending_talk?: TrendingTalkItem[];
  movies_total?: number;
  threads_total?: number;
  posts_total?: number;
  messages_total?: number;
}

interface AnalyticsStats {
  total_peliculas?: number;
  top_generos?: Array<{ nombre: string; cantidad: number }>;
  top_actores?: Array<{ nombre: string; cantidad: number }>;
  top_directores?: Array<{ nombre: string; cantidad: number }>;
}

interface ReviewItem {
  id?: string | number;
  author?: string;
  rating?: number;
  comment?: string;
  created_at?: string;
  date?: string;
}

interface HistoryItem {
  id?: number;
  pelicula_id?: number;
  peliculaId?: number;
  fecha_vista?: string;
  fechaVista?: string;
  fecha?: string;
}

const authHeader = (email: string, password: string) =>
  `Basic ${btoa(`${email}:${password}`)}`;

const parseMovies = (payload: unknown): Movie[] => {
  const data = (payload as { data?: unknown[] })?.data ?? payload;
  if (!Array.isArray(data)) return [];
  return data
    .filter((m: unknown) => typeof (m as { id?: unknown })?.id === 'number')
    .map((raw) => {
      const m = raw as Movie;
      return {
        ...m,
        description: m.description ?? m.descripcion ?? m.synopsis,
        poster: m.poster ?? m.poster_url,
      } as Movie;
    });
};

const parseThreads = (payload: unknown): Thread[] => {
  if (Array.isArray(payload)) return payload as Thread[];
  const data = (payload as { data?: unknown[]; threads?: unknown[] })?.threads ?? (payload as { data?: unknown[] })?.data;
  return Array.isArray(data) ? (data as Thread[]) : [];
};

const parsePosts = (payload: unknown): PostItem[] => {
  if (Array.isArray(payload)) return payload as PostItem[];
  const data = (payload as { data?: unknown[]; content?: unknown[]; posts?: unknown[] })?.content
    ?? (payload as { data?: unknown[]; posts?: unknown[] })?.posts
    ?? (payload as { data?: unknown[] })?.data;
  return Array.isArray(data) ? (data as PostItem[]) : [];
};

const parseReviews = (payload: unknown): ReviewItem[] => {
  if (Array.isArray(payload)) return payload as ReviewItem[];
  const data = (payload as { reviews?: unknown[]; data?: { reviews?: unknown[] } })?.reviews
    ?? (payload as { data?: { reviews?: unknown[] } })?.data?.reviews;
  return Array.isArray(data) ? (data as ReviewItem[]) : [];
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getPrimaryGenre = (movie?: Movie | null) => {
  const genres = movie?.genres ?? [];
  const raw = genres[0];
  const name = typeof raw === 'string' ? raw : (raw?.name ?? '');
  return normalizeText(name);
};

const genreFallbackClass = (genre: string) => {
  if (genre.includes('accion') || genre.includes('action')) return 'genre-action';
  if (genre.includes('drama')) return 'genre-drama';
  if (genre.includes('comedia') || genre.includes('comedy')) return 'genre-comedy';
  if (genre.includes('terror') || genre.includes('horror')) return 'genre-horror';
  if (genre.includes('romance')) return 'genre-romance';
  if (genre.includes('ciencia') || genre.includes('sci-fi') || genre.includes('ficcion')) return 'genre-scifi';
  return 'genre-default';
};

export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [visibleMoviesCount, setVisibleMoviesCount] = useState(120);
  const [trendingTalk, setTrendingTalk] = useState<TrendingTalkItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardHome>({});
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [movieReviews, setMovieReviews] = useState<ReviewItem[]>([]);
  const [movieDetailLoading, setMovieDetailLoading] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: '' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');

  const [registro, setRegistro] = useState({ nombre: '', email: '', password: '', pais: '' });
  const [perfil, setPerfil] = useState({ nombre: '', email: '', pais: '', password: '' });
  const [perfilEdit, setPerfilEdit] = useState(false);
  const [threadDraft, setThreadDraft] = useState({ title: '', body: '', movieId: '' });
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadPosts, setThreadPosts] = useState<PostItem[]>([]);
  const [loadingThreadDetail, setLoadingThreadDetail] = useState(false);
  const [postDraft, setPostDraft] = useState({ body: '' });
  const [historialCount, setHistorialCount] = useState(0);
  const [historialPeliculas, setHistorialPeliculas] = useState<HistoryItem[]>([]);
  const [viewedMovieIds, setViewedMovieIds] = useState<number[]>([]);
  const [favoritas, setFavoritas] = useState<Movie[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const featured = useMemo(() => {
    if (trendingTalk.length > 0 && trendingTalk[0].movie) return trendingTalk[0].movie;
    return movies[0] ?? null;
  }, [movies, trendingTalk]);

  const catalogTotal = useMemo(
    () => Math.max(movies.length, dashboardStats.movies_total ?? 0),
    [movies.length, dashboardStats.movies_total],
  );

  const renderMovieVisual = (movie: Movie, big = false) => {
    const image = movie.backdrop || movie.poster || movie.poster_url;
    if (image) {
      return <img src={image} alt={movie.title || movie.titulo || 'Poster'} />;
    }

    const genreClass = genreFallbackClass(getPrimaryGenre(movie));
    return (
      <div className={`placeholder ${big ? 'big' : ''} poster-fallback ${genreClass}`}>
        <span className="poster-fallback__title">{movie.title || movie.titulo || 'Pelicula'}</span>
        <small>Sin poster oficial</small>
      </div>
    );
  };

  const loadBaseData = useCallback(async (auth?: string) => {
    try {
      const headers = auth ? { Authorization: auth } : undefined;
      const [dashboardRes, moviesRes, threadsRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dashboard/home?top=12`, { headers }),
        fetch(`${API_BASE}/api/v1/movies?limit=20000`),
        fetch(`${API_BASE}/api/v1/threads`),
        fetch(`${API_BASE}/api/v1/movies/stats`),
      ]);
      if (dashboardRes.ok) {
        const dashboard = (await dashboardRes.json()) as DashboardHome;
        setTrendingTalk(Array.isArray(dashboard.trending_talk) ? dashboard.trending_talk : []);
        setDashboardStats(dashboard);
      }
      if (moviesRes.ok) setMovies(parseMovies(await moviesRes.json()));
      if (threadsRes.ok) setThreads(parseThreads(await threadsRes.json()));
      if (analyticsRes.ok) {
        const payload = (await analyticsRes.json()) as AnalyticsStats;
        setAnalyticsStats(payload);
      } else {
        setAnalyticsStats(null);
      }
    } catch {
      setError('No se pudieron cargar peliculas o foro.');
    }
  }, []);

  const loadUserStats = useCallback(async (user: Usuario, auth: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/v1/usuarios/${user.id}/peliculas_vistas`, {
        headers: { Authorization: auth },
      });
      if (!resp.ok) return;
      const payload = await resp.json();
      if (Array.isArray(payload)) {
        setHistorialCount(payload.length);
        const items = payload
          .map((it: HistoryItem) => {
            const peliculaId = it.pelicula_id ?? it.peliculaId;
            const fechaVista = it.fecha_vista ?? it.fechaVista ?? it.fecha;
            return { ...it, pelicula_id: peliculaId, fecha_vista: fechaVista } as HistoryItem;
          })
          .filter((it: HistoryItem) => typeof it.pelicula_id === 'number');

        const sorted = items.sort((a, b) => {
          const ta = a.fecha_vista ? Date.parse(a.fecha_vista) : 0;
          const tb = b.fecha_vista ? Date.parse(b.fecha_vista) : 0;
          return tb - ta;
        });

        setHistorialPeliculas(sorted);

        const ids = payload
          .map((item: { pelicula_id?: number; peliculaId?: number; movie_id?: number }) => item?.pelicula_id ?? item?.peliculaId ?? item?.movie_id)
          .filter((id: unknown): id is number => typeof id === 'number');
        setViewedMovieIds(Array.from(new Set(ids)));
      } else {
        setHistorialCount(0);
        setHistorialPeliculas([]);
        setViewedMovieIds([]);
      }
    } catch {
      setHistorialCount(0);
      setHistorialPeliculas([]);
      setViewedMovieIds([]);
    }
  }, []);

  const loadFavorites = useCallback(async (user: Usuario, auth: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites?limit=12`, {
        headers: { Authorization: auth },
      });
      if (!resp.ok) return;
      const payload = await resp.json();
      const favs = parseMovies((payload as { data?: unknown[] })?.data ?? payload);
      setFavoritas(favs);
    } catch {
      setFavoritas([]);
    }
  }, []);

  const refreshMe = useCallback(async (auth: string) => {
    const resp = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) throw new Error('Sesion invalida');
    const me = (await resp.json()) as Usuario;
    setUsuario(me);
    setPerfil({ nombre: me.nombre ?? '', email: me.email ?? '', pais: me.pais ?? '', password: '' });
    await loadUserStats(me, auth);
    await loadFavorites(me, auth);
  }, [loadFavorites, loadUserStats]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadBaseData();
      const savedEmail = localStorage.getItem('cine_email') ?? '';
      const savedPassword = localStorage.getItem('cine_password') ?? '';
      if (savedEmail && savedPassword) {
        const auth = authHeader(savedEmail, savedPassword);
        try {
          await refreshMe(auth);
          setEmail(savedEmail);
          setPassword(savedPassword);
          setToken(auth);
          await loadBaseData(auth);
        } catch {
          localStorage.removeItem('cine_email');
          localStorage.removeItem('cine_password');
        }
      }
      setLoading(false);
    };
    void init();
  }, [loadBaseData, refreshMe]);

  const doLogin = async () => {
    setError('');
    setInfo('');
    if (!email || !password) {
      setError('Completa correo y contrasena.');
      return;
    }
    const auth = authHeader(email, password);
    const resp = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Authorization: auth },
    });
    if (!resp.ok) {
      setError('Credenciales incorrectas.');
      return;
    }
    await refreshMe(auth);
    setToken(auth);
    localStorage.setItem('cine_email', email);
    localStorage.setItem('cine_password', password);
    await loadBaseData(auth);
    setTab('inicio');
  };

  const doRegister = async () => {
    setError('');
    if (!registro.nombre || !registro.email || !registro.password || !registro.pais) {
      setError('Completa todos los campos de registro.');
      return;
    }
    const resp = await fetch(`${API_BASE}/api/v1/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registro),
    });
    if (!resp.ok) {
      setError('No se pudo registrar usuario.');
      return;
    }
    setEmail(registro.email);
    setPassword(registro.password);
    setAuthMode('login');
    setInfo('Registro exitoso. Inicia sesion.');
  };

  const saveProfile = async () => {
    if (!usuario || !token) return;
    setError('');
    setInfo('');
    if (!perfil.nombre || !perfil.email || !perfil.pais) {
      setError('Nombre, correo y pais son obligatorios.');
      return;
    }
    const payload: Record<string, string> = {
      nombre: perfil.nombre,
      email: perfil.email,
      pais: perfil.pais,
    };
    if (perfil.password.trim()) payload.password = perfil.password.trim();

    const resp = await fetch(`${API_BASE}/api/v1/usuarios/${usuario.id}`, {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      setError('No se pudo actualizar perfil.');
      return;
    }
    const updated = (await resp.json()) as Usuario;
    setUsuario(updated);
    setPerfil((prev) => ({ ...prev, nombre: updated.nombre, email: updated.email, pais: updated.pais, password: '' }));
    const activePassword = payload.password ?? password;
    const newAuth = authHeader(updated.email, activePassword);
    setToken(newAuth);
    setEmail(updated.email);
    if (payload.password) setPassword(payload.password);
    localStorage.setItem('cine_email', updated.email);
    localStorage.setItem('cine_password', activePassword);
    setInfo('Perfil actualizado.');
    setPerfilEdit(false);
  };

  const markAsWatched = async (movieId: number) => {
    if (!usuario) return;
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/v1/users/${usuario.id}/vista/${movieId}`, { method: 'POST' });
      if (!resp.ok) {
        setError('No se pudo marcar como vista (o ya estaba marcada).');
        return;
      }
      if (token) {
        await loadUserStats(usuario, token);
        await loadFavorites(usuario, token);
      }
      setViewedMovieIds((prev) => (prev.includes(movieId) ? prev : [...prev, movieId]));
      setInfo('Marcada como vista.');
    } catch {
      setError('Error marcando como vista.');
    }
  };

  const createThread = async () => {
    if (!usuario) return;
    setError('');
    if (!threadDraft.title || !threadDraft.body || !threadDraft.movieId) {
      setError('Completa titulo, contenido y movieId.');
      return;
    }
    const resp = await fetch(`${API_BASE}/api/v1/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: String(usuario.id),
        movieId: threadDraft.movieId,
        title: threadDraft.title,
        body: threadDraft.body,
      }),
    });
    if (!resp.ok) {
      setError('No se pudo crear el thread.');
      return;
    }
    const created = (await resp.json()) as Thread;
    setThreads((prev) => [created, ...prev]);
    setThreadDraft({ title: '', body: '', movieId: '' });
    setInfo('Thread creado.');
  };

  const openMovieDetail = async (movie: Movie) => {
    setSelectedMovie(movie);
    setMovieDetailLoading(true);
    setMovieReviews([]);
    setReviewDraft({ rating: 5, comment: '' });
    try {
      const resp = await fetch(`${API_BASE}/api/v1/movies/${movie.id}`);
      if (!resp.ok) {
        setMovieDetailLoading(false);
        return;
      }
      const payload = (await resp.json()) as Movie & { reviews?: ReviewItem[] };
      setSelectedMovie((prev) => ({
        ...(prev ?? movie),
        ...payload,
        description: payload.description ?? payload.descripcion ?? payload.synopsis ?? prev?.description,
        poster: payload.poster ?? payload.poster_url ?? prev?.poster,
      }));
      setMovieReviews(parseReviews(payload));
    } catch {
      setMovieReviews([]);
    } finally {
      setMovieDetailLoading(false);
    }
  };

  const createReview = async () => {
    if (!selectedMovie || !usuario) return;
    const comment = reviewDraft.comment.trim();
    if (!comment) {
      setError('Escribe un comentario para la reseña.');
      return;
    }
    const rating = Math.max(1, Math.min(10, Number(reviewDraft.rating) || 1));
    setError('');
    const payload = {
      author: usuario.nombre,
      rating,
      comment,
    };
    const resp = await fetch(`${API_BASE}/api/v1/movies/${selectedMovie.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      setError('No se pudo publicar la reseña.');
      return;
    }
    const created = (await resp.json()) as ReviewItem;
    setMovieReviews((prev) => [created, ...prev]);
    setReviewDraft({ rating: 5, comment: '' });
    setInfo('Reseña publicada.');
  };

  const openThreadDetail = async (thread: Thread) => {
    const threadId = String(thread.id || thread._id || '');
    if (!threadId) {
      setError('Thread invalido.');
      return;
    }
    setSelectedThread(thread);
    setLoadingThreadDetail(true);
    setError('');
    try {
      const postsRes = await fetch(`${API_BASE}/api/v1/posts/thread/${threadId}`);
      if (postsRes.ok) setThreadPosts(parsePosts(await postsRes.json()));
      else setThreadPosts([]);
    } catch {
      setError('No se pudo cargar el detalle del thread.');
      setThreadPosts([]);
    } finally {
      setLoadingThreadDetail(false);
    }
  };

  const createPostForThread = async () => {
    if (!usuario || !selectedThread) return;
    const threadId = String(selectedThread.id || selectedThread._id || '');
    if (!threadId || !postDraft.body.trim()) {
      setError('Escribe el contenido del post.');
      return;
    }
    setError('');
    const payload = {
      threadId,
      userId: String(usuario.id),
      body: postDraft.body.trim(),
    };
    const resp = await fetch(`${API_BASE}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      setError('No se pudo crear el post.');
      return;
    }
    const created = (await resp.json()) as PostItem;
    setThreadPosts((prev) => [created, ...prev]);
    setPostDraft({ body: '' });
    setInfo('Post creado.');
  };

  const logout = () => {
    setUsuario(null);
    setToken('');
    setEmail('');
    setPassword('');
    setHistorialCount(0);
    setHistorialPeliculas([]);
    setSelectedThread(null);
    setThreadPosts([]);
    setPostDraft({ body: '' });
    setTab('inicio');
    localStorage.removeItem('cine_email');
    localStorage.removeItem('cine_password');
  };

  if (loading) {
    return <div className="loader">Cargando Cinetruck...</div>;
  }

  if (!usuario) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>CINETRUCK</h1>
          <p>Inicia sesion o registrate para entrar.</p>
          <div className="auth-switch">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Iniciar sesion</button>
            <button className={authMode === 'registro' ? 'active' : ''} onClick={() => setAuthMode('registro')}>Registrarse</button>
          </div>
          {authMode === 'login' ? (
            <div className="form">
              <input placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input type="password" placeholder="Contrasena" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button onClick={() => void doLogin()}>Entrar</button>
            </div>
          ) : (
            <div className="form">
              <input placeholder="Nombre" value={registro.nombre} onChange={(e) => setRegistro((p) => ({ ...p, nombre: e.target.value }))} />
              <input placeholder="Correo" value={registro.email} onChange={(e) => setRegistro((p) => ({ ...p, email: e.target.value }))} />
              <input type="password" placeholder="Contrasena" value={registro.password} onChange={(e) => setRegistro((p) => ({ ...p, password: e.target.value }))} />
              <input placeholder="Pais" value={registro.pais} onChange={(e) => setRegistro((p) => ({ ...p, pais: e.target.value }))} />
              <button onClick={() => void doRegister()}>Crear cuenta</button>
            </div>
          )}
          {error && <p className="msg error">{error}</p>}
          {info && <p className="msg ok">{info}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">CINETRUCK</div>
        <nav>
          <button className={tab === 'inicio' ? 'active' : ''} onClick={() => setTab('inicio')}>Inicio</button>
          <button className={tab === 'peliculas' ? 'active' : ''} onClick={() => setTab('peliculas')}>Peliculas</button>
          <button className={tab === 'foro' ? 'active' : ''} onClick={() => setTab('foro')}>Foro</button>
          <button className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>Perfil</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>
        </nav>
        <div className="userbox">
          <span>{usuario.nombre}</span>
          <button onClick={logout}>Salir</button>
        </div>
      </header>

      {error && <div className="msg error">{error}</div>}
      {info && <div className="msg ok">{info}</div>}

      {tab === 'inicio' && (
        <section className="hero">
          <div className="hero__overlay" />
          <div className="hero__content">
            <h1>{featured?.title || featured?.titulo || 'Catalogo de peliculas'}</h1>
            <p>{featured?.description || featured?.descripcion || 'Explora el contenido disponible en tu plataforma.'}</p>
            <button onClick={() => setTab('peliculas')}>Ver peliculas</button>
          </div>
        </section>
      )}

      {tab === 'inicio' && (
        <main className="section">
          <h2>Top peliculas mas habladas</h2>
          <div className="threads">
            {trendingTalk.slice(0, 8).map((item) => (
              <article className="thread" key={`${item.movie_id}`}>
                <h4>{item.movie?.title || item.movie?.titulo || `Pelicula ${item.movie_id}`}</h4>
                <p>Score social: {item.score}</p>
                <small>Threads: {item.threads} • Posts: {item.posts} • Mensajes: {item.mensajes}</small>
                <div style={{ marginTop: '.6rem', display: 'flex', gap: '.5rem' }}>
                  {item.movie && (
                    <button onClick={() => void openMovieDetail(item.movie!)}>Ver detalle</button>
                  )}
                  {typeof item.movie_id === 'number' && (
                    viewedMovieIds.includes(item.movie_id) ? (
                      <button className="ghost" disabled>Vista</button>
                    ) : (
                      <button onClick={() => void markAsWatched(item.movie_id as number)}>Marcar vista</button>
                    )
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="profile-box" style={{ marginTop: '1rem' }}>
            <p><strong>Catalogo total:</strong> {catalogTotal} peliculas</p>
            <p><strong>Foro:</strong> {dashboardStats.threads_total ?? threads.length} threads, {dashboardStats.posts_total ?? 0} posts, {dashboardStats.messages_total ?? 0} mensajes</p>
          </div>
        </main>
      )}

      {tab === 'peliculas' && (
        <main className="section">
          <h2>Peliculas disponibles</h2>
          <p style={{ color: '#bbb', marginTop: '-.4rem' }}>
            Mostrando {Math.min(visibleMoviesCount, movies.length)} de {catalogTotal} peliculas.
          </p>
          <div className="grid">
            {movies.slice(0, visibleMoviesCount).map((m) => (
              <article className="card" key={m.id} onClick={() => void openMovieDetail(m)}>
                {renderMovieVisual(m)}
                <h4>{m.title || m.titulo || 'Sin titulo'}</h4>
                <p>{m.year || m.año || 's/f'} • {m.duration || m.duracion || '?'} min</p>
              </article>
            ))}
          </div>
          {visibleMoviesCount < movies.length && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setVisibleMoviesCount((prev) => prev + 120)}>Cargar mas</button>
            </div>
          )}
        </main>
      )}

      {tab === 'foro' && (
        <main className="section">
          <h2>Foro</h2>
          <div className="thread-form">
            <input
              placeholder="Titulo del thread"
              value={threadDraft.title}
              onChange={(e) => setThreadDraft((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              placeholder="Movie ID (ej: 100)"
              value={threadDraft.movieId}
              onChange={(e) => setThreadDraft((p) => ({ ...p, movieId: e.target.value }))}
            />
            <textarea
              placeholder="Contenido"
              value={threadDraft.body}
              onChange={(e) => setThreadDraft((p) => ({ ...p, body: e.target.value }))}
            />
            <button onClick={() => void createThread()}>Publicar thread</button>
          </div>
          <div className="threads">
            {threads.slice(0, 50).map((t, idx) => (
              <article className="thread" key={t.id || t._id || idx}>
                <h4>{t.title || 'Sin titulo'}</h4>
                <p>{t.body || 'Sin contenido'}</p>
                <small>usuario {t.userId || 'N/A'} • movie {t.movieId || 'N/A'}</small>
                <div style={{ marginTop: '.6rem' }}>
                  <button className="ghost" onClick={() => void openThreadDetail(t)}>Ver detalle</button>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {tab === 'perfil' && (
        <main className="section">
          <h2>Perfil de usuario</h2>
          <div className="profile-box">
            <div className="profile-head">
              <div>
                <p><strong>ID:</strong> {usuario.id}</p>
                <p><strong>Correo:</strong> {usuario.email}</p>
                <p><strong>Rol:</strong> {usuario.rol || 'usuario'}</p>
                {usuario.fecha_registro && <p><strong>Registro:</strong> {usuario.fecha_registro}</p>}
                <p><strong>Peliculas vistas:</strong> {historialCount}</p>
              </div>
              <div className="profile-actions">
                {!perfilEdit ? (
                  <button onClick={() => setPerfilEdit(true)}>Editar perfil</button>
                ) : (
                  <div className="profile-actions__row">
                    <button className="ghost" onClick={() => { setPerfilEdit(false); setPerfil({ nombre: usuario.nombre, email: usuario.email, pais: usuario.pais, password: '' }); }}>Cancelar</button>
                    <button onClick={() => void saveProfile()}>Guardar</button>
                  </div>
                )}
              </div>
            </div>

            {perfilEdit && (
              <div className="form" style={{ marginTop: '.8rem' }}>
                <input value={perfil.nombre} onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre" />
                <input value={perfil.email} onChange={(e) => setPerfil((p) => ({ ...p, email: e.target.value }))} placeholder="Correo" />
                <input value={perfil.pais} onChange={(e) => setPerfil((p) => ({ ...p, pais: e.target.value }))} placeholder="Pais" />
                <input type="password" value={perfil.password} onChange={(e) => setPerfil((p) => ({ ...p, password: e.target.value }))} placeholder="Nueva contraseña (opcional)" />
              </div>
            )}
          </div>

          <h2 style={{ marginTop: '1.2rem' }}>Historial de vistas</h2>
          <div className="threads">
            {historialPeliculas.length === 0 ? (
              <div className="profile-box favorites-empty" style={{ gridColumn: '1 / -1' }}>
                <h3>Aun no tienes historial</h3>
                <p>Marca películas como “vista” para verlas aquí.</p>
              </div>
            ) : (
              historialPeliculas.slice(0, 12).map((h, idx) => {
                const pid = h.pelicula_id ?? h.peliculaId;
                if (typeof pid !== 'number') return null;
                const movie = movies.find((m) => m.id === pid);
                const fechaRaw = h.fecha_vista ?? h.fechaVista ?? h.fecha;
                const fecha = fechaRaw ? new Date(fechaRaw).toLocaleString() : '';
                return (
                  <article className="thread" key={`${pid}-${idx}`}>
                    <h4>{movie?.title || movie?.titulo || `Pelicula ${pid}`}</h4>
                    <p>{fecha ? `Visto: ${fecha}` : 'Visto recientemente'}</p>
                    <div style={{ marginTop: '.6rem' }}>
                      <button onClick={() => void openMovieDetail(movie ?? ({ id: pid } as Movie))}>Ver detalle</button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <h2 style={{ marginTop: '1.2rem' }}>Peliculas favoritas</h2>
          <div className="grid">
            {favoritas.length === 0 ? (
              <div className="profile-box favorites-empty">
                <h3>Aun no tienes Peliculas Favoritas</h3>
                <p>Empieza a explorar peliculas y marca las que te gustan para ver recomendaciones aqui.</p>
                <button onClick={() => setTab('peliculas')}>Ir a Peliculas para agregar</button>
              </div>
            ) : (
              favoritas.map((m) => (
                <article className="card" key={m.id} onClick={() => void openMovieDetail(m)}>
                  {renderMovieVisual(m)}
                  <h4>{m.title || m.titulo || 'Sin titulo'}</h4>
                  <p>{m.year || m.año || 's/f'} • {m.duration || m.duracion || '?'} min</p>
                </article>
              ))
            )}
          </div>
        </main>
      )}

      {tab === 'analytics' && (
        <main className="section">
          <h2>Analytics</h2>
          <div className="profile-box" style={{ marginBottom: '1rem' }}>
            <p><strong>Total peliculas analizadas:</strong> {analyticsStats?.total_peliculas ?? dashboardStats.movies_total ?? movies.length}</p>
            <p>Datos agregados reales desde MS4.</p>
          </div>
          <div className="threads">
            <article className="thread">
              <h4>Top generos</h4>
              {(analyticsStats?.top_generos ?? []).slice(0, 10).map((g) => (
                <p key={`g-${g.nombre}`}>{g.nombre}: {g.cantidad}</p>
              ))}
            </article>
            <article className="thread">
              <h4>Top actores</h4>
              {(analyticsStats?.top_actores ?? []).slice(0, 10).map((a) => (
                <p key={`a-${a.nombre}`}>{a.nombre}: {a.cantidad}</p>
              ))}
            </article>
            <article className="thread">
              <h4>Top directores</h4>
              {(analyticsStats?.top_directores ?? []).slice(0, 10).map((d) => (
                <p key={`d-${d.nombre}`}>{d.nombre}: {d.cantidad}</p>
              ))}
            </article>
          </div>
        </main>
      )}

      {selectedMovie && (
        <div className="modal" onClick={() => setSelectedMovie(null)}>
          <div className="modal-card movie-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedMovie(null)}>x</button>
            <div className="movie-modal__top">
              {renderMovieVisual(selectedMovie, true)}
              <h3>{selectedMovie.title || selectedMovie.titulo || 'Sin titulo'}</h3>
              <p>{selectedMovie.description || selectedMovie.descripcion || 'Sin descripcion'}</p>
              <div style={{ padding: '0 1rem .6rem' }}>
                <small><strong>Rating:</strong> {selectedMovie.rating ?? 's/r'}</small>
                <br />
                <small><strong>Generos:</strong> {(selectedMovie.genres ?? []).map((g) => typeof g === 'string' ? g : (g.name ?? '')).filter(Boolean).join(', ') || 'N/D'}</small>
                <br />
                <small><strong>Directores:</strong> {(selectedMovie.directors ?? []).map((d) => typeof d === 'string' ? d : (d.name ?? '')).filter(Boolean).join(', ') || 'N/D'}</small>
                <br />
                <small><strong>Actores:</strong> {(selectedMovie.actors ?? []).map((a) => typeof a === 'string' ? a : (a.name ?? '')).filter(Boolean).slice(0, 8).join(', ') || 'N/D'}</small>
              </div>
              <div className="thread-form" style={{ margin: '0 1rem 1rem' }}>
                <h4 style={{ margin: 0 }}>Publicar reseña</h4>
                <label>Rating (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.1}
                  value={reviewDraft.rating}
                  onChange={(e) => setReviewDraft((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                  placeholder="Ej: 8.5"
                />
                <label>Comentario</label>
                <textarea
                  placeholder="Tu comentario"
                  value={reviewDraft.comment}
                  onChange={(e) => setReviewDraft((prev) => ({ ...prev, comment: e.target.value }))}
                />
                <button onClick={() => void createReview()}>Publicar reseña</button>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <button onClick={() => void markAsWatched(selectedMovie.id)}>Marcar como vista</button>
              </div>
            </div>

            <div className="movie-modal__reviews">
              <h4 style={{ marginTop: 0 }}>Reseñas</h4>
              {movieDetailLoading ? (
                <p>Cargando reseñas...</p>
              ) : movieReviews.length === 0 ? (
                <p>Aun no hay reseñas para esta película.</p>
              ) : (
                <div className="threads">
                  {movieReviews.map((r, idx) => (
                    <article className="thread" key={r.id ?? idx}>
                      <p>{r.comment || 'Sin comentario'}</p>
                      <small>{r.author || 'Anonimo'} • Rating: {r.rating ?? 's/r'} {r.created_at || r.date ? `• ${r.created_at || r.date}` : ''}</small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedThread && (
        <div className="modal" onClick={() => { setSelectedThread(null); setThreadPosts([]); }}>
          <div className="modal-card thread-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => { setSelectedThread(null); setThreadPosts([]); }}>x</button>
            <div className="thread-detail">
              <div className="thread-detail__head">
                <div>
                  <h3>{selectedThread.title || 'Thread seleccionado'}</h3>
                  <p>{selectedThread.body || 'Sin contenido adicional.'}</p>
                </div>
              </div>

              {loadingThreadDetail ? (
                <p>Cargando detalle...</p>
              ) : (
                <section className="thread-detail__col">
                  <h4>Posts</h4>
                  <div className="thread-form">
                    <textarea
                      placeholder="Escribe un post para este thread"
                      value={postDraft.body}
                      onChange={(e) => setPostDraft({ body: e.target.value })}
                    />
                    <button onClick={() => void createPostForThread()}>Publicar post</button>
            </div>
                  <div className="threads">
                    {threadPosts.length === 0 ? <p>No hay posts aun.</p> : threadPosts.slice(0, 50).map((p, idx) => (
                      <article className="thread" key={p.id || p._id || idx}>
                        <p>{p.body || 'Sin contenido'}</p>
                        <small>usuario {p.userId || 'N/A'} {p.date ? `• ${p.date}` : ''}</small>
                      </article>
                    ))}
            </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
