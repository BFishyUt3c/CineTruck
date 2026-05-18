import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loginBasic,
  register as apiRegister,
  getMe,
  updateUser,
  getPeliculasVistas,
  marcarVista,
  quitarVista,
  getMovie as apiGetMovie,
  getReviews,
  createReview as apiCreateReview,
  getThreadsAll,
  getThreadsPaginated,
  getPostsByThread,
  createThread as apiCreateThread,
  createPost as apiCreatePost,
  getMovieStats,
  getMovies,
  getTopCalificadas,
  getActoresTop,
  getDirectoresTop,
  getPeliculasPorGenero,
  getUsuariosPorPais,
  getUsuariosPeliculasVistasTop,
  getForosMasActivos,
  getUsuariosResumen,
  getForosResumen,
} from './api';

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

interface TrendingItem {
  movie_id: number | string;
  score: number;
  threads: number;
  posts: number;
  mensajes?: number;
  movie?: Movie;
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
  pelicula_id?: number;
  peliculaId?: number;
  fecha_vista?: string;
  fechaVista?: string;
  fecha?: string;
}

// Backend response field types (exact field names from Athena queries)
interface GeneroItem {
  genero?: string;
  total_peliculas?: string | number;
}
interface ActorItem {
  actor?: string;
  nacionalidad?: string;
  total_peliculas?: string | number;
}
interface DirectorItem {
  director?: string;
  total_peliculas?: string | number;
}
interface PaisItem {
  pais?: string;
  total_usuarios?: string | number;
}
interface ForoItem {
  foro_id?: string | number;
  total_mensajes?: string | number;
}
interface UsuarioTopItem {
  usuario_id?: string | number;
  nombre?: string;
  pais?: string;
  peliculas_vistas?: string | number;
}
interface ResumenItem {
  [key: string]: string | number | undefined;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const b64 = (e: string, p: string) => `Basic ${btoa(`${e}:${p}`)}`;

const parseMovies = (payload: unknown): Movie[] => {
  if (typeof payload === 'string') return [];
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
  const p = payload as { threads?: unknown[]; data?: unknown[]; content?: unknown[] };
  const d = p?.threads ?? p?.data ?? p?.content;
  return Array.isArray(d) ? (d as Thread[]) : [];
};

const parsePosts = (payload: unknown): PostItem[] => {
  if (Array.isArray(payload)) return payload as PostItem[];
  const p = payload as { content?: unknown[]; posts?: unknown[]; data?: unknown[] };
  const d = p?.content ?? p?.posts ?? p?.data;
  return Array.isArray(d) ? (d as PostItem[]) : [];
};

const parseReviews = (payload: unknown): ReviewItem[] => {
  if (Array.isArray(payload)) return payload as ReviewItem[];
  const p = payload as { reviews?: unknown[]; data?: unknown[] | { reviews?: unknown[] } };
  if (Array.isArray(p?.data)) return p.data as ReviewItem[];
  const nested = (p?.data as { reviews?: unknown[] })?.reviews;
  if (Array.isArray(nested)) return nested as ReviewItem[];
  if (Array.isArray(p?.reviews)) return p.reviews as ReviewItem[];
  return [];
};
const nameList = (arr?: Array<{ name?: string } | string>, limit = 6) => {
  if (!arr?.length) return 'N/D';
  return (
    arr
      .slice(0, limit)
      .map((x) => (typeof x === 'string' ? x : x?.name ?? ''))
      .filter(Boolean)
      .join(', ') || 'N/D'
  );
};

const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

const buildTopViewedMovies = (history: HistoryItem[], allMovies: Movie[]) => {
  const counts = history.reduce<Record<number, { count: number; lastSeen: string }>>((acc, entry) => {
    const pid = Number(entry.pelicula_id ?? entry.peliculaId ?? 0);
    if (!pid) return acc;
    if (!acc[pid]) acc[pid] = { count: 0, lastSeen: '' };
    acc[pid].count += 1;
    acc[pid].lastSeen = entry.fecha_vista || entry.fechaVista || entry.fecha || acc[pid].lastSeen;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([id, info]) => ({
      pelicula_id: Number(id),
      count: info.count,
      lastSeen: info.lastSeen,
      movie: allMovies.find((m) => m.id === Number(id)),
    }))
    .sort((a, b) => (b.count - a.count) || (Date.parse(b.lastSeen || '0') - Date.parse(a.lastSeen || '0')))
    .slice(0, 5);
};

// ─── POSTER COMPONENT ─────────────────────────────────────────────────────────
function Poster({ movie, className = '' }: { movie?: Movie | null; className?: string }) {
  const src = movie?.backdrop || movie?.poster || movie?.poster_url;
  const title = movie?.title || movie?.titulo || 'Sin título';
  if (src)
    return (
      <img
        src={src}
        alt={title}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  return (
    <div className={`poster-fallback ${className}`}>
      <span className="poster-fallback__icon">🎬</span>
      <span className="poster-fallback__title">{title}</span>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #080b10;
    --surface: #0f1318;
    --surface2: #161b22;
    --border: #1e2530;
    --accent: #e8c84a;
    --accent2: #e85a4a;
    --text: #eef0f3;
    --muted: #6b7785;
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --radius: 6px;
    --tr: 0.18s ease;
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 14px; line-height: 1.5; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .loader { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg); gap: 1rem; }
  .loader-brand { font-family: var(--font-display); font-size: 3.5rem; letter-spacing: 0.14em; color: var(--accent); }
  .loader-sub { font-size: 0.78rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
  .loader-bar { width: 200px; height: 2px; background: var(--border); border-radius: 1px; overflow: hidden; }
  .loader-bar::after { content: ''; display: block; height: 100%; background: var(--accent); border-radius: 1px; animation: loadbar 1.4s ease-in-out infinite; }
  @keyframes loadbar { 0% { width: 0%; margin-left: 0; } 50% { width: 80%; margin-left: 10%; } 100% { width: 0%; margin-left: 100%; } }

  .auth-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); background-image: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232,200,74,0.07), transparent); }
  .auth-card { width: 360px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem; display: flex; flex-direction: column; gap: 1.2rem; }
  .auth-brand { font-family: var(--font-display); font-size: 3rem; letter-spacing: 0.12em; color: var(--accent); text-align: center; }
  .auth-sub { text-align: center; color: var(--muted); font-size: 0.82rem; }
  .auth-switch { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .auth-switch button { flex: 1; border: none; background: none; color: var(--muted); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; padding: 9px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.06em; }
  .auth-switch button.active { background: var(--accent); color: #000; }
  .auth-form { display: flex; flex-direction: column; gap: 8px; }
  .auth-form input { background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 0.85rem; padding: 10px 12px; border-radius: var(--radius); outline: none; transition: border-color var(--tr); }
  .auth-form input:focus { border-color: var(--accent); }
  .auth-form input::placeholder { color: var(--muted); }
  .btn-primary { background: var(--accent); color: #000; font-family: var(--font-body); font-size: 0.83rem; font-weight: 700; border: none; padding: 11px; border-radius: var(--radius); cursor: pointer; transition: opacity var(--tr); letter-spacing: 0.05em; text-transform: uppercase; }
  .btn-primary:hover { opacity: 0.85; }
  .msg-inline { font-size: 0.78rem; padding: 8px 10px; border-radius: var(--radius); text-align: center; }
  .msg-inline.error { background: rgba(232,90,74,0.12); color: var(--accent2); border: 1px solid rgba(232,90,74,0.2); }
  .msg-inline.ok { background: rgba(232,200,74,0.1); color: var(--accent); border: 1px solid rgba(232,200,74,0.2); }

  .topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; gap: 1rem; padding: 0 1.5rem; height: 54px; background: rgba(8,11,16,0.96); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); }
  .topbar-brand { font-family: var(--font-display); font-size: 1.6rem; letter-spacing: 0.1em; color: var(--accent); flex-shrink: 0; }
  .topbar-nav { display: flex; gap: 2px; flex: 1; }
  .topbar-nav button { background: none; border: none; color: var(--muted); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: all var(--tr); letter-spacing: 0.06em; text-transform: uppercase; }
  .topbar-nav button:hover { color: var(--text); background: var(--surface2); }
  .topbar-nav button.active { color: var(--accent); background: rgba(232,200,74,0.08); }
  .topbar-user { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .topbar-user span { font-size: 0.8rem; color: var(--muted); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .topbar-user button { background: none; border: 1px solid var(--border); color: var(--muted); font-size: 0.72rem; font-family: var(--font-body); padding: 4px 12px; border-radius: 4px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.05em; }
  .topbar-user button:hover { border-color: var(--accent2); color: var(--accent2); }

  .msg-bar { position: fixed; top: 54px; left: 0; right: 0; z-index: 99; padding: 8px 1.5rem; font-size: 0.8rem; text-align: center; animation: slideDown 0.2s ease; }
  .msg-bar.error { background: rgba(232,90,74,0.15); color: var(--accent2); border-bottom: 1px solid rgba(232,90,74,0.2); }
  .msg-bar.ok { background: rgba(232,200,74,0.1); color: var(--accent); border-bottom: 1px solid rgba(232,200,74,0.2); }
  @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }

  .page { padding-top: 54px; min-height: 100vh; }

  .hero { position: relative; height: 440px; display: flex; align-items: flex-end; overflow: hidden; }
  .hero__bg { position: absolute; inset: 0; background: linear-gradient(135deg, #0a0e15, #1a1f2e, #0d1117); }
  .hero__bg img { width: 100%; height: 100%; object-fit: cover; opacity: 0.32; filter: blur(1px); }
  .hero__overlay { position: absolute; inset: 0; background: linear-gradient(to top, var(--bg) 0%, rgba(8,11,16,0.55) 50%, transparent 100%); }
  .hero__content { position: relative; padding: 2rem 2rem 2.8rem; max-width: 680px; }
  .hero__tag { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; }
  .hero__title { font-family: var(--font-display); font-size: 3.4rem; line-height: 0.93; letter-spacing: 0.04em; color: var(--text); margin-bottom: 0.8rem; }
  .hero__desc { color: var(--muted); font-size: 0.88rem; max-width: 480px; margin-bottom: 1.4rem; line-height: 1.65; }
  .hero__actions { display: flex; gap: 8px; }
  .hero__actions button { font-family: var(--font-body); font-size: 0.78rem; font-weight: 700; border: none; padding: 10px 22px; border-radius: 4px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.07em; }
  .hero__actions .btn-main { background: var(--accent); color: #000; }
  .hero__actions .btn-main:hover { opacity: 0.85; }
  .hero__actions .btn-ghost { background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--border); }
  .hero__actions .btn-ghost:hover { background: rgba(255,255,255,0.1); }

  .section { padding: 2rem 1.5rem; max-width: 1400px; margin: 0 auto; }
  .section-title { font-family: var(--font-display); font-size: 1.5rem; letter-spacing: 0.09em; color: var(--text); margin-bottom: 1rem; display: flex; align-items: center; gap: 10px; }
  .section-title span { font-family: var(--font-body); font-size: 0.72rem; font-weight: 500; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; margin-left: auto; }

  .stats-bar { display: flex; gap: 1px; background: var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 2rem; }
  .stat-item { flex: 1; background: var(--surface); padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 3px; }
  .stat-item .val { font-family: var(--font-display); font-size: 1.7rem; letter-spacing: 0.04em; color: var(--accent); }
  .stat-item .lbl { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.09em; }

  .trending-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; margin-bottom: 2rem; }
  .trending-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform var(--tr), border-color var(--tr); }
  .trending-card:hover { transform: translateY(-2px); border-color: var(--accent); }
  .trending-card__poster { aspect-ratio: 2/3; background: var(--surface2); overflow: hidden; position: relative; }
  .trending-card__poster img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
  .trending-card:hover .trending-card__poster img { transform: scale(1.04); }
  .trending-card__body { padding: 10px 12px; }
  .trending-card__body h4 { font-size: 0.82rem; font-weight: 600; color: var(--text); line-height: 1.3; margin-bottom: 4px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .trending-card__score { font-size: 0.72rem; color: var(--accent); font-weight: 700; }
  .trending-card__meta { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
  .trending-card__actions { display: flex; gap: 4px; margin-top: 8px; }
  .trending-card__actions button { flex: 1; font-size: 0.68rem; font-family: var(--font-body); font-weight: 600; border: none; padding: 5px 8px; border-radius: 3px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.04em; }
  .btn-sm-accent { background: var(--accent); color: #000; }
  .btn-sm-accent:hover { opacity: 0.8; }
  .btn-sm-ghost { background: var(--surface2); color: var(--muted); border: 1px solid var(--border) !important; }
  .btn-sm-ghost:hover:not(:disabled) { color: var(--text) !important; }
  .btn-sm-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .movies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 8px; }
  .movie-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; cursor: pointer; transition: transform var(--tr), border-color var(--tr); }
  .movie-card:hover { transform: translateY(-2px); border-color: rgba(232,200,74,0.35); }
  .movie-card__poster { aspect-ratio: 2/3; background: var(--surface2); overflow: hidden; }
  .movie-card__poster img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
  .movie-card:hover .movie-card__poster img { transform: scale(1.05); }
  .movie-card__body { padding: 8px 10px; }
  .movie-card__body h4 { font-size: 0.75rem; font-weight: 600; color: var(--text); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .movie-card__body p { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
  .load-more { text-align: center; margin-top: 1.5rem; }
  .load-more button { background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; padding: 10px 28px; border-radius: 4px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.06em; }
  .load-more button:hover { border-color: var(--accent); color: var(--accent); }

  .poster-fallback { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1rem; text-align: center; background: linear-gradient(135deg, #1a1f2e, #0f1318); gap: 6px; }
  .poster-fallback__icon { font-size: 1.8rem; opacity: 0.4; }
  .poster-fallback__title { font-size: 0.7rem; color: var(--muted); line-height: 1.3; }

  .forum-layout { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start; }
  @media(max-width: 800px) { .forum-layout { grid-template-columns: 1fr; } }
  .thread-form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.2rem; position: sticky; top: 70px; display: flex; flex-direction: column; gap: 8px; }
  .thread-form-card h3 { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.06em; color: var(--text); margin-bottom: 4px; }
  .fld { background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 0.82rem; padding: 9px 11px; border-radius: var(--radius); outline: none; transition: border-color var(--tr); resize: none; width: 100%; }
  .fld:focus { border-color: var(--accent); }
  .fld::placeholder { color: var(--muted); }
  textarea.fld { min-height: 90px; }
  .threads-list { display: flex; flex-direction: column; gap: 8px; }
  .thread-item { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.2rem; transition: border-color var(--tr); }
  .thread-item:hover { border-color: rgba(232,200,74,0.2); }
  .thread-item h4 { font-size: 0.88rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .thread-item p { font-size: 0.8rem; color: var(--muted); line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 8px; }
  .thread-meta { font-size: 0.7rem; color: var(--muted); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .thread-meta button { background: none; border: 1px solid var(--border); color: var(--muted); font-size: 0.68rem; font-family: var(--font-body); padding: 4px 10px; border-radius: 3px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.05em; }
  .thread-meta button:hover { border-color: var(--accent); color: var(--accent); }

  .profile-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: start; }
  @media(max-width: 800px) { .profile-grid { grid-template-columns: 1fr; } }
  .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; position: sticky; top: 70px; }
  .profile-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 1.7rem; color: #000; margin-bottom: 1rem; }
  .profile-card h3 { font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 2px; }
  .profile-card .role { font-size: 0.7rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 1rem; }
  .profile-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1rem; }
  .profile-stat { background: var(--surface2); border-radius: 6px; padding: 10px; text-align: center; }
  .profile-stat .val { font-family: var(--font-display); font-size: 1.4rem; color: var(--accent); }
  .profile-stat .lbl { font-size: 0.64rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; }
  .profile-info { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1rem; }
  .profile-info p { font-size: 0.78rem; color: var(--muted); }
  .profile-info strong { color: var(--text); }
  .edit-btn { width: 100%; background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; padding: 8px; border-radius: 4px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.05em; }
  .edit-btn:hover { border-color: var(--accent); color: var(--accent); }
  .history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-bottom: 1.5rem; }
  .history-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; cursor: pointer; transition: all var(--tr); }
  .history-card:hover { border-color: rgba(232,200,74,0.3); transform: translateY(-1px); }
  .history-card__poster { aspect-ratio: 2/3; background: var(--surface2); overflow: hidden; }
  .history-card__poster img { width: 100%; height: 100%; object-fit: cover; }
  .history-card__body { padding: 7px 9px; }
  .history-card__body h4 { font-size: 0.72rem; font-weight: 600; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
  .history-card__body small { font-size: 0.62rem; color: var(--muted); display: block; margin-top: 2px; }

  .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
  .analytics-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.2rem; }
  .analytics-card h4 { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.06em; color: var(--text); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.6rem; }
  .analytics-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .analytics-row:last-child { border-bottom: none; }
  .analytics-rank { font-family: var(--font-display); font-size: 0.9rem; color: var(--muted); width: 22px; text-align: right; }
  .analytics-name { flex: 1; font-size: 0.8rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .analytics-count { font-size: 0.75rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
  .analytics-bar-wrap { flex: 0 0 80px; height: 4px; background: var(--surface2); border-radius: 2px; overflow: hidden; }
  .analytics-bar { height: 100%; background: var(--accent); border-radius: 2px; }

  .modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.82); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn 0.15s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 780px; max-height: 90vh; overflow-y: auto; position: relative; animation: slideUp 0.2s ease; }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-card.narrow { max-width: 480px; }
  .modal-card.medium { max-width: 660px; }
  .modal-close { position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; padding: 1rem 1rem 0; background: var(--surface); }
  .modal-close button { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 0.9rem; transition: all var(--tr); display: flex; align-items: center; justify-content: center; }
  .modal-close button:hover { border-color: var(--accent2); color: var(--accent2); }
  .modal-divider { height: 1px; background: var(--border); margin: 0 1.5rem 1.5rem; }
  .modal-section { padding: 0 1.5rem 1.5rem; }
  .modal-section h3 { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.06em; margin-bottom: 1rem; color: var(--text); }

  .movie-detail { display: grid; grid-template-columns: 190px 1fr; gap: 1.5rem; padding: 0 1.5rem 1.5rem; }
  @media(max-width: 600px) { .movie-detail { grid-template-columns: 1fr; } }
  .movie-detail__poster { border-radius: 8px; overflow: hidden; aspect-ratio: 2/3; background: var(--surface2); }
  .movie-detail__poster img { width: 100%; height: 100%; object-fit: cover; }
  .movie-detail__info h2 { font-family: var(--font-display); font-size: 1.9rem; letter-spacing: 0.04em; color: var(--text); margin-bottom: 4px; line-height: 1; }
  .movie-detail__year { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.6rem; }
  .rating-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(232,200,74,0.12); border: 1px solid rgba(232,200,74,0.25); color: var(--accent); font-size: 0.78rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 0.8rem; }
  .movie-detail__desc { font-size: 0.83rem; color: var(--muted); line-height: 1.65; margin-bottom: 1rem; }
  .genre-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 0.8rem; }
  .genre-tag { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 3px; background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
  .meta-row { font-size: 0.78rem; color: var(--muted); margin-bottom: 5px; }
  .meta-row strong { color: var(--text); }
  .detail-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 1rem; }
  .detail-actions button { font-family: var(--font-body); font-size: 0.75rem; font-weight: 700; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; transition: all var(--tr); text-transform: uppercase; letter-spacing: 0.05em; }

  .review-form { display: flex; flex-direction: column; gap: 8px; background: var(--surface2); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .review-form label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); }
  .reviews-list { display: flex; flex-direction: column; gap: 8px; }
  .review-item { background: var(--surface2); border-radius: 6px; padding: 10px 12px; }
  .review-item__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .review-item__author { font-size: 0.78rem; font-weight: 600; color: var(--text); }
  .review-item__rating { font-size: 0.72rem; font-weight: 700; color: var(--accent); background: rgba(232,200,74,0.1); padding: 2px 8px; border-radius: 10px; }
  .review-item__comment { font-size: 0.8rem; color: var(--muted); line-height: 1.5; }
  .review-item__date { font-size: 0.65rem; color: var(--border); margin-top: 4px; }

