# Environment Setup — Breeze

## Deployed URLs
| Service  | Platform | URL
| Backend  | Render   | `https://breeze-bjfb.onrender.com`          |
| Frontend | Vercel   | `https://breeze-murex.vercel.app`           |

---

## Backend Environment Variables (Render)
| Variable                  | Description                                                         |
| `DATABASE_URL`            | PostgreSQL connection string from Supabase (Settings → Database)   |
| `SUPABASE_URL`            | Supabase project URL (Settings → API → Project URL)                |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (Settings → API → service_role)        |
| `CLERK_SECRET_KEY`        | Clerk secret key (Clerk Dashboard → API Keys)                      |
| `CLERK_ISSUER_URL`        | Clerk issuer URL, e.g. `https://<your-clerk-domain>.clerk.accounts.dev` |
| `ANTHROPIC_API_KEY`       | Anthropic API key (console.anthropic.com → API Keys)               |

> **Never commit these values to the repository.**
## Frontend Environment Variables (Vercel)
| Variable                    | Description                                                    |
| `VITE_API_BASE_URL`         | `https://breeze-bjfb.onrender.com`                             |
| `VITE_CLERK_PUBLISHABLE_KEY`| Clerk publishable key (Clerk Dashboard → API Keys, starts with `pk_`) |
## Local Development

1. Copy the example env file:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Fill in all values from the tables above.
3. Frontend reads from `frontend/.env.local` — create it with:
   ```
   VITE_API_BASE_URL=http://localhost:8000
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

## Health Check

```
GET /health
→ 200 {"status": "ok", "service": "breeze-api"}
```

Configured in Render under **Settings → Health & Alerts → Health Check Path: `/health`**.
