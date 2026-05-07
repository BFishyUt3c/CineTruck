from faker import Faker
from database import SessionLocal, engine, Base
from models import Usuario, PeliculaVista, Pelicula, Rol
from auth import hash_password
import random

#docker-compose exec api python fake_data.py

Base.metadata.create_all(bind=engine)
fake = Faker('es')

def crear_fake_data():
    db = SessionLocal()

    PELICULA_ID_MIN = 1
    PELICULA_ID_MAX = 20015

    usuarios_ids = []
    for i in range(20000):
        usuario = Usuario(
            nombre=fake.name(),
            email=fake.unique.email(),
            password=hash_password(fake.password()),
            pais=fake.country(),
            rol=Rol.usuario
        )
        db.add(usuario)
        db.flush()
        usuarios_ids.append(usuario.id)
    db.commit()
    print("usuarios creados", flush=True)

    # crear un admin
    admin = Usuario(
        nombre="Admin",
        email="eladminps@gmail.com",
        password=hash_password("elpapuproadmin"),
        pais="Peru",
        rol=Rol.admin
    )
    db.add(admin)
    db.commit()
    print("Admin creado (email: eladminps@gmail.com, password: elpapuproadmin)", flush=True)

    db.close()
    print("tdo creado", flush=True)

if __name__ == "__main__":
    try:
        crear_fake_data()
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()