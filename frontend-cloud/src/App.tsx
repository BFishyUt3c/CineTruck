import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8004';

type Tab = 'inicio' | 'peliculas' | 'foro' | 'perfil';

interface Movie {
  id: number;
  title?: string;
  titulo?: string;
  description?: string;
  descripcion?: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  año?: number;
  duration?: number;
  duracion?: number;
}

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  pais: string;
  rol?: string;
}

interface Thread {
  id?: string;
  _id?: string;
  userId?: string | number;
  movieId?: string | number;
  title?: string;
  body?: string;
  votes?: number;
}

interface TrendingItem {
  movie_id: number | string;
  title: string;
  threads: number;
  posts: number;
  messages: number;
  votes: number;
  score: number;
}

interface MovieInsight {
  movie_id: number;
  title: string;
  threads: number;
  posts: number;
  messages: number;
  votes: number;
  views_sampled: number;
}

const authHeader = (email: string, password: string) =>
  `Basic ${btoa(`${email}:${password}`)}`;

const parseMovies = (payload: unknown): Movie[] => {
  const data = (payload as { data?: unknown[] })?.data ?? payload;
  if (!Array.isArray(data)) return [];
  return data.filter((m: unknown) => typeof (m as { id?: unknown })?.id === 'number') as Movie[];
};

const parseThreads = (payload: unknown): Thread[] => {
  if (Array.isArray(payload)) return payload as Thread[];
  const data = (payload as { data?: unknown[]; threads?: unknown[] })?.threads ?? (payload as { data?: unknown[] })?.data;
  return Array.isArray(data) ? (data as Thread[]) : [];
};

