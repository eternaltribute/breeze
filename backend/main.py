from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, jobs, protected

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
app.include_router(auth.router)  # registers auth router with FastAPI .
app.include_router(protected.router)  # registers protected router with FastAPI S1-014
app.include_router(jobs.router)  # registers jobs router with FastAPI S1-015


@app.get("/")
def root():
    return {"message": "Breeze API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
