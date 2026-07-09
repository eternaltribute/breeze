from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, text
from starlette.exceptions import HTTPException as StarletteHTTPException  # S3-018

from app.database import get_db, init_db
from app.exception_handlers import (
    http_exception_handler,
    unhandled_exception_handler,
)  # S3-018
from app.logging_config import configure_logging, logger  # S3-018
from app.middleware import RequestContextMiddleware  # S3-018
from app.routers import (
    ai,
    auth,
    documents,
    education,
    events,
    experiences,
    jobs,
    preferences,
    protected,
    skills,
)

load_dotenv()

configure_logging()  # S3-018

app = FastAPI(title="Breeze API")
app.add_middleware(RequestContextMiddleware)
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
app.include_router(documents.router)
# S3-018: centralized exception handling
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("Breeze API startup complete")  # S3-018


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
        logger.error("DB health check falied: %s", e, exc_info=True)  # S3-018
        return {"database": "error", "detail": str(e)}