export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<MovieInsight | null>(null);
  const [trendingTalk, setTrendingTalk] = useState<TrendingItem[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');

  const [registro, setRegistro] = useState({ nombre: '', email: '', password: '', pais: '' });
  const [perfil, setPerfil] = useState({ nombre: '', pais: '' });
  const [threadDraft, setThreadDraft] = useState({ title: '', body: '', movieId: '' });
  const [historialCount, setHistorialCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const featured = useMemo(() => movies[0] ?? null, [movies]);

  const loadBaseData = useCallback(async (auth?: string, userId: number = 1) => {
    try {
      const headers = auth ? { Authorization: auth } : undefined;
      const [dashRes, threadsRes, trendingRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/dashboard/home?user_id=${userId}`, { headers }),
        fetch(`${API_BASE}/api/v1/threads`),
        fetch(`${API_BASE}/api/v1/movies/social/trending-talk?limit=12`),
      ]);
      if (dashRes.ok) {
        const dash = await dashRes.json();
        setMovies(parseMovies(dash.movies || []));
      }
      if (threadsRes.ok) setThreads(parseThreads(await threadsRes.json()));
      if (trendingRes.ok) {
        const payload = await trendingRes.json();
        setTrendingTalk(Array.isArray(payload?.data) ? payload.data : []);
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
      setHistorialCount(Array.isArray(payload) ? payload.length : 0);
    } catch {
      setHistorialCount(0);
    }
  }, []);

  const refreshMe = useCallback(async (auth: string) => {
    const resp = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) throw new Error('Sesion invalida');
    const me = (await resp.json()) as Usuario;
    setUsuario(me);
    setPerfil({ nombre: me.nombre ?? '', pais: me.pais ?? '' });
    await loadUserStats(me, auth);
    return me;
  }, [loadUserStats]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadBaseData();
      const savedEmail = localStorage.getItem('cine_email') ?? '';
      const savedPassword = localStorage.getItem('cine_password') ?? '';
      if (savedEmail && savedPassword) {
        const auth = authHeader(savedEmail, savedPassword);
        try {
          const me = await refreshMe(auth);
          await loadBaseData(auth, me.id);
          setEmail(savedEmail);
          setPassword(savedPassword);
          setToken(auth);
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
    const me = await refreshMe(auth);
    await loadBaseData(auth, me.id);
    setToken(auth);
    localStorage.setItem('cine_email', email);
    localStorage.setItem('cine_password', password);
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
    const resp = await fetch(`${API_BASE}/api/v1/usuarios/${usuario.id}`, {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(perfil),
    });
    if (!resp.ok) {
      setError('No se pudo actualizar perfil.');
      return;
    }
    const updated = (await resp.json()) as Usuario;
    setUsuario(updated);
    setInfo('Perfil actualizado.');
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

  const voteThread = async (threadId: string, delta: number) => {
    setError('');
    const resp = await fetch(`${API_BASE}/api/v1/threads/${threadId}/vote?delta=${delta}`, {
      method: 'PATCH',
    });
    if (!resp.ok) {
      setError('No se pudo votar en el thread.');
      return;
    }
    const updated = (await resp.json()) as Thread;
    const updatedId = updated.id || updated._id;
    setThreads((prev) => prev.map((t) => ((t.id || t._id) === updatedId ? updated : t)));
  };

  const openMovie = async (movie: Movie) => {
    setSelectedMovie(movie);
    setSelectedInsight(null);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/movies/${movie.id}/insights`);
      if (!resp.ok) return;
      setSelectedInsight(await resp.json());
    } catch {
      setSelectedInsight(null);
    }
  };

  const trendingByMovie = useMemo(() => {
    const map = new Map<string, TrendingItem>();
    for (const item of trendingTalk) {
      map.set(String(item.movie_id), item);
    }
    return map;
  }, [trendingTalk]);

  const logout = () => {
    setUsuario(null);
    setToken('');
    setEmail('');
    setPassword('');
    setHistorialCount(0);
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
            {trendingTalk.length > 0 && (
              <div className="hero-trending">
                <h4>Mas habladas ahora</h4>
                <ul>
                  {trendingTalk.slice(0, 5).map((item) => (
                    <li key={`${item.movie_id}`}>{item.title} · score {item.score}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'peliculas' && (
        <main className="section">
          <h2>Peliculas disponibles</h2>
          <div className="grid">
            {movies.slice(0, 120).map((m) => (
              <article className="card" key={m.id} onClick={() => void openMovie(m)}>
                {m.poster ? <img src={m.poster} alt={m.title || m.titulo || 'Poster'} /> : <div className="placeholder">Sin poster</div>}
                <h4>{m.title || m.titulo || 'Sin titulo'}</h4>
                <p>{m.year || m.año || 's/f'} • {m.duration || m.duracion || '?'} min</p>
                {trendingByMovie.has(String(m.id)) && (
                  <small className="metric">
                    Hilos: {trendingByMovie.get(String(m.id))?.threads} · Mensajes: {trendingByMovie.get(String(m.id))?.messages}
                  </small>
                )}
              </article>
            ))}
          </div>
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
                <div className="thread-actions">
                  <span>👍 {t.votes || 0}</span>
                  <button onClick={() => void voteThread(String(t.id || t._id), 1)}>+1</button>
                  <button onClick={() => void voteThread(String(t.id || t._id), -1)}>-1</button>
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
            <p><strong>ID:</strong> {usuario.id}</p>
            <p><strong>Correo:</strong> {usuario.email}</p>
            <p><strong>Rol:</strong> {usuario.rol || 'usuario'}</p>
            <p><strong>Peliculas vistas:</strong> {historialCount}</p>
            <div className="form">
              <input value={perfil.nombre} onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre" />
              <input value={perfil.pais} onChange={(e) => setPerfil((p) => ({ ...p, pais: e.target.value }))} placeholder="Pais" />
              <button onClick={() => void saveProfile()}>Guardar cambios</button>
            </div>
          </div>
        </main>
      )}

      {selectedMovie && (
        <div className="modal" onClick={() => setSelectedMovie(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedMovie(null)}>x</button>
            {selectedMovie.backdrop || selectedMovie.poster ? (
              <img src={selectedMovie.backdrop || selectedMovie.poster} alt={selectedMovie.title || selectedMovie.titulo || 'Pelicula'} />
            ) : <div className="placeholder big">Sin imagen</div>}
            <h3>{selectedMovie.title || selectedMovie.titulo || 'Sin titulo'}</h3>
            <p>{selectedMovie.description || selectedMovie.descripcion || 'Sin descripcion'}</p>
            {selectedInsight && (
              <div className="insights">
                <p>Vistas (muestra): {selectedInsight.views_sampled}</p>
                <p>Threads: {selectedInsight.threads} · Posts: {selectedInsight.posts} · Mensajes: {selectedInsight.messages}</p>
                <p>Votos: {selectedInsight.votes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
