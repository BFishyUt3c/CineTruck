from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import Usuario, Rol
import hashlib

security = HTTPBasic()

def hash_password(password: str) -> str:
    # Usar bcrypt en producción es mejor, por ahora se usa sha256
    # TODO: Implementar bcrypt para mayor seguridad
    return hashlib.sha256(password.encode()).hexdigest()

def get_usuario_actual(credentials: HTTPBasicCredentials = Depends(security), db: Session = Depends(get_db)):
    """
    Autentica usuario con Basic Auth (email:password)
    Valida que usuario exista y contraseña sea correcta
    """
    # Buscar usuario por email
    usuario = db.query(Usuario).filter(Usuario.email == credentials.username).first()
    
    # Validar existencia de usuario
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    # Validar contraseña hasheada
    password_hash = hash_password(credentials.password)
    if usuario.password != password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    return usuario

def solo_admin(usuario: Usuario = Depends(get_usuario_actual)):
    """
    Valida que el usuario sea admin
    Se usa como dependencia en rutas que requieren permisos admin
    """
    if usuario.rol.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requieren permisos de administrador"
        )
    return usuario