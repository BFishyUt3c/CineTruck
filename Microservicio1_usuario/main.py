from fastapi import FastAPI
from database import engine, Base, SessionLocal
from fastapi.middleware.cors import CORSMiddleware
from routes import router
import time

#correr tdo
#docker-compose up -d

#pararlo
#docker-compose down
#pararlo y borrar base d datos
#docker-compose down -v

#swagger: http://localhost:8000/docs
def create_tables():
    for i in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            print("Tablas creadas", flush=True)
            return
        except Exception as e:
            print(f"Esperando a PostgreSQL... intento {i+1}", flush=True)
            time.sleep(3)

def generar_fake_data_si_vacio():
    """Genera fake data si la BD está vacía"""
    try:
        from models import Usuario
        db = SessionLocal()
        count = db.query(Usuario).count()
        db.close()
        
        if count == 0:
            print("BD vacía, generando fake data...", flush=True)
            from fake_data import crear_fake_data
            crear_fake_data()
            print("Fake data generada", flush=True)
        else:
            print(f"BD con {count} usuarios, fake data no necesaria", flush=True)
    except Exception as e:
        print(f"Error generando fake data: {e}", flush=True)

create_tables()
generar_fake_data_si_vacio()

app = FastAPI(title="MS1 - Usuarios")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)