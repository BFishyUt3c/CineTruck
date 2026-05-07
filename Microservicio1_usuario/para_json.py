from pydantic import BaseModel
from enum import Enum
from typing import Optional

class Rol(str, Enum):
    admin = "admin"
    usuario = "usuario"

class UsuarioCreate(BaseModel):
    nombre: str
    email: str
    password: str
    pais: str

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    pais: Optional[str] = None
    password: Optional[str] = None

class PeliculaCreate(BaseModel):
    titulo: str
    descripcion: str
    año: int
    genero: str