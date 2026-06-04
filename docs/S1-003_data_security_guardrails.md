# Data and Security Guardrails — ATS Rocket (Sprint 1)

> **S1-003** | Owner: Sergio
> Rules: S1-BR-001, S1-BR-006, S1-BR-008

## 1. Authentication and Route Protection

Every application route except login, registration, and password reset is a **protected route**.

Authentication is handled by **Clerk**. The Clerk JWT is verified on every protected request via a FastAPI dependency. Frontend route guards are supplementary and are not a substitute for backend enforcement.

- Unauthenticated requests to protected API endpoints must return `401 Unauthorized`
- Unauthenticated users accessing protected frontend routes must be redirected to the Clerk login page
- On logout, the Clerk session must be invalidated via the Clerk SDK
- After logout, any previously issued Clerk token must be rejected on subsequent requests
- Frontend state (e.g., cached user data) must be cleared on logout

Protected routes reference

| Area | Protected? | Notes |
|---|---|---|
| Dashboard | Yes | Requires active Clerk session |
| Job create / edit | Yes | Must verify ownership on edit |
| Profile | Yes | Owner-only read and write |
| Settings | Yes | Owner-only |
| Login | No | Public (Clerk-hosted or embedded) |
| Register | No | Public (Clerk-handled) |
| Password reset | No | Public (Clerk-handled) |

## 2. Per-User Data Ownership

Every record that belongs to a user (jobs, profile data, settings) must be stored with the Clerk `user_id` as the owner identifier (e.g., `owner_id` column). Queries must always filter by the authenticated user's `user_id`. Returning all records without an ownership filter is prohibited.

A user must never be able to read, update, or delete a record owned by another user. This applies to all HTTP methods: GET, POST PUT, PATCH, DELETE.

If a user requests a resource that exists but belongs to another user, return `404 Resource Not Found`(Instead of `403 unauthorized` as to not reveal that the data belongs to another user)

## 3. Ownership Enforcement (Server-Side Only)

Authorization checks in the frontend (hiding buttons, disabling links) are **UI affordances only** and do not satisfy ownership enforcement. The backend must verify ownership on every mutating request.

Passing a `user_id` from the client request body or query params to determine ownership is **prohibited**. Ownership must be derived from the verified Clerk JWT.

Clerk JWT verification — FastAPI dependency
```python
from clerk_backend_api import Clerk
from fastapi import Depends, HTTPException, Header

async def get_current_user(authorization: str = Header(...)) -> str:
    token = authorization.removeprefix("Bearer ")
    try:
        claims = Clerk.verify_token(token)
        return claims["sub"]  # Clerk user_id
        except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

Ownership — correct pattern
```python
# CORRECT: owner_id derived from verified Clerk JWT
@router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.owner_id == current_user_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
```

```python
# PROHIBITED: owner_id derived from client-supplied input
@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user_id: str, db: Session = Depends(get_db)):  # never trust client for ownership
    job = db.query(Job).filter(Job.id == job_id).first()
    if job.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job
```

Query pattern
```python
# CORRECT: ownership filter always applied
def get_jobs_for_user(owner_id: str, db: Session):
    return db.query(Job).filter(Job.owner_id == owner_id).all()

# PROHIBITED: no ownership filter
def get_all_jobs(db: Session):
    return db.query(Job).all()  # never acceptable for user-scoped data
```

Frontend route guard (supplementary only)
```javascript
// Acceptable as a UX improvement, NOT as a security control
const { isSignedIn } = useAuth(); // Clerk hook
if (!isSignedIn) {
  router.push("/login");
}
```

## 4. Prohibited Patterns (Quick Reference)

| Pattern | Why Prohibited |
|---|---|
| Trust `user_id` from request body/params for ownership | Client-supplied; easily spoofed |
| No ownership filter on DB queries for user data | Leaks all users' data |
| Frontend-only route guard with no backend check | Bypassable without UI |
| Return `200` with another user's data | Direct cross-user data leak |
| Allow Clerk session to remain valid after logout | Enables session hijacking |
| Duplicate email accounts on registration | Violates S1-BR-003 (Clerk enforces this by default) |

## 5. Testing Requirements

All authentication and authorization stories must include:

- **Negative-path tests** proving unauthorized access is denied
- **Cross-user access tests** proving user A cannot access user B's records
- **Post-logout tests** proving invalidated Clerk sessions are rejected

## Revision History

| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | 2025-06-03 | Sergio | Initial draft |