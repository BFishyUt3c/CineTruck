from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Usuario, PeliculaVista, Pelicula, Rol
from para_json import UsuarioCreate, UsuarioUpdate, PeliculaCreate
from auth import get_usuario_actual, solo_admin, hash_password

router = APIRouter()

@router.get("/")
def root():
    return {"mensaje": "MS1 - Usuarios API funcionando"}

@router.post("/auth/registro")
def registro(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    existe = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    nuevo = Usuario(
        nombre=usuario.nombre,
        email=usuario.email,
        password=hash_password(usuario.password),
        pais=usuario.pais
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.get("/auth/login")
def login(usuario: Usuario = Depends(get_usuario_actual)):
    return {"mensaje": f"ola {usuario.nombre}"}



#pal normal
@router.get("/auth/me")
def me(usuario_actual: Usuario = Depends(get_usuario_actual)):
    return usuario_actual


@router.get("/usuarios/{id}")
def get_usuario(id: int, usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no esta")
    return usuario

@router.put("/usuarios/{id}")
def actualizar_usuario(id: int, datos: UsuarioUpdate, usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Permisos: solo admin o el dueño
    if usuario_actual.id != id and usuario_actual.rol.value != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    # Actualizar campos
    if datos.nombre is not None:
        usuario.nombre = datos.nombre
    if datos.email is not None:
        email_limpio = datos.email.strip().lower()
        if email_limpio != usuario.email:
            existe = db.query(Usuario).filter(Usuario.email == email_limpio).first()
            if existe:
                raise HTTPException(status_code=400, detail="El correo ya está registrado")
            usuario.email = email_limpio
    if datos.pais is not None:
        usuario.pais = datos.pais
    if datos.password is not None and datos.password != "":
        usuario.password = hash_password(datos.password)
    
    db.commit()
    db.refresh(usuario)
    return usuario

@router.delete("/usuarios/{id}")
def eliminar_usuario(id: int, usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Permisos: solo admin o el dueño
    if usuario_actual.id != id and usuario_actual.rol.value != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos")
    
    db.delete(usuario)
    db.commit()
    return {"mensaje": "Usuario eliminado"}

@router.get("/usuarios/{id}/peliculas_vistas")
def get_peliculas_vistas(id: int, usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    return db.query(PeliculaVista).filter(PeliculaVista.usuario_id == id).all()



#pal admin
@router.get("/usuarios")
def get_todos_usuarios(admin: Usuario = Depends(solo_admin), db: Session = Depends(get_db)):
    return db.query(Usuario).all()

@router.post("/peliculas")
def crear_pelicula(pelicula: PeliculaCreate, admin: Usuario = Depends(solo_admin), db: Session = Depends(get_db)):
    nueva = Pelicula(
        titulo=pelicula.titulo,
        descripcion=pelicula.descripcion,
        año=pelicula.año,
        genero=pelicula.genero
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@router.get("/peliculas")
def get_peliculas(usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    return db.query(Pelicula).all()

@router.get("/peliculas/{id}")
def get_pelicula(id: int, usuario_actual: Usuario = Depends(get_usuario_actual), db: Session = Depends(get_db)):
    pelicula = db.query(Pelicula).filter(Pelicula.id == id).first()
    if not pelicula:
        raise HTTPException(status_code=404, detail="Película no encontrada")
    return pelicula

@router.delete("/peliculas/{id}")
def eliminar_pelicula(id: int, admin: Usuario = Depends(solo_admin), db: Session = Depends(get_db)):
    pelicula = db.query(Pelicula).filter(Pelicula.id == id).first()
    if not pelicula:
        raise HTTPException(status_code=404, detail="Película no encontrada")
    db.delete(pelicula)
    db.commit()
    return {"mensaje": "Película eliminada"}

@router.post("/interno/usuarios/{usuario_id}/vista/{pelicula_id}")
def registrar_vista(usuario_id: int, pelicula_id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    ya_vista = db.query(PeliculaVista).filter(
        PeliculaVista.usuario_id == usuario_id,
        PeliculaVista.pelicula_id == pelicula_id
    ).first()
    if ya_vista:
        raise HTTPException(status_code=400, detail="Película ya marcada como vista")
    
    vista = PeliculaVista(usuario_id=usuario_id, pelicula_id=pelicula_id)
    db.add(vista)
    db.commit()
    return {"mensaje": "Película marcada como vista"}