  .thread-modal-head { padding: 0 1.5rem 1rem; }
  .thread-modal-head h2 { font-family: var(--font-display); font-size: 1.5rem; letter-spacing: 0.04em; color: var(--text); margin-bottom: 4px; }
  .thread-modal-head p { font-size: 0.82rem; color: var(--muted); line-height: 1.5; }
  .thread-modal-head .tmeta { font-size: 0.72rem; color: var(--muted); margin-top: 6px; }
  .posts-list { display: flex; flex-direction: column; gap: 6px; }
  .post-item { background: var(--surface2); border-radius: 6px; padding: 10px 12px; }
  .post-item p { font-size: 0.82rem; color: var(--text); line-height: 1.5; }
  .post-item small { font-size: 0.68rem; color: var(--muted); }

  .edit-profile-body { padding: 0 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 10px; }
  .edit-profile-body label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); }
  .edit-profile-body input { width: 100%; }
  .edit-profile-actions { display: flex; gap: 8px; margin-top: 4px; }
  .edit-profile-actions button { flex: 1; }

  .empty-state { text-align: center; padding: 3rem 1rem; color: var(--muted); }
  .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.4; }
  .empty-state p { font-size: 0.85rem; line-height: 1.6; }
  .empty-state button { margin-top: 1rem; background: var(--accent); color: #000; font-family: var(--font-body); font-size: 0.78rem; font-weight: 700; border: none; padding: 9px 20px; border-radius: 4px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em; }
`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [visibleCount, setVisibleCount] = useState(120);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [dashStats, setDashStats] = useState<{ movies_total?: number; threads_total?: number; posts_total?: number }>({});
  const [_analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [selMovie, setSelMovie] = useState<Movie | null>(null);
  const [movieReviews, setMovieReviews] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, comment: '' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');
  const [registro, setRegistro] = useState({ nombre: '', email: '', password: '', pais: '' });
  const [perfil, setPerfil] = useState({ nombre: '', email: '', pais: '', password: '' });
  const [showEditModal, setShowEditModal] = useState(false);

  const [threadDraft, setThreadDraft] = useState({ title: '', body: '', movieId: '' });
  const [selThread, setSelThread] = useState<Thread | null>(null);
  const [threadPosts, setThreadPosts] = useState<PostItem[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [postDraft, setPostDraft] = useState('');

  const [historial, setHistorial] = useState<HistoryItem[]>([]);
  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [analyticsData, setAnalyticsData] = useState<{
    topCalificadas: Array<{ id?: number; title?: string; titulo?: string; rating?: string | number; poster?: string; poster_url?: string }>;
    actoresTop: ActorItem[];
    directoresTop: DirectorItem[];
    generos: GeneroItem[];
    usuariosPais: PaisItem[];
    usuariosTop: UsuarioTopItem[];
    forosMasActivos: ForoItem[];
    resumenUsuarios: ResumenItem;
    resumenForos: ResumenItem;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMsg = (type: 'error' | 'info', text: string) => {
    setError(''); setInfo('');
    if (type === 'error') setError(text); else setInfo(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => { setError(''); setInfo(''); }, 4000);
  };

  // ── DATA LOADERS ────────────────────────────────────────────────────────────
  const loadUserStats = useCallback(async (user: Usuario, auth: string) => {
    try {
      const r = await getPeliculasVistas(user.id, auth);
      const payload = r.data;
      if (Array.isArray(payload)) {
        const items = payload
          .map((it: HistoryItem) => ({
            ...it,
            pelicula_id: it.pelicula_id ?? it.peliculaId,
            fecha_vista: it.fecha_vista ?? it.fechaVista ?? it.fecha,
          }))
          .filter((it: HistoryItem) => typeof it.pelicula_id === 'number')
          .sort(
            (a: HistoryItem, b: HistoryItem) =>
              Date.parse(b.fecha_vista || '0') - Date.parse(a.fecha_vista || '0')
          );
        setHistorial(items);
        setViewedIds([...new Set(items.map((i: HistoryItem) => i.pelicula_id as number))]);
      }
    } catch {
      setHistorial([]); setViewedIds([]);
    }
  }, []);

  // ── LOAD ANALYTICS ──────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [
        topCalRes, actoresRes, directoresRes, generosRes,
        paisRes, topUsersRes, forosRes, resumenUsRes, resumenForosRes
      ] = await Promise.allSettled([
        getTopCalificadas(),
        getActoresTop(),
        getDirectoresTop(),
        getPeliculasPorGenero(),
        getUsuariosPorPais(),
        getUsuariosPeliculasVistasTop(),
        getForosMasActivos(),
        getUsuariosResumen(),
        getForosResumen(),
      ]);

      const safeArr = (r: PromiseSettledResult<{ data: unknown }>): unknown[] => {
        if (r.status !== 'fulfilled') return [];
        const axiosPayload = r.value.data; 
        const inner = (axiosPayload as { data?: unknown })?.data;
        if (Array.isArray(inner)) return inner;
        if (Array.isArray(axiosPayload)) return axiosPayload;
        return [];
      };

      const safeResumen = (r: PromiseSettledResult<{ data: unknown }>): ResumenItem => {
        const arr = safeArr(r);
        if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
          return arr[0] as ResumenItem;
        }
        return {};
      };

      setAnalyticsData({
        topCalificadas: safeArr(topCalRes) as [],
        actoresTop:     safeArr(actoresRes) as ActorItem[],
        directoresTop:  safeArr(directoresRes) as DirectorItem[],
        generos:        safeArr(generosRes) as GeneroItem[],
        usuariosPais:   safeArr(paisRes) as PaisItem[],
        usuariosTop:    safeArr(topUsersRes) as UsuarioTopItem[],
        forosMasActivos: safeArr(forosRes) as ForoItem[],
        resumenUsuarios: safeResumen(resumenUsRes),
        resumenForos:    safeResumen(resumenForosRes),
      });
    } catch (e) {
      console.error('Error cargando analytics:', e);
    }
    setAnalyticsLoading(false);
  }, []);

  const refreshMe = useCallback(
    async (auth: string) => {
      const r = await getMe(auth);
      const me = r.data as Usuario;
      setUsuario(me);
      setPerfil({ nombre: me.nombre ?? '', email: me.email ?? '', pais: me.pais ?? '', password: '' });
      await loadUserStats(me, auth);
    },
    [loadUserStats]
  );

  const buildAnalytics = useCallback((movieList: Movie[]) => {
    const genres: Record<string, number> = {};
    const actors: Record<string, number> = {};
    const directors: Record<string, number> = {};
    movieList.forEach((m) => {
      (m.genres || []).forEach((g) => { const n = typeof g === 'string' ? g : g?.name; if (n) genres[n] = (genres[n] || 0) + 1; });
      (m.actors || []).forEach((a) => { const n = typeof a === 'string' ? a : a?.name; if (n) actors[n] = (actors[n] || 0) + 1; });
      (m.directors || []).forEach((d) => { const n = typeof d === 'string' ? d : d?.name; if (n) directors[n] = (directors[n] || 0) + 1; });
    });
    const toArr = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
    return {
      total_peliculas: movieList.length,
      top_generos: toArr(genres).slice(0, 10),
      top_actores: toArr(actors).slice(0, 10),
      top_directores: toArr(directors).slice(0, 10),
    };
  }, []);

  useEffect(() => {
    if (tab === 'analytics' && !analyticsData && !analyticsLoading) {
      void loadAnalytics();
    }
  }, [tab, analyticsData, analyticsLoading, loadAnalytics]);

  useEffect(() => {
    const loadMoviesProgressive = async (): Promise<Movie[]> => {
      const size = 20;
      const firstRes = await getMovies(1, size);
      const firstBatch = parseMovies(firstRes.data);
      if (firstBatch.length === 0) return [];
      setMovies(firstBatch);
      const allMovies = [...firstBatch];
      const CONCURRENCY = 10;
      let page = 2;
      let hasMore = firstBatch.length === size;

      while (hasMore) {
        const pageNumbers = Array.from({ length: CONCURRENCY }, (_, i) => page + i);
        const results = await Promise.allSettled(pageNumbers.map(p => getMovies(p, size)));
        let lastBatchSize = 0;
        const newMovies: Movie[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const batch = parseMovies(result.value.data);
            newMovies.push(...batch);
            lastBatchSize = batch.length;
            if (batch.length < size) { hasMore = false; break; }
          } else {
            hasMore = false; break;
          }
        }
        if (newMovies.length > 0) {
          allMovies.push(...newMovies);
          setMovies(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            return [...prev, ...newMovies.filter(m => !existingIds.has(m.id))];
          });
        }
        page += CONCURRENCY;
        if (lastBatchSize < size) hasMore = false;
      }
      return allMovies;
    };

    const init = async () => {
      try {
        let movieList: Movie[] = [];
        try {
          movieList = await loadMoviesProgressive();
        } catch (e) {
          console.error('Error cargando películas:', e);
        }

        try {
          const thrRes = await getThreadsAll();
          setThreads(parseThreads(thrRes.data));
        } catch (e) {
          try {
            const thrRes2 = await getThreadsPaginated(0, 50);
            setThreads(parseThreads(thrRes2.data));
          } catch {
            console.error('Error cargando threads:', e);
          }
        }

        try {
          const statsRes = await getMovieStats();
          const s = statsRes.data as {
            total_peliculas?: number;
            top_generos?: Array<{ nombre: string; cantidad: number }>;
            top_actores?: Array<{ nombre: string; cantidad: number }>;
            top_directores?: Array<{ nombre: string; cantidad: number }>;
            movies_total?: number;
            threads_total?: number;
            posts_total?: number;
            trending_talk?: TrendingItem[];
          };
          setDashStats({
            movies_total: s.total_peliculas ?? s.movies_total,
            threads_total: s.threads_total,
            posts_total: s.posts_total,
          });
          if (s.trending_talk) setTrending(s.trending_talk);
          setAnalytics({
            total_peliculas: s.total_peliculas,
            top_generos: s.top_generos,
            top_actores: s.top_actores,
            top_directores: s.top_directores,
          });
        } catch {
          setAnalytics(buildAnalytics(movieList));
        }

        const se = localStorage.getItem('cine_email') ?? '';
        const sp = localStorage.getItem('cine_password') ?? '';
        if (se && sp) {
          const auth = b64(se, sp);
          try {
            await refreshMe(auth);
            setEmail(se); setPassword(sp); setToken(auth);
          } catch {
            localStorage.removeItem('cine_email');
            localStorage.removeItem('cine_password');
          }
        }
      } catch {
        showMsg('error', 'Error cargando datos. Verifica la conexión.');
      }
      setLoading(false);
    };

    void init();
  }, [buildAnalytics, refreshMe]);

  // ── ACTIONS ─────────────────────────────────────────────────────────────────
  const doLogin = async () => {
    if (!email || !password) { showMsg('error', 'Completa correo y contraseña.'); return; }
    const auth = b64(email, password);
    try {
      await loginBasic(auth);
      await refreshMe(auth);
      setToken(auth);
      localStorage.setItem('cine_email', email);
      localStorage.setItem('cine_password', password);
      setTab('inicio');
    } catch {
      showMsg('error', 'Credenciales incorrectas.');
    }
  };

  const doRegister = async () => {
    if (!registro.nombre || !registro.email || !registro.password || !registro.pais) {
      showMsg('error', 'Completa todos los campos.'); return;
    }
    try {
      await apiRegister(registro);
      setEmail(registro.email); setPassword(registro.password);
      setAuthMode('login'); showMsg('info', 'Registro exitoso. Inicia sesión.');
    } catch {
      showMsg('error', 'No se pudo registrar. El correo puede estar en uso.');
    }
  };

  const doLogout = () => {
    setUsuario(null); setToken(''); setEmail(''); setPassword('');
    setHistorial([]); setViewedIds([]);
    setSelThread(null); setThreadPosts([]);
    localStorage.removeItem('cine_email'); localStorage.removeItem('cine_password');
    setTab('inicio');
  };

  const saveProfile = async () => {
    if (!usuario || !token) return;
    if (!perfil.nombre || !perfil.pais) {
      showMsg('error', 'Nombre y país son obligatorios.'); return;
    }
    const payload: { nombre: string; pais: string; password?: string } = {
      nombre: perfil.nombre,
      pais: perfil.pais,
    };
    if (perfil.password.trim()) payload.password = perfil.password.trim();
    try {
      await updateUser(usuario.id, payload, token);
      
      let currentToken = token;
      
      if (perfil.password.trim()) {
        const newPass = perfil.password.trim();
        setPassword(newPass);
        localStorage.setItem('cine_password', newPass);
        // Recalcular token con nuevo password
        currentToken = b64(email, newPass);
        setToken(currentToken);
      }
      
      await refreshMe(currentToken);
      
      setShowEditModal(false);
      setTab('perfil');
      showMsg('info', 'Perfil actualizado.');
    } catch (e) {
      console.error('Error actualizando perfil:', e);
      showMsg('error', 'No se pudo actualizar perfil.');
    }
  };

  const doToggleWatched = async (movieId?: number) => {
    if (!usuario || movieId == null) {
      showMsg('error', 'Inicia sesión para marcar o desmarcar vistas.');
      return;
    }
    if (viewedIds.includes(movieId)) {
      try {
        await quitarVista(usuario.id, movieId);
        setViewedIds((prev) => prev.filter((id) => id !== movieId));
        setHistorial((prev) => prev.filter((item) => item.pelicula_id !== movieId));
        if (token) await loadUserStats(usuario, token);
        showMsg('info', 'Película desmarcada como vista.');
      } catch {
        showMsg('error', 'No se pudo desmarcar la película como vista.');
      }
      return;
    }
    try {
      await marcarVista(usuario.id, movieId);
      setViewedIds((prev) => (prev.includes(movieId) ? prev : [...prev, movieId]));
      if (token) await loadUserStats(usuario, token);
      showMsg('info', '¡Marcada como vista!');
    } catch {
      showMsg('error', 'No se pudo marcar como vista.');
    }
  };

  const openMovieDetail = async (movie: Movie) => {
    setSelMovie(movie); setMovieReviews([]); setReviewLoading(true);
    setReviewDraft({ rating: 5, comment: '' });
    try {
      const r = await apiGetMovie(movie.id);
      const p = r.data as Movie & { reviews?: ReviewItem[] };
      setSelMovie((prev) => ({
        ...(prev ?? movie),
        ...p,
        description: p.description ?? p.descripcion ?? p.synopsis ?? prev?.description,
        poster: p.poster ?? p.poster_url ?? prev?.poster,
      }));
      try {
        const revRes = await getReviews(movie.id);
        setMovieReviews(parseReviews(revRes.data));
      } catch {
        setMovieReviews(parseReviews({ reviews: (p as Movie & { reviews?: ReviewItem[] }).reviews }));
      }
    } catch {
      try {
        const revRes = await getReviews(movie.id);
        setMovieReviews(parseReviews(revRes.data));
      } catch { /* sin reviews */ }
    } finally {
      setReviewLoading(false);
    }
  };

  const doCreateReview = async () => {
  if (!selMovie || !usuario) return;
  const comment = reviewDraft.comment.trim();
  if (!comment) { showMsg('error', 'Escribe un comentario.'); return; }
  try {
    await apiCreateReview(selMovie.id, {
      author: usuario.nombre,
      rating: Math.max(1, Math.min(10, Number(reviewDraft.rating))),
      comment,
    });

    const newReview: ReviewItem = {
      id: Date.now(),
      author: usuario.nombre,
      rating: Math.max(1, Math.min(10, Number(reviewDraft.rating))),
      comment,
      created_at: new Date().toISOString(),
    };

    setReviewDraft({ rating: 5, comment: '' });
    showMsg('info', 'Reseña publicada.');

    await new Promise(res => setTimeout(res, 1000));
    try {
      const revRes = await getReviews(selMovie.id);
      const serverReviews = parseReviews(revRes.data);
            setMovieReviews(serverReviews.length > 0 ? serverReviews : [newReview]);
    } catch {
      setMovieReviews(prev => [newReview, ...prev]);
    }

  } catch (e) {
    console.error('Error publicando reseña:', e);
    showMsg('error', 'No se pudo publicar la reseña.');
  }
};

  const doCreateThread = async () => {
    if (!usuario) return;
    if (!threadDraft.title || !threadDraft.body || !threadDraft.movieId) {
      showMsg('error', 'Completa todos los campos.'); return;
    }
    try {
      const r = await apiCreateThread({
        userId: String(usuario.id),
        movieId: threadDraft.movieId,
        title: threadDraft.title,
        body: threadDraft.body,
      });
      setThreads((prev) => [r.data as Thread, ...prev]);
      setThreadDraft({ title: '', body: '', movieId: '' }); showMsg('info', 'Thread creado.');
    } catch {
      showMsg('error', 'No se pudo crear el thread.');
    }
  };

  const openThread = async (thread: Thread) => {
    const id = String(thread.id || thread._id || '');
    if (!id) return;
    setSelThread(thread); setLoadingThread(true); setThreadPosts([]);
    try {
      const r = await getPostsByThread(id);
      setThreadPosts(parsePosts(r.data));
    } catch { /* sin posts */ }
    finally { setLoadingThread(false); }
  };

  const doCreatePost = async () => {
    if (!usuario || !selThread) return;
    const id = String(selThread.id || selThread._id || '');
    if (!id || !postDraft.trim()) { showMsg('error', 'Escribe el contenido del post.'); return; }
    try {
      const r = await apiCreatePost({
        threadId: id,
        userId: String(usuario.id),
        body: postDraft.trim(),
      });
      setThreadPosts((prev) => [r.data as PostItem, ...prev]);
      setPostDraft(''); showMsg('info', 'Post publicado.');
    } catch {
      showMsg('error', 'No se pudo publicar.');
    }
  };

  // ── COMPUTED ────────────────────────────────────────────────────────────────
  const featured = useMemo(
    () => trending[0]?.movie ?? movies[0] ?? null,
    [trending, movies]
  );
  const catalogTotal = useMemo(
    () => Math.max(movies.length, dashStats.movies_total ?? 0),
    [movies.length, dashStats.movies_total]
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="loader">
        <div className="loader-brand">CINETRUCK</div>
        <div className="loader-sub">Cargando plataforma</div>
        <div className="loader-bar" />
      </div>
    </>
  );

  if (!usuario) return (
    <>
      <style>{CSS}</style>
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">CINETRUCK</div>
          <p className="auth-sub">Tu plataforma de cine. Inicia sesión para continuar.</p>
          <div className="auth-switch">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Iniciar sesión</button>
            <button className={authMode === 'registro' ? 'active' : ''} onClick={() => setAuthMode('registro')}>Registrarse</button>
          </div>
          {authMode === 'login' ? (
            <div className="auth-form">
              <input placeholder="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void doLogin()} />
              <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void doLogin()} />
              <button className="btn-primary" onClick={() => void doLogin()}>Entrar</button>
            </div>
          ) : (
            <div className="auth-form">
              <input placeholder="Nombre completo" value={registro.nombre} onChange={(e) => setRegistro((p) => ({ ...p, nombre: e.target.value }))} />
              <input placeholder="Correo electrónico" type="email" value={registro.email} onChange={(e) => setRegistro((p) => ({ ...p, email: e.target.value }))} />
              <input placeholder="Contraseña" type="password" value={registro.password} onChange={(e) => setRegistro((p) => ({ ...p, password: e.target.value }))} />
              <input placeholder="País" value={registro.pais} onChange={(e) => setRegistro((p) => ({ ...p, pais: e.target.value }))} />
              <button className="btn-primary" onClick={() => void doRegister()}>Crear cuenta</button>
            </div>
          )}
          {error && <p className="msg-inline error">{error}</p>}
          {info && <p className="msg-inline ok">{info}</p>}
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <header className="topbar">
        <div className="topbar-brand">CINETRUCK</div>
        <nav className="topbar-nav">
          {(['inicio', 'peliculas', 'foro', 'perfil', 'analytics'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'inicio' ? 'Inicio' : t === 'peliculas' ? 'Películas' : t === 'foro' ? 'Foro' : t === 'perfil' ? 'Perfil' : 'Analytics'}
            </button>
          ))}
        </nav>
        <div className="topbar-user">
          <span>{usuario.nombre}</span>
          <button onClick={doLogout}>Salir</button>
        </div>
      </header>

      {error && <div key={error} className="msg-bar error">{error}</div>}
      {info && <div key={info} className="msg-bar ok">{info}</div>}

      <div className="page">
        {/* ── INICIO ── */}
        {tab === 'inicio' && (
          <>
            <div className="hero">
              <div className="hero__bg"><Poster movie={featured} /></div>
              <div className="hero__overlay" />
              <div className="hero__content">
                <div className="hero__tag">🎬 Destacado</div>
                <h1 className="hero__title">{featured?.title || featured?.titulo || 'Catálogo de Películas'}</h1>
                <p className="hero__desc">{(featured?.description || featured?.descripcion || 'Explora miles de películas disponibles en tu plataforma.').slice(0, 160)}</p>
                <div className="hero__actions">
                  <button className="btn-main" onClick={() => setTab('peliculas')}>Ver catálogo</button>
                  <button className="btn-ghost" onClick={() => setTab('foro')}>Ir al foro</button>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="stats-bar">
                <div className="stat-item"><div className="val">{catalogTotal.toLocaleString()}</div><div className="lbl">Películas</div></div>
                <div className="stat-item"><div className="val">{(dashStats.threads_total ?? threads.length).toLocaleString()}</div><div className="lbl">Threads</div></div>
                <div className="stat-item"><div className="val">{(dashStats.posts_total ?? 0).toLocaleString()}</div><div className="lbl">Posts</div></div>
                <div className="stat-item"><div className="val">{historial.length}</div><div className="lbl">Vistas</div></div>
              </div>

              <div className="section-title">TRENDING <span>Más comentadas</span></div>
              <div className="trending-grid">
                {(trending.length > 0 ? trending.slice(0, 8) : movies.slice(0, 8)).map((item, i) => {
                  const isT = trending.length > 0;
                  const m = isT ? (item as TrendingItem).movie : (item as Movie);
                  const mid = isT ? Number((item as TrendingItem).movie_id) : (item as Movie).id;
                  const watched = viewedIds.includes(mid);
                  return (
                    <article key={i} className="trending-card">
                      <div className="trending-card__poster"><Poster movie={m} /></div>
                      <div className="trending-card__body">
                        <h4>{m?.title || m?.titulo || `Película ${mid}`}</h4>
                        {isT && <div className="trending-card__score">⭐ Score {(item as TrendingItem).score}</div>}
                        {isT
                          ? <div className="trending-card__meta">{(item as TrendingItem).threads} threads · {(item as TrendingItem).posts} posts</div>
                          : <div className="trending-card__meta">{(m as Movie)?.year || ''} · {(m as Movie)?.duration || '?'} min</div>}
                        <div className="trending-card__actions">
                          {m && <button className="btn-sm-accent" onClick={() => void openMovieDetail(m)}>Detalle</button>}
                          {watched
                            ? <button className="btn-sm-ghost" onClick={(e) => { e.stopPropagation(); void doToggleWatched(mid); }}>Vista ✓</button>
                            : <button className="btn-sm-ghost" onClick={(e) => { e.stopPropagation(); void doToggleWatched(mid); }}>+ Vista</button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── PELÍCULAS ── */}
        {tab === 'peliculas' && (() => {
          const filteredMovies = movies.filter((m) => {
            const searchLower = searchTerm.toLowerCase();
            const title = (m.title || m.titulo || '').toLowerCase();
            const desc = (m.description || m.descripcion || m.synopsis || '').toLowerCase();
            return title.includes(searchLower) || desc.includes(searchLower);
          });
          const displayMovies = filteredMovies.slice(0, visibleCount);
          const totalDisplay = filteredMovies.length;

          return (
            <div className="section">
              <div className="section-title">PELÍCULAS <span>Mostrando {Math.min(visibleCount, totalDisplay)} de {totalDisplay}</span></div>
              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  className="fld"
                  placeholder="🔍 Buscar película por título..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setVisibleCount(120);
                  }}
                  style={{ maxWidth: '400px' }}
                />
              </div>
              {displayMovies.length === 0 && searchTerm ? (
                <div className="empty-state">
                  <div className="icon">🎬</div>
                  <p>No se encontraron películas que coincidan con "{searchTerm}".<br />Intenta con otro término de búsqueda.</p>
                </div>
              ) : (
                <>
                  <div className="movies-grid">
                    {displayMovies.map((m) => (
                      <article key={m.id} className="movie-card" onClick={() => void openMovieDetail(m)}>
                        <div className="movie-card__poster"><Poster movie={m} /></div>
                        <div className="movie-card__body">
                          <h4>{m.title || m.titulo || 'Sin título'}</h4>
                          <p>{m.year || m.año || 's/f'} · {m.duration || m.duracion || '?'} min</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  {visibleCount < totalDisplay && (
                    <div className="load-more"><button onClick={() => setVisibleCount((v) => v + 120)}>Cargar más películas</button></div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ── FORO ── */}
        {tab === 'foro' && (
          <div className="section">
            <div className="section-title">FORO</div>
            <div className="forum-layout">
              <div className="thread-form-card">
                <h3>Nuevo Thread</h3>
                <input className="fld" placeholder="Título del thread" value={threadDraft.title} onChange={(e) => setThreadDraft((p) => ({ ...p, title: e.target.value }))} />
                <input className="fld" placeholder="Movie ID (ej: 100)" value={threadDraft.movieId} onChange={(e) => setThreadDraft((p) => ({ ...p, movieId: e.target.value }))} />
                <textarea className="fld" placeholder="Contenido del thread..." value={threadDraft.body} onChange={(e) => setThreadDraft((p) => ({ ...p, body: e.target.value }))} />
                <button className="btn-primary" onClick={() => void doCreateThread()}>Publicar thread</button>
              </div>
              <div className="threads-list">
                {threads.length === 0
                  ? <div className="empty-state"><div className="icon">💬</div><p>No hay threads todavía.<br />¡Sé el primero en abrir una discusión!</p></div>
                  : threads.slice(0, 50).map((t, i) => (
                    <article key={t.id || t._id || i} className="thread-item">
                      <h4>{t.title || 'Sin título'}</h4>
                      <p>{t.body || 'Sin contenido'}</p>
                      <div className="thread-meta">
                        <span>Usuario {t.userId ?? 'N/A'}</span>
                        <span>Movie {t.movieId ?? 'N/A'}</span>
                        <button onClick={() => void openThread(t)}>Ver thread →</button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PERFIL ── */}
        {tab === 'perfil' && (
          <div className="section">
            <div className="profile-grid">
              <div className="profile-card">
                <div className="profile-avatar">{(usuario.nombre[0] ?? '?').toUpperCase()}</div>
                <h3>{usuario.nombre}</h3>
                <div className="role">{usuario.rol || 'usuario'}</div>
                <div className="profile-stats-grid">
                  <div className="profile-stat"><div className="val">{historial.length}</div><div className="lbl">Vistas</div></div>
                </div>
                <div className="profile-info">
                  <p><strong>ID:</strong> {usuario.id}</p>
                  <p><strong>Correo:</strong> {usuario.email}</p>
                  <p><strong>País:</strong> {usuario.pais}</p>
                  {usuario.fecha_registro && <p><strong>Registro:</strong> {fmt(usuario.fecha_registro)}</p>}
                </div>
                <button className="edit-btn" onClick={() => {
                  setPerfil({ nombre: usuario.nombre, email: usuario.email, pais: usuario.pais, password: '' });
                  setShowEditModal(true);
                }}>Editar perfil</button>
              </div>

              <div>
                <div className="section-title">HISTORIAL DE VISTAS</div>
                {historial.length === 0
                  ? <div className="empty-state"><div className="icon">👁️</div><p>Aún no tienes historial.<br />Marca películas como vistas para verlas aquí.</p></div>
                  : <div className="history-grid">
                    {historial.slice(0, 24).map((h, i) => {
                      const pid = h.pelicula_id;
                      if (!pid) return null;
                      const movie = movies.find((m) => m.id === pid);
                      return (
                        <article key={i} className="history-card" onClick={() => movie && void openMovieDetail(movie)}>
                          <div className="history-card__poster"><Poster movie={movie || { id: pid, title: `Película ${pid}` }} /></div>
                          <div className="history-card__body">
                            <h4>{movie?.title || movie?.titulo || `Película ${pid}`}</h4>
                            {h.fecha_vista && <small>{fmt(h.fecha_vista)}</small>}
                          </div>
                        </article>
                      );
                    })}
                  </div>}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (() => {
          const ad = analyticsData;

          const maxGen  = Math.max(1, ...(ad?.generos.map(g => Number(g.total_peliculas ?? 0)) ?? [1]));
          const maxAct  = Math.max(1, ...(ad?.actoresTop.map(a => Number(a.total_peliculas ?? 0)) ?? [1]));
          const maxDir  = Math.max(1, ...(ad?.directoresTop.map(d => Number(d.total_peliculas ?? 0)) ?? [1]));
          const maxPais = Math.max(1, ...(ad?.usuariosPais.map(p => Number(p.total_usuarios ?? 0)) ?? [1]));
          const maxUser = Math.max(1, ...(ad?.usuariosTop.map(u => Number(u.peliculas_vistas ?? 0)) ?? [1]));
          const maxForo = Math.max(1, ...(ad?.forosMasActivos.map(f => Number(f.total_mensajes ?? 0)) ?? [1]));

          const resU = ad?.resumenUsuarios ?? {};
          const resF = ad?.resumenForos ?? {};
          const topViewed = buildTopViewedMovies(historial, movies);

          return (
            <div className="section">
              <div className="section-title">ANALYTICS <span>Datos en tiempo real</span></div>

              {analyticsLoading && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
                  <div className="loader-bar" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', fontSize: '0.8rem' }}>Cargando estadísticas...</p>
                </div>
              )}

              {!analyticsLoading && ad && (
                <>
                  {/* ── RESUMEN SUPERIOR ── */}
                  {(Object.keys(resU).length > 0 || Object.keys(resF).length > 0) && (
                    <div className="stats-bar" style={{ marginBottom: '1.5rem' }}>
                      {Object.entries(resU).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="stat-item">
                          <div className="val">{typeof v === 'number' ? v.toLocaleString() : String(v ?? 0)}</div>
                          <div className="lbl">{k.replace(/_/g, ' ')}</div>
                        </div>
                      ))}
                      {Object.entries(resF).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="stat-item">
                          <div className="val">{typeof v === 'number' ? v.toLocaleString() : String(v ?? 0)}</div>
                          <div className="lbl">{k.replace(/_/g, ' ')}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {topViewed.length > 0 && (
                    <div className="analytics-card" style={{ marginBottom: '1.5rem' }}>
                      <h4>👁️ Películas más vistas</h4>
                      {topViewed.map((item, i) => (
                        <div key={item.pelicula_id} className="analytics-row">
                          <div className="analytics-rank">{i + 1}</div>
                          <div className="analytics-name" title={item.movie?.title || item.movie?.titulo || `Película ${item.pelicula_id}`}>
                            {item.movie?.title || item.movie?.titulo || `Película ${item.pelicula_id}`}
                          </div>
                          <div className="analytics-count">{item.count} vistas</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── TOP PELÍCULAS CALIFICADAS ── */}
                  {ad.topCalificadas.length > 0 && (
                    <>
                      <div className="section-title" style={{ fontSize: '1.1rem', marginBottom: '.8rem' }}>
                        🏆 TOP PELÍCULAS CALIFICADAS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginBottom: '2rem' }}>
                        {ad.topCalificadas.slice(0, 10).map((m, i) => (
                          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.75)', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '1rem', padding: '2px 7px', borderRadius: '4px', zIndex: 1 }}>
                              #{i + 1}
                            </div>
                            <div style={{ aspectRatio: '2/3', background: 'var(--surface2)', overflow: 'hidden' }}>
                              <Poster movie={m as Movie} />
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.3 }}>
                                {m.title || m.titulo || 'Sin título'}
                              </div>
                              {m.rating && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>⭐ {Number(m.rating).toFixed(1)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── GRIDS DE STATS ── */}
                  <div className="analytics-grid" style={{ marginBottom: '2rem' }}>

                    {/* Géneros — backend: { genero, total_peliculas } */}
                    {ad.generos.length > 0 && (
                      <div className="analytics-card">
                        <h4>🎭 Géneros</h4>
                        {ad.generos.slice(0, 8).map((g, i) => {
                          const nombre = g.genero ?? '?';
                          const cant = Number(g.total_peliculas ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name">{nombre}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxGen) * 100)}%` }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actores — backend: { actor, nacionalidad, total_peliculas } */}
                    {ad.actoresTop.length > 0 && (
                      <div className="analytics-card">
                        <h4>🎬 Actores Top</h4>
                        {ad.actoresTop.slice(0, 8).map((a, i) => {
                          const nombre = a.actor ?? '?';
                          const cant = Number(a.total_peliculas ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name" title={a.nacionalidad}>{nombre}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxAct) * 100)}%`, background: 'var(--accent2)' }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Directores — backend: { director, total_peliculas } */}
                    {ad.directoresTop.length > 0 && (
                      <div className="analytics-card">
                        <h4>🎥 Directores Top</h4>
                        {ad.directoresTop.slice(0, 8).map((d, i) => {
                          const nombre = d.director ?? '?';
                          const cant = Number(d.total_peliculas ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name">{nombre}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxDir) * 100)}%`, background: '#7c6fe0' }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Usuarios por País — backend: { pais, total_usuarios } */}
                    {ad.usuariosPais.length > 0 && (
                      <div className="analytics-card">
                        <h4>🌎 Usuarios por País</h4>
                        {ad.usuariosPais.slice(0, 8).map((p, i) => {
                          const nombre = p.pais ?? '?';
                          const cant = Number(p.total_usuarios ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name">{nombre}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxPais) * 100)}%`, background: '#4aae8c' }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Usuarios Top — backend: { usuario_id, nombre, pais, peliculas_vistas } */}
                    {ad.usuariosTop.length > 0 && (
                      <div className="analytics-card">
                        <h4>👁️ Top Usuarios Activos</h4>
                        {ad.usuariosTop.slice(0, 8).map((u, i) => {
                          const nombre = u.nombre ?? `Usuario ${u.usuario_id ?? i + 1}`;
                          const cant = Number(u.peliculas_vistas ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name" title={u.pais}>{nombre}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxUser) * 100)}%`, background: '#e8a84a' }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Foros más activos — backend: { foro_id, total_mensajes } */}
                    {ad.forosMasActivos.length > 0 && (
                      <div className="analytics-card">
                        <h4>💬 Foros Más Activos</h4>
                        {ad.forosMasActivos.slice(0, 8).map((f, i) => {
                          const titulo = `Foro ${f.foro_id ?? i + 1}`;
                          const cant = Number(f.total_mensajes ?? 0);
                          return (
                            <div key={i} className="analytics-row">
                              <div className="analytics-rank">{i + 1}</div>
                              <div className="analytics-name">{titulo}</div>
                              <div className="analytics-bar-wrap">
                                <div className="analytics-bar" style={{ width: `${Math.round((cant / maxForo) * 100)}%`, background: '#4a9ae8' }} />
                              </div>
                              <div className="analytics-count">{cant.toLocaleString()}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                </>
              )}

              {!analyticsLoading && !ad && (
                <div className="empty-state">
                  <div className="icon">📊</div>
                  <p>No se pudieron cargar las estadísticas.<br />Verifica la conexión con el servidor de analytics.</p>
                  <button onClick={() => void loadAnalytics()}>Reintentar</button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── MODAL PELÍCULA ── */}
      {selMovie && (
        <div className="modal-overlay" onClick={() => setSelMovie(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-close"><button onClick={() => setSelMovie(null)}>✕</button></div>
            <div className="movie-detail">
              <div className="movie-detail__poster"><Poster movie={selMovie} /></div>
              <div className="movie-detail__info">
                <h2>{selMovie.title || selMovie.titulo || 'Sin título'}</h2>
                <div className="movie-detail__year">{selMovie.year || selMovie.año || 's/f'} · {selMovie.duration || selMovie.duracion || '?'} min</div>
                {selMovie.rating && <div className="rating-badge">⭐ {selMovie.rating}</div>}
                <p className="movie-detail__desc">{selMovie.description || selMovie.descripcion || 'Sin descripción disponible.'}</p>
                <div className="genre-tags">
                  {(selMovie.genres || []).map((g, i) => (
                    <span key={i} className="genre-tag">{typeof g === 'string' ? g : g?.name || ''}</span>
                  ))}
                </div>
                {selMovie.directors?.length ? <p className="meta-row"><strong>Dirección:</strong> {nameList(selMovie.directors as Array<{ name?: string } | string>)}</p> : null}
                {selMovie.actors?.length ? <p className="meta-row"><strong>Reparto:</strong> {nameList(selMovie.actors as Array<{ name?: string } | string>)}</p> : null}
                <div className="detail-actions">
                  {viewedIds.includes(selMovie.id)
                    ? <button className="btn-sm-ghost" onClick={(e) => { e.stopPropagation(); void doToggleWatched(selMovie.id); }}>Vista ✓</button>
                    : <button className="btn-sm-accent" onClick={(e) => { e.stopPropagation(); void doToggleWatched(selMovie.id); }}>+ Marcar vista</button>}
                </div>
              </div>
            </div>
            <div className="modal-divider" />
            <div className="modal-section">
              <h3>Escribir reseña</h3>
              <div className="review-form">
                <label>Rating (1–10)</label>
                <input className="fld" type="number" min={1} max={10} step={0.1} value={reviewDraft.rating} onChange={(e) => setReviewDraft((p) => ({ ...p, rating: Number(e.target.value) }))} />
                <label>Comentario</label>
                <textarea className="fld" placeholder="Tu opinión sobre la película..." value={reviewDraft.comment} onChange={(e) => setReviewDraft((p) => ({ ...p, comment: e.target.value }))} />
                <button className="btn-primary" onClick={() => void doCreateReview()}>Publicar reseña</button>
              </div>
              <h3>Reseñas ({movieReviews.length})</h3>
              {reviewLoading && <p style={{ color: 'var(--muted)', fontSize: '.8rem', marginBottom: '1rem' }}>Cargando reseñas...</p>}
              {!reviewLoading && movieReviews.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Aún no hay reseñas para esta película.</p>}
              <div className="reviews-list">
                {movieReviews.map((r, i) => (
                  <div key={r.id ?? i} className="review-item">
                    <div className="review-item__head">
                      <span className="review-item__author">{r.author || 'Anónimo'}</span>
                      <span className="review-item__rating">⭐ {r.rating ?? 'N/D'}</span>
                    </div>
                    <div className="review-item__comment">{r.comment || 'Sin comentario'}</div>
                    {(r.created_at || r.date) && <div className="review-item__date">{fmt(r.created_at || r.date)}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL THREAD ── */}
      {selThread && (
        <div className="modal-overlay" onClick={() => { setSelThread(null); setThreadPosts([]); }}>
          <div className="modal-card medium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-close"><button onClick={() => { setSelThread(null); setThreadPosts([]); }}>✕</button></div>
            <div className="thread-modal-head">
              <h2>{selThread.title || 'Thread'}</h2>
              <p>{selThread.body || 'Sin contenido.'}</p>
              <div className="tmeta">Usuario {selThread.userId ?? 'N/A'} · Movie {selThread.movieId ?? 'N/A'}</div>
            </div>
            <div className="modal-divider" />
            <div className="modal-section">
              <h3>Posts ({threadPosts.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                <textarea className="fld" placeholder="Escribe tu respuesta..." value={postDraft} onChange={(e) => setPostDraft(e.target.value)} />
                <button className="btn-primary" onClick={() => void doCreatePost()}>Publicar post</button>
              </div>
              {loadingThread && <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Cargando posts...</p>}
              {!loadingThread && threadPosts.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>No hay posts aún. ¡Sé el primero!</p>}
              <div className="posts-list">
                {threadPosts.slice(0, 50).map((p, i) => (
                  <div key={p.id || p._id || i} className="post-item">
                    <p>{p.body || 'Sin contenido'}</p>
                    <small>Usuario {p.userId ?? 'N/A'} {p.date ? `· ${fmt(p.date)}` : ''}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PERFIL ── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-card narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-close"><button onClick={() => setShowEditModal(false)}>✕</button></div>
            <div className="edit-profile-body">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '.06em', marginBottom: '.5rem' }}>Editar perfil</h3>
              <label>Nombre</label>
              <input className="fld" value={perfil.nombre} onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
              <label>País</label>
              <input className="fld" value={perfil.pais} onChange={(e) => setPerfil((p) => ({ ...p, pais: e.target.value }))} placeholder="Tu país" />
              <label>Nueva contraseña (opcional)</label>
              <input className="fld" type="password" value={perfil.password} onChange={(e) => setPerfil((p) => ({ ...p, password: e.target.value }))} placeholder="Dejar en blanco para no cambiar" />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Nota: el backend sólo actualiza nombre y país. El correo no es editable.</p>
              <div className="edit-profile-actions">
                <button className="edit-btn" onClick={() => setShowEditModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={() => void saveProfile()}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}