from sqlalchemy import Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base
from datetime import datetime
import enum

class Rol(enum.Enum):
    admin = "admin"
    usuario = "usuario"

class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    pais: Mapped[str] = mapped_column(String(50))
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    rol: Mapped[Rol] = mapped_column(Enum(Rol), default=Rol.usuario)

    peliculas_vistas: Mapped[list["PeliculaVista"]] = relationship("PeliculaVista", back_populates="usuario", cascade="all, delete")

class PeliculaVista(Base):
    __tablename__ = "peliculas_vistas"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    pelicula_id: Mapped[int] = mapped_column()
    fecha_vista: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="peliculas_vistas")

class Pelicula(Base):
    __tablename__ = "peliculas"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    titulo: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str] = mapped_column(String(500))
    año: Mapped[int] = mapped_column()
    genero: Mapped[str] = mapped_column(String(100))