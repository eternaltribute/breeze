# Environment Management Strategy — Breeze (Sprint 1)

**S1-009** | Owner: Ronald  
Rules: S1-BR-001, S1-BR-006

---

## Overview
This document defines how environment variables are managed across local, dev, and prod environments without committing secrets to version control.

## Rules
- Never commit `.env` files — they are covered by `.gitignore`
- Always keep `.env.example` files up to date when adding new variables
- Each developer copies `.env.example` to `.env` and fills in their own values

## Local Setup
1. Copy `backend/.env.example` to `backend/.env`
2. Copy `frontend/.env.example` to `frontend/.env`
3. Fill in your local values

## Environment Variable Reference

### Backend (`backend/.env`)
| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/breeze_db` |
| `SECRET_KEY` | JWT signing secret | `your-secret-key` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `30` |
| `ENVIRONMENT` | Runtime environment | `local` / `dev` / `prod` |

### Frontend (`frontend/.env`)
| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

## Per-Environment Behavior
- **local** — `.env` file, points to local database
- **dev** — secrets injected via GitHub Actions secrets
- **prod** — secrets injected via hosting platform (never stored in repo)