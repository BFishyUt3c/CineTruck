from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import httpx
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

# Configurar logging para ver qué está pasando
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Obtener URLs de los otros microservicios desde variables de entorno
MS1_URL = os.getenv("MS1_URL", "http://ms1-usuarios:8000")
MS2_URL = os.getenv("MS2_URL", "http://ms2-peliculas:3000")
MS3_URL = os.getenv("MS3_URL", "http://ms3-foro:8080")

# Credenciales para autenticación en MS1 (desde variables de entorno)
MS1_EMAIL = os.getenv("MS1_EMAIL", "eladminps@gmail.com")
MS1_PASSWORD = os.getenv("MS1_PASSWORD", "elpapuproadmin")

# Tiempo máximo para esperar respuesta de otros servicios
TIMEOUT = 10

# Crear la aplicación FastAPI
app = FastAPI(
    title="Microservicio 4: Orquestador",
    description="Combina información de usuarios, películas y foros",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Modelos para las respuestas

class PerfilCompleto(BaseModel):
    """Toda la información del usuario en un solo lugar"""
    usuario_id: int
    usuario_info: Optional[Dict[str, Any]] = None
    historial_peliculas: Optional[List[Dict[str, Any]]] = None
    grupos: Optional[List[Dict[str, Any]]] = None
    errores: List[str] = []

class EstadisticasUsuario(BaseModel):
    """Resumen de las películas vistas por el usuario"""
    usuario_id: int
    total_peliculas_vistas: int
    conteo_por_genero: Dict[str, int]
    genero_favorito: Optional[str] = None
    ultima_pelicula: Optional[str] = None

class HealthCheck(BaseModel):
    """Estado de salud del orquestador y sus dependencias"""
    status: str
    ms1_status: str
    ms2_status: str
    ms3_status: str
    timestamp: str

# Funciones auxiliares

def verificar_salud_microservicio(url: str, timeout: int = TIMEOUT) -> bool:
    """Intenta conectar a un microservicio para ver si está activo"""
    try:
        import httpx as sync_httpx
        
        # Determinar si es MS1 para usar autenticación
        usar_auth = (url == MS1_URL)
        auth = (MS1_EMAIL, MS1_PASSWORD) if usar_auth else None
        
        # Intentar primero con /health
        try:
            response = sync_httpx.get(f"{url}/health", timeout=timeout, auth=auth)
            if response.status_code == 200:
                return True
        except:
            pass
        
        # Si /health no existe o falla, intentar con /usuarios (MS1) o /api/movies (MS2)
        endpoints_alternos = ["/usuarios", "/api/movies", "/api/threads"]
        for endpoint in endpoints_alternos:
            try:
                response = sync_httpx.get(f"{url}{endpoint}", timeout=timeout, auth=auth)
                if response.status_code in [200, 404]:  # 200 = existe, 404 = al menos responde
                    return True
            except:
                continue
        
        return False
    except Exception as e:
        logger.warning(f"No se pudo conectar a {url}: {str(e)}")
        return False

async def obtener_usuario_ms1(usuario_id: int) -> Optional[Dict[str, Any]]:
    """Pide la info del usuario a MS1 con autenticación"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS1_URL}/usuarios/{usuario_id}",
                auth=(MS1_EMAIL, MS1_PASSWORD),
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return None
            else:
                logger.error(f"Error en MS1: {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"No se pudo conectar a MS1: {str(e)}")
        return None

async def obtener_historial_ms1(usuario_id: int) -> Optional[Dict[str, Any]]:
    """Pide el historial de películas vistas a MS1 con autenticación"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS1_URL}/usuarios/{usuario_id}/peliculas_vistas",
                auth=(MS1_EMAIL, MS1_PASSWORD),
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                peliculas = response.json()
                return {"peliculas_vistas": peliculas if isinstance(peliculas, list) else []}
            else:
                logger.warning(f"MS1 respondió con: {response.status_code}")
                return None
    except Exception as e:
        logger.error(f"No se pudo obtener historial de MS1: {str(e)}")
        return None

async def obtener_threads_ms3(usuario_id: int) -> Optional[List[Dict[str, Any]]]:
    """Obtiene los threads (como grupos/comunidades) disponibles en MS3
    Nota: MS3 no tiene endpoint específico por usuario, así que retorna todos los threads
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/threads",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
            else:
                logger.warning(f"MS3 respondió con: {response.status_code}")
                return []
    except Exception as e:
        logger.error(f"No se pudo conectar a MS3: {str(e)}")
        return []

async def obtener_threads_creados_ms3(usuario_id: int) -> List[Dict[str, Any]]:
    """Obtiene threads creados por un usuario específico"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/threads",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                threads = data if isinstance(data, list) else data.get("data", [])
                
                # Filtrar threads del usuario (comparar como string)
                threads_usuario = []
                for t in threads:
                    if t and isinstance(t, dict):
                        user_id_thread = t.get("userId")
                        if user_id_thread and str(user_id_thread) == str(usuario_id):
                            threads_usuario.append(t)
                
                return threads_usuario
            return []
    except Exception as e:
        logger.error(f"Error obteniendo threads creados: {str(e)}")
        return []

async def obtener_posts_usuario_ms3(usuario_id: int) -> List[Dict[str, Any]]:
    """Obtiene posts creados por un usuario en MS3"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/posts/all?page=0&size=1000",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                # MS3 devuelve Page<Post>, extraer content
                if isinstance(data, dict):
                    posts = data.get("content", [])
                else:
                    posts = data if isinstance(data, list) else []
                
                # Filtrar posts del usuario (comparar como string)
                posts_usuario = []
                for p in posts:
                    if p and isinstance(p, dict):
                        user_id_post = p.get("userId")
                        if user_id_post and str(user_id_post) == str(usuario_id):
                            posts_usuario.append(p)
                
                return posts_usuario
            return []
    except Exception as e:
        logger.warning(f"No se pudo obtener posts del usuario: {str(e)}")
        return []

async def obtener_todas_peliculas_ms2() -> List[Dict[str, Any]]:
    """Obtiene todas las películas de MS2"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS2_URL}/api/movies",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
            return []
    except Exception as e:
        logger.warning(f"Error obteniendo películas: {str(e)}")
        return []

# Endpoints de la API

@app.get("/", tags=["General"])
async def raiz():
    """Endpoint raíz para verificar que el servicio está corriendo"""
    return {
        "mensaje": "Microservicio Orquestador funcionando",
        "version": "1.0.0",
        "documentacion": "/docs"
    }

@app.get("/health", tags=["General"])
async def health_check() -> HealthCheck:
    """Verifica si el orquestador y todos los microservicios están activos"""
    ms1_ok = verificar_salud_microservicio(MS1_URL)
    ms2_ok = verificar_salud_microservicio(MS2_URL)
    ms3_ok = verificar_salud_microservicio(MS3_URL)
    
    estado_general = "healthy" if (ms1_ok and ms2_ok and ms3_ok) else "degraded"
    
    return HealthCheck(
        status=estado_general,
        ms1_status="healthy" if ms1_ok else "unhealthy",
        ms2_status="healthy" if ms2_ok else "unhealthy",
        ms3_status="healthy" if ms3_ok else "unhealthy",
        timestamp=datetime.now().isoformat()
    )

@app.get("/api/v1/movies", 
         tags=["Películas"],
         summary="Obtener todas las películas")
async def obtener_peliculas():
    """Obtiene todas las películas desde MS2 (a través del Orquestador MS4)"""
    peliculas = await obtener_todas_peliculas_ms2()
    return {
        "data": peliculas,
        "total": len(peliculas)
    }

@app.get("/api/v1/users/{usuario_id}", 
         response_model=PerfilCompleto,
         tags=["Usuarios"],
         summary="Perfil completo del usuario")
async def obtener_perfil_completo(usuario_id: int) -> PerfilCompleto:
    """
    Trae toda la información del usuario de los tres microservicios:
    - Datos básicos de MS1
    - Películas vistas de MS2
    - Grupos en los que está de MS3
    
    Retorna los datos disponibles + lista de errores en caso de fallas parciales
    """
    errores = []
    
    # Obtener datos de los tres servicios
    usuario_info = await obtener_usuario_ms1(usuario_id)
    if usuario_info is None:
        errores.append("Usuario no encontrado en MS1 (404)")
    
    historial = await obtener_historial_ms1(usuario_id)
    if historial is None:
        errores.append("No se pudo obtener historial de MS1")
    
    threads = await obtener_threads_ms3(usuario_id)
    if not threads:
        errores.append("No hay threads disponibles en MS3")
    
    # Extraer lista de películas del historial si es un dict
    peliculas_lista = None
    if historial and isinstance(historial, dict):
        peliculas_lista = historial.get("peliculas_vistas", [])
    
    # Retornar respuesta con los datos disponibles
    # Si no hay usuario, igualmente retornar el objeto con None
    return PerfilCompleto(
        usuario_id=usuario_id,
        usuario_info=usuario_info,
        historial_peliculas=peliculas_lista,
        grupos=threads if threads else [],
        errores=errores
    )

@app.get("/api/v1/users/{usuario_id}/stats", 
         response_model=EstadisticasUsuario,
         tags=["Usuarios"],
         summary="Estadísticas del usuario")
async def obtener_estadisticas(usuario_id: int) -> EstadisticasUsuario:
    """
    Muestra un resumen de las películas que vio el usuario:
    - Cuántas películas vio en total
    - Cuáles géneros vio más
    - Cuál es su género favorito
    """
    # Obtener el historial de MS1
    historial = await obtener_historial_ms1(usuario_id)
    
    # Procesar datos reales del historial
    total_peliculas = 0
    conteo_genero = {}
    ultima_pelicula = None
    
    if historial and isinstance(historial, dict):
        peliculas = historial.get("peliculas_vistas", [])
        total_peliculas = len(peliculas)
        
        # Contar géneros si están disponibles
        for pelicula in peliculas:
            genero = pelicula.get("genero", "Desconocido")
            conteo_genero[genero] = conteo_genero.get(genero, 0) + 1
        
        # Obtener última película
        if peliculas:
            ultima_pelicula = peliculas[0].get("titulo", "Desconocida")
    
    # Si no hay datos, usar valores por defecto
    if not conteo_genero:
        conteo_genero = {"Acción": 0, "Drama": 0, "Comedia": 0}
    
    # Calcular género favorito (evitar error de tipo en max)
    genero_favorito = None
    if conteo_genero:
        genero_favorito = max(conteo_genero.items(), key=lambda x: x[1])[0]
    
    return EstadisticasUsuario(
        usuario_id=usuario_id,
        total_peliculas_vistas=total_peliculas,
        conteo_por_genero=conteo_genero,
        genero_favorito=genero_favorito,
        ultima_pelicula=ultima_pelicula
    )

@app.get("/api/v1/users/{usuario_id}/history",
         tags=["Usuarios"],
         summary="Historial de películas")
async def obtener_historial(usuario_id: int):
    """Retorna el historial de películas vistas por el usuario (desde MS1)"""
    historial = await obtener_historial_ms1(usuario_id)
    
    if historial is None:
        return {
            "usuario_id": usuario_id,
            "peliculas_vistas": [],
            "total": 0,
            "error": "No se pudo obtener el historial"
        }
    
    peliculas = historial.get("peliculas_vistas", [])
    return {
        "usuario_id": usuario_id,
        "peliculas_vistas": peliculas,
        "total": len(peliculas)
    }

@app.get("/api/v1/users/{usuario_id}/groups",
         tags=["Usuarios"],
         summary="Comunidades (threads) disponibles")
async def obtener_comunidades(usuario_id: int):
    """Retorna los threads (comunidades) disponibles en MS3
    Nota: MS3 no filtra por usuario específico, retorna todos los threads disponibles
    """
    threads = await obtener_threads_ms3(usuario_id)
    
    return {
        "usuario_id": usuario_id,
        "threads_disponibles": threads,
        "total": len(threads) if isinstance(threads, list) else 0
    }

@app.get("/api/v1/users/{usuario_id}/created-groups",
         tags=["Usuarios"],
         summary="Grupos creados por el usuario")
async def obtener_grupos_creados(usuario_id: int):
    """Retorna los threads/grupos creados por el usuario en MS3"""
    threads_creados = await obtener_threads_creados_ms3(usuario_id)
    
    return {
        "usuario_id": usuario_id,
        "grupos_creados": threads_creados,
        "total": len(threads_creados)
    }

@app.get("/api/v1/users/{usuario_id}/participated-groups",
         tags=["Usuarios"],
         summary="Grupos donde el usuario participó")
async def obtener_grupos_participados(usuario_id: int):
    """Retorna los threads donde el usuario ha escrito posts"""
    posts = await obtener_posts_usuario_ms3(usuario_id)
    
    # Extraer thread IDs únicos donde el usuario participó
    thread_ids = set()
    for post in posts:
        thread_id = post.get("threadId")
        if thread_id:
            thread_ids.add(thread_id)
    
    return {
        "usuario_id": usuario_id,
        "thread_ids_participados": list(thread_ids),
        "total": len(thread_ids)
    }

@app.get("/api/v1/users/{usuario_id}/top-genres",
         tags=["Análisis"],
         summary="Géneros más visto del usuario")
async def obtener_generos_top(usuario_id: int):
    """Retorna los géneros más vistos por el usuario ordenados por frecuencia"""
    historial = await obtener_historial_ms1(usuario_id)
    
    if not historial:
        return {
            "usuario_id": usuario_id,
            "generos": [],
            "error": "Sin historial"
        }
    
    peliculas = historial.get("peliculas_vistas", [])
    conteo = {}
    
    for pelicula in peliculas:
        genero = pelicula.get("genero", "Desconocido")
        conteo[genero] = conteo.get(genero, 0) + 1
    
    # Ordenar por cantidad (descendente)
    ordenado = sorted(conteo.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "usuario_id": usuario_id,
        "generos_ordenados": [{"genero": g, "cantidad": c} for g, c in ordenado]
    }

@app.get("/api/v1/movies/stats",
         tags=["Análisis"],
         summary="Estadísticas generales de películas")
async def obtener_stats_peliculas():
    """Retorna estadísticas generales de todas las películas
    - Géneros más populares
    - Actores más frecuentes
    - Directores más frecuentes
    """
    peliculas = await obtener_todas_peliculas_ms2()
    
    if not peliculas:
        return {
            "error": "No se pudieron obtener películas",
            "generos": {},
            "actores": {},
            "directores": {}
        }
    
    # Contar géneros (asumiendo estructura)
    conteo_generos = {}
    conteo_actores = {}
    conteo_directores = {}
    
    for pelicula in peliculas:
        # Géneros
        genero = pelicula.get("genre", "Desconocido")
        if genero:
            conteo_generos[genero] = conteo_generos.get(genero, 0) + 1
        
        # Actores (si es lista)
        actores = pelicula.get("actors", [])
        if isinstance(actores, list):
            for actor in actores:
                actor_name = actor.get("name") if isinstance(actor, dict) else str(actor)
                if actor_name:
                    conteo_actores[actor_name] = conteo_actores.get(actor_name, 0) + 1
        
        # Directores
        director = pelicula.get("director", "Desconocido")
        if director:
            conteo_directores[director] = conteo_directores.get(director, 0) + 1
    
    # Top 10 de cada uno
    top_generos = sorted(conteo_generos.items(), key=lambda x: x[1], reverse=True)[:10]
    top_actores = sorted(conteo_actores.items(), key=lambda x: x[1], reverse=True)[:10]
    top_directores = sorted(conteo_directores.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total_peliculas": len(peliculas),
        "top_generos": [{"nombre": g, "cantidad": c} for g, c in top_generos],
        "top_actores": [{"nombre": a, "cantidad": c} for a, c in top_actores],
        "top_directores": [{"nombre": d, "cantidad": c} for d, c in top_directores]
    }

    # ─── MODELOS NUEVOS ───────────────────────────────────────────────────────────

class LoginResponse(BaseModel):
    mensaje: str
    usuario_id: int
    email: str
    rol: str

class RegistroRequest(BaseModel):
    nombre: str
    email: str
    password: str
    pais: str

class MarcarVistaRequest(BaseModel):
    usuario_id: int
    pelicula_id: int

# ─── FUNCIONES AUXILIARES NUEVAS ─────────────────────────────────────────────

async def login_ms1(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Hace login en MS1 con Basic Auth"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS1_URL}/auth/login",
                auth=(email, password),
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error en login MS1: {str(e)}")
        return None

async def me_ms1(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Obtiene el usuario actual de MS1"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS1_URL}/auth/me",
                auth=(email, password),
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error en me MS1: {str(e)}")
        return None

async def registro_ms1(datos: dict) -> Optional[Dict[str, Any]]:
    """Registra un usuario en MS1"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS1_URL}/auth/registro",
                json=datos,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error en registro MS1: {str(e)}")
        return None

async def marcar_vista_ms1(usuario_id: int, pelicula_id: int) -> bool:
    """Marca una película como vista en MS1"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS1_URL}/interno/usuarios/{usuario_id}/vista/{pelicula_id}",
                timeout=TIMEOUT
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Error marcando vista: {str(e)}")
        return False

async def quitar_vista_ms1(usuario_id: int, pelicula_id: int) -> bool:
    """Quita una película de vistas en MS1"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{MS1_URL}/interno/usuarios/{usuario_id}/vista/{pelicula_id}",
                timeout=TIMEOUT
            )
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Error quitando vista: {str(e)}")
        return False

async def obtener_peliculas_ms2(limit: int = 50, search: str = "") -> List[Dict[str, Any]]:
    """Obtiene películas de MS2 con búsqueda opcional"""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{MS2_URL}/api/movies?limit={limit}"
            if search:
                url += f"&search={search}"
            response = await client.get(url, timeout=TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, list) else data.get("data", [])
            return []
    except Exception as e:
        logger.error(f"Error obteniendo películas: {str(e)}")
        return []

async def obtener_pelicula_ms2(pelicula_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene una película específica de MS2"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS2_URL}/api/movies/{pelicula_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error obteniendo película: {str(e)}")
        return None

async def crear_resena_ms2(pelicula_id: int, datos: dict) -> Optional[Dict[str, Any]]:
    """Crea una reseña en MS2"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS2_URL}/api/movies/{pelicula_id}/reviews",
                json=datos,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception as e:
        logger.error(f"Error creando reseña: {str(e)}")
        return None

async def obtener_posts_ms3(limit: int = 5000) -> List[Dict[str, Any]]:
    """Obtiene posts paginados de MS3"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/posts/all?page=0&size={limit}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    return data.get("content", [])
                return data if isinstance(data, list) else []
            return []
    except Exception as e:
        logger.warning(f"No se pudo obtener posts de MS3: {str(e)}")
        return []

async def obtener_mensajes_ms3(limit: int = 5000) -> List[Dict[str, Any]]:
    """Obtiene mensajes paginados de MS3"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/messages/all?page=0&size={limit}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    return data.get("content", [])
                return data if isinstance(data, list) else []
            return []
    except Exception as e:
        logger.warning(f"No se pudo obtener mensajes de MS3: {str(e)}")
        return []

def normalizar_titulo_pelicula(pelicula: Dict[str, Any]) -> str:
    return pelicula.get("title") or pelicula.get("titulo") or f"Pelicula {pelicula.get('id', 'N/A')}"

# ─── ENDPOINTS NUEVOS ─────────────────────────────────────────────────────────

@app.get("/api/v1/auth/login", tags=["Auth"])
async def login_get(request: Request):
    """Login con Basic Auth — el frontend manda el header Authorization"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Se requiere Basic Auth")
    
    import base64
    try:
        credenciales = base64.b64decode(auth_header[6:]).decode("utf-8")
        email, password = credenciales.split(":", 1)
    except:
        raise HTTPException(status_code=401, detail="Authorization header inválido")
    
    res = await login_ms1(email, password)
    if not res:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    usuario = await me_ms1(email, password)
    return {
        "mensaje": res.get("mensaje"),
        "usuario": usuario
    }

@app.post("/api/v1/auth/login", tags=["Auth"])
async def login_post(request: Request):
    """Login — recibe email y password, llama a MS1"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Se requiere Basic Auth")
    
    import base64
    credenciales = base64.b64decode(auth_header[6:]).decode("utf-8")
    email, password = credenciales.split(":", 1)
    
    res = await login_ms1(email, password)
    if not res:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    usuario = await me_ms1(email, password)
    return {
        "mensaje": res.get("mensaje"),
        "usuario": usuario
    }

@app.get("/api/v1/auth/me", tags=["Auth"])
async def auth_me(request: Request):
    """Obtiene el usuario actual con Basic Auth"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Se requiere Basic Auth")
    
    import base64
    try:
        credenciales = base64.b64decode(auth_header[6:]).decode("utf-8")
        email, password = credenciales.split(":", 1)
    except:
        raise HTTPException(status_code=401, detail="Authorization header inválido")
    
    usuario = await me_ms1(email, password)
    if not usuario:
        raise HTTPException(status_code=401, detail="No autenticado")
    return usuario

@app.post("/api/v1/auth/registro", tags=["Auth"])
async def registro(datos: dict):
    """Registra un nuevo usuario en MS1"""
    res = await registro_ms1(datos)
    if not res or not res.get("id"):
        raise HTTPException(status_code=400, detail="Error al registrar el usuario")
    return res

@app.get("/api/v1/usuarios", tags=["Usuarios"])
async def list_usuarios(request: Request):
    """Lista todos los usuarios (requiere Basic Auth de admin)"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Se requiere autenticación")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS1_URL}/usuarios",
                headers={"authorization": auth_header},
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Error obteniendo usuarios")
    except Exception as e:
        logger.error(f"Error listando usuarios: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.get("/api/v1/usuarios/{usuario_id}", tags=["Usuarios"])
async def get_usuario(usuario_id: int, request: Request):
    """Obtiene un usuario específico"""
    auth_header = request.headers.get("authorization", "")
    try:
        async with httpx.AsyncClient() as client:
            headers = {"authorization": auth_header} if auth_header else {}
            response = await client.get(
                f"{MS1_URL}/usuarios/{usuario_id}",
                headers=headers,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error obteniendo usuario: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.put("/api/v1/usuarios/{usuario_id}", tags=["Usuarios"])
async def update_usuario(usuario_id: int, datos: dict, request: Request):
    """Actualiza un usuario"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Se requiere autenticación")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{MS1_URL}/usuarios/{usuario_id}",
                json=datos,
                headers={"authorization": auth_header},
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error actualizando usuario: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.delete("/api/v1/usuarios/{usuario_id}", tags=["Usuarios"])
async def delete_usuario(usuario_id: int, request: Request):
    """Elimina un usuario"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Se requiere autenticación")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{MS1_URL}/usuarios/{usuario_id}",
                headers={"authorization": auth_header},
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return {"mensaje": "Usuario eliminado"}
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error eliminando usuario: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.get("/api/v1/usuarios/{usuario_id}/peliculas_vistas", tags=["Usuarios"])
async def get_peliculas_vistas(usuario_id: int, request: Request):
    """Obtiene las películas vistas por un usuario"""
    auth_header = request.headers.get("authorization", "")
    try:
        async with httpx.AsyncClient() as client:
            headers = {"authorization": auth_header} if auth_header else {}
            response = await client.get(
                f"{MS1_URL}/usuarios/{usuario_id}/peliculas_vistas",
                headers=headers,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                data = response.json()
                return data if isinstance(data, list) else {"peliculas_vistas": data}
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error obteniendo películas vistas: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.post("/api/v1/interno/usuarios/{usuario_id}/vista/{pelicula_id}", tags=["Usuarios"])
async def marcar_vista_interno(usuario_id: int, pelicula_id: int, request: Request):
    """Marca una película como vista (interno de MS1)"""
    auth_header = request.headers.get("authorization", "")
    try:
        async with httpx.AsyncClient() as client:
            headers = {"authorization": auth_header} if auth_header else {}
            response = await client.post(
                f"{MS1_URL}/interno/usuarios/{usuario_id}/vista/{pelicula_id}",
                headers=headers,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error marcando vista: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.delete("/api/v1/interno/usuarios/{usuario_id}/vista/{pelicula_id}", tags=["Usuarios"])
async def quitar_vista_interno(usuario_id: int, pelicula_id: int, request: Request):
    """Quita una película de vistas (interno de MS1)"""
    auth_header = request.headers.get("authorization", "")
    try:
        async with httpx.AsyncClient() as client:
            headers = {"authorization": auth_header} if auth_header else {}
            response = await client.delete(
                f"{MS1_URL}/interno/usuarios/{usuario_id}/vista/{pelicula_id}",
                headers=headers,
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error quitando vista: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS1")

@app.get("/api/v1/threads", tags=["Foro"])
async def list_threads():
    """Lista todos los threads del foro"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MS3_URL}/api/threads", timeout=TIMEOUT)
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error obteniendo threads: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.post("/api/v1/threads", tags=["Foro"])
async def create_thread(datos: dict):
    """Crea un nuevo thread"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS3_URL}/api/threads",
                json=datos,
                timeout=TIMEOUT
            )
            if response.status_code == 200 or response.status_code == 201:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error creando thread: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.delete("/api/v1/threads/{thread_id}", tags=["Foro"])
async def delete_thread(thread_id: str):
    """Elimina un thread"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{MS3_URL}/api/threads/{thread_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return {"mensaje": "Thread eliminado"}
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error eliminando thread: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.get("/api/v1/posts/thread/{thread_id}", tags=["Foro"])
async def get_posts_thread(thread_id: str):
    """Obtiene posts de un thread"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/posts/thread/{thread_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error obteniendo posts: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.post("/api/v1/posts", tags=["Foro"])
async def create_post(datos: dict):
    """Crea un nuevo post"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS3_URL}/api/posts",
                json=datos,
                timeout=TIMEOUT
            )
            if response.status_code == 200 or response.status_code == 201:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error creando post: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.delete("/api/v1/posts/{post_id}", tags=["Foro"])
async def delete_post(post_id: str):
    """Elimina un post"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{MS3_URL}/api/posts/{post_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return {"mensaje": "Post eliminado"}
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error eliminando post: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.get("/api/v1/messages/thread/{thread_id}", tags=["Foro"])
async def get_messages_thread(thread_id: str):
    """Obtiene mensajes de un thread"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MS3_URL}/api/messages/thread/{thread_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error obteniendo mensajes: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.post("/api/v1/messages", tags=["Foro"])
async def create_message(datos: dict):
    """Crea un nuevo mensaje"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MS3_URL}/api/messages",
                json=datos,
                timeout=TIMEOUT
            )
            if response.status_code == 200 or response.status_code == 201:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error creando mensaje: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.delete("/api/v1/messages/{message_id}", tags=["Foro"])
async def delete_message(message_id: str):
    """Elimina un mensaje"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{MS3_URL}/api/messages/{message_id}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return {"mensaje": "Mensaje eliminado"}
            else:
                raise HTTPException(status_code=response.status_code)
    except Exception as e:
        logger.error(f"Error eliminando mensaje: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.patch("/api/v1/threads/{thread_id}/vote", tags=["Foro"])
async def vote_thread(thread_id: str, delta: int = 1):
    """Vota un thread en MS3 (delta: 1 o -1)"""
    safe_delta = -1 if delta < 0 else 1
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{MS3_URL}/api/threads/{thread_id}/vote?delta={safe_delta}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="No se pudo votar thread")
    except Exception as e:
        logger.error(f"Error votando thread: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.patch("/api/v1/posts/{post_id}/vote", tags=["Foro"])
async def vote_post(post_id: str, delta: int = 1):
    """Vota un post en MS3 (delta: 1 o -1)"""
    safe_delta = -1 if delta < 0 else 1
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{MS3_URL}/api/posts/{post_id}/vote?delta={safe_delta}",
                timeout=TIMEOUT
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="No se pudo votar post")
    except Exception as e:
        logger.error(f"Error votando post: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con MS3")

@app.get("/api/v1/movies", tags=["Películas"])
async def get_peliculas(limit: int = 50, search: str = ""):
    """Lista de películas de MS2"""
    peliculas = await obtener_peliculas_ms2(limit, search)
    return {"data": peliculas, "total": len(peliculas)}

@app.get("/api/v1/movies/{pelicula_id}", tags=["Películas"])
async def get_pelicula(pelicula_id: int):
    """Detalle de una película de MS2"""
    pelicula = await obtener_pelicula_ms2(pelicula_id)
    if not pelicula:
        raise HTTPException(status_code=404, detail="Película no encontrada")
    return pelicula

@app.post("/api/v1/movies/{pelicula_id}/reviews", tags=["Películas"])
async def crear_resena(pelicula_id: int, datos: dict):
    """Crea una reseña en MS2"""
    res = await crear_resena_ms2(pelicula_id, datos)
    if not res:
        raise HTTPException(status_code=400, detail="Error al crear reseña")
    return res

@app.get("/api/v1/movies/social/trending-talk", tags=["Películas"])
async def trending_talk(limit: int = 10):
    """Ranking de películas más habladas usando datos reales de MS2 y MS3"""
    peliculas = await obtener_todas_peliculas_ms2()
    threads = await obtener_threads_ms3(0)
    posts = await obtener_posts_ms3()
    mensajes = await obtener_mensajes_ms3()

    movies_by_id = {}
    for p in peliculas:
        movie_id = str(p.get("id"))
        movies_by_id[movie_id] = p

    stats = {}
    for th in threads or []:
        movie_id = str(th.get("movieId", ""))
        thread_id = str(th.get("id") or th.get("_id") or "")
        if not movie_id or movie_id not in movies_by_id:
            continue
        if movie_id not in stats:
            stats[movie_id] = {"threads": 0, "posts": 0, "messages": 0, "votes": 0, "thread_ids": set()}
        stats[movie_id]["threads"] += 1
        stats[movie_id]["votes"] += int(th.get("votes", 0) or 0)
        if thread_id:
            stats[movie_id]["thread_ids"].add(thread_id)

    thread_to_movie = {}
    for movie_id, val in stats.items():
        for tid in val["thread_ids"]:
            thread_to_movie[tid] = movie_id

    for post in posts or []:
        tid = str(post.get("threadId", ""))
        movie_id = thread_to_movie.get(tid)
        if not movie_id:
            continue
        stats[movie_id]["posts"] += 1
        stats[movie_id]["votes"] += int(post.get("votes", 0) or 0)

    for msg in mensajes or []:
        tid = str(msg.get("threadId", ""))
        movie_id = thread_to_movie.get(tid)
        if not movie_id:
            continue
        stats[movie_id]["messages"] += 1

    ranking = []
    for movie_id, val in stats.items():
        score = (val["threads"] * 3) + (val["posts"] * 2) + val["messages"] + (val["votes"] * 0.5)
        movie = movies_by_id[movie_id]
        ranking.append({
            "movie_id": int(movie_id) if movie_id.isdigit() else movie_id,
            "title": normalizar_titulo_pelicula(movie),
            "threads": val["threads"],
            "posts": val["posts"],
            "messages": val["messages"],
            "votes": val["votes"],
            "score": round(score, 2)
        })

    ranking.sort(key=lambda x: x["score"], reverse=True)
    return {"data": ranking[:max(1, limit)], "total": len(ranking)}

@app.get("/api/v1/movies/{pelicula_id}/insights", tags=["Películas"])
async def movie_insights(pelicula_id: int):
    """Métricas enriquecidas de una película cruzando MS1, MS2 y MS3"""
    pelicula = await obtener_pelicula_ms2(pelicula_id)
    if not pelicula:
        raise HTTPException(status_code=404, detail="Película no encontrada")

    threads = await obtener_threads_ms3(0)
    posts = await obtener_posts_ms3()
    mensajes = await obtener_mensajes_ms3()

    movie_threads = [t for t in (threads or []) if str(t.get("movieId")) == str(pelicula_id)]
    thread_ids = set(str(t.get("id") or t.get("_id")) for t in movie_threads if t.get("id") or t.get("_id"))
    movie_posts = [p for p in (posts or []) if str(p.get("threadId")) in thread_ids]
    movie_messages = [m for m in (mensajes or []) if str(m.get("threadId")) in thread_ids]

    # Views reales de MS1: se basa en historial agregado (sin inventar)
    total_vistas = 0
    usuarios_muesticados = 200
    for uid in range(1, usuarios_muesticados + 1):
        h = await obtener_historial_ms1(uid)
        if not h:
            continue
        vistas = h.get("peliculas_vistas", [])
        for v in vistas:
            if int(v.get("pelicula_id", -1)) == pelicula_id:
                total_vistas += 1

    votes_total = sum(int(t.get("votes", 0) or 0) for t in movie_threads) + sum(int(p.get("votes", 0) or 0) for p in movie_posts)
    return {
        "movie_id": pelicula_id,
        "title": normalizar_titulo_pelicula(pelicula),
        "threads": len(movie_threads),
        "posts": len(movie_posts),
        "messages": len(movie_messages),
        "votes": votes_total,
        "views_sampled": total_vistas
    }

@app.get("/api/v1/dashboard/home", tags=["Dashboard"])
async def dashboard_home(request: Request, user_id: int = 1):
    """Home agregada con data real de MS1/MS2/MS3"""
    peliculas = await obtener_peliculas_ms2(limit=30)
    talked = await trending_talk(limit=8)
    historial = await obtener_historial_ms1(user_id)
    threads = await obtener_threads_ms3(user_id)

    auth_header = request.headers.get("authorization", "")
    user_data = None
    if auth_header.startswith("Basic "):
        import base64
        try:
            credenciales = base64.b64decode(auth_header[6:]).decode("utf-8")
            email, password = credenciales.split(":", 1)
            user_data = await me_ms1(email, password)
        except Exception:
            user_data = None

    return {
        "user": user_data,
        "hero_movie": peliculas[0] if peliculas else None,
        "movies": peliculas,
        "trending_talk": talked.get("data", []),
        "history_total": len(historial.get("peliculas_vistas", [])) if historial else 0,
        "forum_threads_total": len(threads) if isinstance(threads, list) else 0
    }

@app.post("/api/v1/users/{usuario_id}/vista/{pelicula_id}", tags=["Usuarios"])
async def marcar_vista(usuario_id: int, pelicula_id: int):
    """Marca una película como vista — llama a MS1"""
    # verificar que la película existe en MS2
    pelicula = await obtener_pelicula_ms2(pelicula_id)
    if not pelicula:
        raise HTTPException(status_code=404, detail="Película no encontrada en MS2")
    
    ok = await marcar_vista_ms1(usuario_id, pelicula_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Error al marcar vista o ya estaba marcada")
    return {"mensaje": "Película marcada como vista"}

@app.delete("/api/v1/users/{usuario_id}/vista/{pelicula_id}", tags=["Usuarios"])
async def quitar_vista(usuario_id: int, pelicula_id: int):
    """Quita una película de vistas — llama a MS1"""
    ok = await quitar_vista_ms1(usuario_id, pelicula_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Error al quitar vista")
    return {"mensaje": "Película quitada de vistas"}

# ─── PROXY GENÉRICO PARA MICROSERVICIOS ─────────────────────────────────────
# Este endpoint debe ir AL FINAL porque es un catch-all /{path:path}

from fastapi.responses import JSONResponse

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_microservices(request: Request, path: str):
    """
    Proxy genérico que redirige llamadas a los microservicios:
    - /api/v1/usuarios/* → MS1
    - /api/v1/interno/* → MS1
    - /api/v1/auth/* → MS1 
    - /api/v1/movies/* → MS2
    - /api/v1/threads, /api/v1/posts, /api/v1/messages → MS3
    """
    
    # Remover /api/v1 del principio si existe
    if path.startswith("api/v1/"):
        path = path[7:]  # Remover "api/v1/"
    
    # Determinar a qué microservicio ir
    if path.startswith(("usuarios", "auth", "interno")):
        target_url = f"{MS1_URL}/{path}"
    elif path.startswith("movies"):
        target_url = f"{MS2_URL}/api/{path}"
    elif path.startswith(("api/threads", "api/posts", "api/messages")):
        target_url = f"{MS3_URL}/{path}"
    else:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    
    try:
        async with httpx.AsyncClient() as client:
            # Pasar headers (incluyendo Authorization)
            headers = dict(request.headers)
            headers.pop("host", None)
            
            # Pasar el body si existe
            body = await request.body() if request.method != "GET" else None
            
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                timeout=TIMEOUT
            )
            
            # Retornar respuesta del microservicio
            return JSONResponse(
                status_code=response.status_code,
                content=response.json() if response.text else {}
            )
    except Exception as e:
        logger.error(f"Error en proxy: {str(e)}")
        raise HTTPException(status_code=502, detail="Error al conectar con microservicio")
