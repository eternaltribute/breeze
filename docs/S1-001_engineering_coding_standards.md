# Engineering Coding Standards — ATS Rocket (Sprint 1)

> **S1-001** | Owner: Ronald 
> Rules: S1-BR-001, S1-BR-006, S1-BR-008

---

## 1. Naming Conventions

### Python / FastAPI (Backend)
#### (snake case replaces spaces with underscores)
- Variables and functions: `snake_case` — e.g., `get_user_profile`, `job_status`
- Classes: `PascalCase` — e.g., `UserProfile`, `JobRecord`
- Constants: `UPPER_SNAKE_CASE` — e.g., `MAX_RETRIES`, `JWT_SECRET`
- Files and modules: `snake_case` — e.g., `auth_router.py`, `job_service.py`

### JavaScript / React (Frontend)
- Variables and functions: `camelCase` — e.g., `getUserProfile`, `jobStatus`
- Components: `PascalCase` — e.g., `JobCard`, `ProfileForm`
- Component files: `PascalCase.jsx` — e.g., `JobCard.jsx`
- Utility files: `camelCase.js` — e.g., `apiClient.js`
- CSS class names: use Tailwind utility classes directly; avoid custom class names unless necessary

---

## 2. Folder Structure

### Frontend
```
/frontend
  /src
    /components    ← reusable UI components (e.g., JobCard, ProfileForm)
    /pages         ← route-level page components (e.g., Dashboard, Profile)
    /hooks         ← custom React hooks (e.g., useAuth, useJobs)
    /lib           ← utility functions and API call wrappers
    /types         ← shared TypeScript types (if used)
```

### Backend
```
/backend
  /app
    /routers       ← FastAPI route handlers (auth, profile, jobs, documents)
    /models        ← SQLModel table definitions
    /schemas       ← Pydantic request/response schemas
    /services      ← business logic, kept separate from route handlers
    /core          ← config, database connection, Clerk integration
  main.py
```

---

## 3. Linting and Formatting

### Backend
- Formatter: **Black** (line length 88)
- Linter: **Ruff** (preferred for speed) or **Flake8**
- Run before every commit:
  ```bash
  black .
  ruff check .
  ```

### Frontend
- Formatter: **Prettier**
- Linter: **ESLint** with React rules
- Config files must be committed to the repo (`.prettierrc`, `.eslintrc`)
- Run before every commit:
  ```bash
  npm run lint
  npm run format
  ```

> CI will block merges on any lint or format failures.

---

## 4. Error Handling Style

### Backend (FastAPI)
- Always use `HTTPException` for API errors with the appropriate HTTP status code
- Never return raw Python exceptions to the client
- Log errors server-side before raising; do not expose internal details in the `detail` field

```python
from fastapi import HTTPException

if not user:
    raise HTTPException(status_code=404, detail="User not found")
```

### Frontend (React)
- Wrap all API calls in `try/catch`
- Display user-facing error messages via a toast or inline error component — never silently fail
- Failed API calls must set an error state that the UI can respond to

```js
try {
  const data = await fetchUserProfile();
  setProfile(data);
} catch (err) {
  setError("Failed to load profile. Please try again.");
}
```

---

## 5. API Response Conventions

- All responses return **JSON**
- Use the appropriate HTTP status code:
  - `200` — successful GET or PUT
  - `201` — successful POST (resource created)
  - `204` — successful DELETE (no content)
  - `400` — bad request / validation error
  - `401` — unauthenticated
  - `403` — unauthorized
  - `404` — resource not found

### Error response shape
```json
{
  "detail": "Human-readable error message"
}
```

### Success responses
Return the resource directly — no extra `{ data: ... }` wrapper unless the team agrees to change this.

### Endpoint reference (Sprint 1)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Log in user |
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update user profile |
| GET | `/jobs` | List user's jobs |
| POST | `/jobs` | Create a new job |
| GET | `/jobs/{id}` | Get a specific job |
| PUT | `/jobs/{id}` | Update a specific job |
| DELETE | `/jobs/{id}` | Delete a specific job |
| POST | `/documents/resume` | Upload resume |
| POST | `/documents/cover-letter` | Upload cover letter |

---

## Revision History
| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2025-06-03 | Ronal | Initial draft |
