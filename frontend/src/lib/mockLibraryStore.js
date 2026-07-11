// frontend/src/lib/mockLibraryStore.js
//
// TEMPORARY in-memory "library" shared by BOTH the Library page (S3-001)
// and the AI helper pages (Resume Helper / Cover Letter Helper), so that
// saving a document in mock mode actually shows up in the Library list —
// without needing Ronald's real save + list endpoints wired up yet.
//
// WHY THIS FILE EXISTS:
//   Library.jsx reads documents from mock data (USE_MOCK_DATA = true).
//   ResumeHelper.jsx / CoverLetterHelper.jsx used to save documents by
//   calling a REAL backend endpoint that isn't built yet. Those two were
//   on separate "shelves" that never talked to each other — a document
//   saved from a Helper page never showed up in the mock Library.
//   This module is the ONE shared shelf both places read/write to, so the
//   whole app behaves like a connected product during development and demos.
//
// TODO (Ronald): once GET /documents, POST /documents/resume/save, and
// POST /documents/cover-letter/save are all live and return data in this
// same shape, delete this file. Library.jsx, ResumeHelper.jsx, and
// CoverLetterHelper.jsx should each flip their local USE_MOCK_* flag to
// false and call the real endpoints instead — see the TODO comments left
// in each of those files next to their flag.
//
// Business rules this file helps satisfy:
//   S3-BR-007 — new versions/documents are only created by an explicit
//     user action. addMockDocument() below is only ever called from a
//     Save button's onClick handler, never automatically.
//   S3-BR-008 — every stored document/version carries a version label,
//     a timestamp, and an owner id.
//
// IMPORTANT — SECURITY NOTE:
//   The duplicate-title check below is a client-side UX nicety only.
//   It is NOT a substitute for a real uniqueness rule enforced by the
//   backend/database (Ronald + Sergio). A client-side check can always
//   be bypassed by someone calling the API directly, so the real
//   enforcement has to live on the server before this ships for real.

import { MOCK_DOCUMENTS } from "./mockDocuments";

// Module-level array acting as our in-memory "table."
// NOTE: this resets on every page refresh — that's expected for a
// temporary mock store, not a bug.
let documents = MOCK_DOCUMENTS.map((doc) => ({ ...doc }));

const MOCK_OWNER_ID = "mock-user";

/**
 * Returns every document currently on the shared shelf.
 * Returns a *copy* so callers can't accidentally mutate our internal array
 * from the outside (a common source of confusing bugs).
 */
export function getMockLibraryDocuments() {
  return documents.map((doc) => ({ ...doc }));
}

/**
 * Checks whether a document with this exact title already exists for this
 * document type. Case-insensitive and trims whitespace, so "  My Resume "
 * and "my resume" count as the same title.
 *
 * A resume and a cover letter are allowed to share a title (e.g. both
 * named "Acme Corp") — only two documents of the SAME type collide.
 *
 * @param {string} title
 * @param {"resume"|"cover_letter"} type
 * @returns {boolean} true if this would be a duplicate
 */
export function isDuplicateTitle(title, type) {
  const normalizedTitle = (title ?? "").trim().toLowerCase();
  if (!normalizedTitle) return false;

  return documents.some(
    (doc) => doc.type === type && (doc.title ?? "").trim().toLowerCase() === normalizedTitle
  );
}

/**
 * Adds a brand-new document (with its first version) to the shared shelf.
 * This IS the "explicit version-creation action" S3-BR-007 requires —
 * it should only ever be wired to a Save button's onClick, never fired
 * automatically or in the background.
 *
 * @param {object} params
 * @param {"resume"|"cover_letter"} params.type
 * @param {string} params.title
 * @param {string} params.documentText - the saved text content of this version
 * @param {string|null} [params.jobId]
 * @param {string} [params.tags] - comma-separated tag string, matches the
 *   free-text tag inputs already used on the Helper pages
 * @returns {object} the newly created document record
 */
export function addMockDocument({ type, title, documentText, jobId = null, tags = "" }) {
  const now = new Date().toISOString();
  const id = `mock-${type}-${Date.now()}`;

  const newDocument = {
    id,
    type,
    title: (title ?? "").trim() || (type === "resume" ? "Resume" : "Cover Letter"),
    file_name: null,
    file_url: null,
    job_id: jobId,
    status: "active",
    tags: (tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    version_label: "v1",
    version_number: 1,
    owner_id: MOCK_OWNER_ID,
    created_at: now,
    updated_at: now,
    versions: [
      {
        version_id: `${id}-v1`,
        version_number: 1,
        version_label: "v1",
        document_text: documentText ?? "",
        file_url: null,
        owner_id: MOCK_OWNER_ID,
        created_at: now,
      },
    ],
  };

  // New document goes at the front so it shows up first under
  // "Updated Date (newest first)" sorting without needing a re-sort here.
  documents = [newDocument, ...documents];
  return newDocument;
}
