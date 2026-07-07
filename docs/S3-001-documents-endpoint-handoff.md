# S3-001 — GET /documents Endpoint Handoff (for Ronald)

**From:** Brittney (frontend)
**Story:** S3-001 — Implement Document Library List View
**Rules:** S3-BR-001 (resume/cover letter only), S3-BR-002 (ownership isolation)

## What the frontend needs

The Library page needs one endpoint that returns **all of a user's documents**
— resumes and cover letters together, merged into a single list — so the
page doesn't have to make two separate calls and stitch them together
itself.

## ⚠️ Flag before you build this: `cover_letters.job_id` is required

Looking at `models.py`, `CoverLetter.job_id` is a **required** foreign key —
there's currently no way for a cover letter to exist without being attached
to a job. But the Library page is supposed to show documents independent of
any job context (per the UX doc — "global place to review and manage
artifacts").

For this endpoint, I'm assuming we're **not** changing that constraint yet
(that's a bigger schema conversation involving Sergio). This endpoint will
just return cover letters as-is, each with whatever `job_id` they already
have. If a user has zero cover letters uploaded outside of a job flow,
that's expected for now — just flagging so it's not a surprise later, and so
we don't quietly ship a Library page that implies something the schema
doesn't actually support yet.

## Proposed endpoint

```
GET /documents
Auth: required (get_current_user)
```

### Behavior
- Query the `resumes` table for `user_id == current_user.id`
- Query the `cover_letters` table for `user_id == current_user.id`
- Merge both into one list, each item tagged with a `"type"` field so the
  frontend can tell them apart
- Sort by `updated_at` descending (most recently touched first)
- Return `200` with the list, or an empty list `[]` if the user has no
  documents yet (not a 404 — empty is a valid state)

### Proposed response shape

```json
[
  {
    "id": "uuid-string",
    "type": "resume",
    "title": "file_name if present, otherwise something like 'Untitled Resume'",
    "file_name": "resume_v2.pdf",
    "file_url": "https://...",
    "job_id": null,
    "created_at": "2026-07-01T12:00:00Z",
    "updated_at": "2026-07-05T09:30:00Z"
  },
  {
    "id": "uuid-string",
    "type": "cover_letter",
    "title": "file_name if present, otherwise something like 'Untitled Cover Letter'",
    "file_name": null,
    "file_url": null,
    "job_id": "job-uuid-here",
    "created_at": "2026-07-02T08:00:00Z",
    "updated_at": "2026-07-02T08:00:00Z"
  }
]
```

### Field notes
- `type` — literal `"resume"` or `"cover_letter"` (S3-BR-001: these are the
  only two valid values, on both ends)
- `title` — neither table has a `title` field right now, only `file_name`.
  Ok if the backend just falls back to `file_name`, or a generic default
  like `"Untitled Resume"` if `file_name` is also null (e.g. text-only
  cover letters with no uploaded file). Whatever's easiest on your end —
  frontend will display whatever string comes back.
- `job_id` — will always be present (non-null) for cover letters, and may
  be null for resumes. Frontend will handle both.
- Error case: if `current_user` isn't authenticated, standard `401` per
  the coding standards doc (`{"detail": "..."}` shape).

## What frontend will do with this

- Show a loading state while the request is in flight
- Show an empty state ("No documents yet") if the list comes back empty
- Show a clear error state if the request fails
- Render each item with its `type` so resumes and cover letters are
  visually distinguishable

## Open question for you

Does merging two tables in-endpoint like this work for you, or would you
rather we talk about the real `Document`/`DocumentVersion` schema change
now instead of later? Happy to hop on a call either way — just didn't want
to assume which one is less work on your end.
