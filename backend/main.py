from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, text

from app.database import get_db, init_db
from app.routers import (
    ai,
    auth,
    cover_letter,
    education,
    events,
    experiences,
    jobs,
    preferences,
    protected,
    resume,
    skills,
)

load_dotenv()

app = FastAPI(title="Breeze API")

# CORS - allows frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routers
app.include_router(auth.router)  # registers auth router with FastAPI
app.include_router(protected.router)  # registers protected router with FastAPI S1-014
app.include_router(jobs.router)  # registers jobs router with FastAPI S1-015
app.include_router(skills.router)  # registers skills router with FastAPI
app.include_router(events.router)  # registers events router with FastAPI S2-009
app.include_router(ai.router)  # registers AI router with FastAPI S2-021
app.include_router(experiences.router)
app.include_router(education.router)
app.include_router(preferences.router)
app.include_router(resume.router)
app.include_router(cover_letter.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"message": "Breeze API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def db_health(db: Session = Depends(get_db)):
    try:
        db.exec(text("SELECT 1"))
        return {"database": "connected"}
    except Exception as e:
        return {"database": "error", "detail": str(e)}
