# S3-019 Performance and Accessibility Pass

## Outcome

Team Breeze executes and documents fixes for major performance/accessibility issues before release/demo.

## Business Rules

- S3-BR-019: Centralized error handling/logging must exist for server-side failures.
- S3-BR-020: Demo-critical flows must be covered by smoke-test verification before release/demo.

## S3-BR-019 Status

Centralized backend error handling/logging already exists and is wired in:

- `backend/main.py`
  - Calls `configure_logging()`
  - Adds `RequestContextMiddleware`
  - Registers `http_exception_handler`
  - Registers `unhandled_exception_handler`
- `backend/app/middleware.py`
  - Adds a per-request `request_id`
  - Logs method, path, status, duration, and user when available
  - Returns `X-Request-ID` on responses
- `backend/app/exception_handlers.py`
  - Logs handled HTTP errors with request context
  - Logs unexpected server errors with stack traces
  - Returns a safe generic error message for unhandled failures
- `backend/app/database.py`
  - Rolls back and logs failed DB sessions

## Automated Verification Before Demo

Run these from the matching folders before demo.

### Frontend

```powershell
cd "..\breeze\frontend"
npm run test:run
npm run lint
npm run build
```

Expected result:

- Tests pass
- ESLint passes
- Production build succeeds
- Existing Vite large chunk warning is acceptable unless it blocks load time

### Backend

```powershell
cd "..\breeze\backend"
.\venv\Scripts\python -m pytest
.\venv\Scripts\python -m ruff check .
.\venv\Scripts\python -m black --check .
```

Expected result:

- Pytest passes
- Ruff passes
- Black check passes

## Manual Smoke-Test Checklist

Use a clean browser session where possible.

### Authentication

- User can sign in.
- User can reach Dashboard after sign-in.
- Protected pages do not show broken content while auth is loading.

### Dashboard and Job Detail

- Dashboard loads active job cards.
- Search/filter controls do not crash the page.
- Opening a job card goes to Job Detail.
- Job Detail can save edited job fields and shows a success message.
- Stage dropdown updates the stage.
- Interview stage shows the interview progress panel.
- Interview round requires notes before advancing.
- Activity timeline updates after stage/round changes.

### Company Research

- Company Research accepts user context.
- Triggering the research action shows a loading state.
- If backend AI is unavailable, the page shows a clear error/fallback message.

### Resume and Cover Letter

- Resume Helper accepts supported uploads where available.
- Cover Letter Helper allows draft upload or job-based draft generation flow.
- Saving a resume/cover letter attached to a job shows the saved document section in Job Detail.
- Dashboard job cards show resume/letter indicators when documents exist.

### Library

- Library loads without crashing.
- Filter by status, type, tag, and updated date works.
- Export dropdown shows PDF, DOCX, and TXT.
- Rename opens a modal and updates the document name.
- Duplicate creates a visible copy.
- Archive/restore moves documents between active/archived states.

### Settings/Profile

- Settings loads.
- Profile page loads.
- Profile photo upload/delete flow does not crash.
- Sidebar profile image updates or falls back to Clerk initials/image.

## Accessibility Pass

Check demo-critical pages:

- Keyboard can tab through buttons, links, inputs, dropdowns, and modals.
- Buttons have visible text or an `aria-label`.
- Inputs/selects have labels or `aria-label`.
- Error/success messages are visible near the action that caused them.
- Modal actions can be completed using keyboard navigation.
- Text has readable contrast on light backgrounds.
- No important text overlaps or gets cut off at common laptop widths.

## Performance Pass

Check demo-critical pages:

- Dashboard loads without obvious delay.
- Job Detail loads without layout jumps that hide controls.
- Library cards stay readable and controls do not wrap awkwardly.
- Production build completes.
- Watch the browser console for repeated errors or failed API loops.

## Latest S3-019 Verification - July 13, 2026

### Fixes Completed

- Removed a temporary Resume Helper debug `console.log` for auth-token readiness so demo/devtools output stays cleaner.
- Fixed the backend `/health/db` failure log typo from `falied` to `failed`.
- Tightened job-linked resume and cover-letter lookup ownership checks:
  - Owned job with no linked document returns `200` with `null`, avoiding noisy empty-state 404s.
  - Another user's job still returns `404`, preserving ownership/security behavior.
- Kept existing centralized backend error handling/logging in place through `RequestContextMiddleware`, `http_exception_handler`, and `unhandled_exception_handler`.

### Automated Verification Results

Frontend commands run from `frontend`:

- `npm run test:run` - passed: 9 test files, 115 tests.
- `npm run lint` - passed.
- `npm run build` - passed.

Backend commands run from `backend`:

- `.\venv\Scripts\python.exe -m pytest` - passed: 160 tests.
- `.\venv\Scripts\python.exe -m ruff check .` - passed.
- `.\venv\Scripts\python.exe -m black --check .` - passed.

### Known Non-Blocking Warnings

- Frontend build still reports the existing Vite large chunk warning for the main bundle. This does not block the demo, but future code-splitting would improve production loading.
- Backend tests still report existing deprecation/dependency warnings, mostly `datetime.utcnow()`, FastAPI `on_event`, and the installed `fpdf` package warning. These do not block the S3-019 pass.

### Manual Smoke-Test Status

- Automated smoke coverage is complete for the current repo state.
- Manual browser smoke testing should still be performed immediately before the demo using the checklist above, especially Dashboard, Job Detail, Library, Resume Helper, Cover Letter Helper, Settings, and Profile.

## Release Note

For S3-019, attach the latest command output summary to the ticket:

- Frontend test/lint/build result
- Backend pytest/ruff/black result
- Manual smoke-test date
- Any known issues or backend endpoints still pending
