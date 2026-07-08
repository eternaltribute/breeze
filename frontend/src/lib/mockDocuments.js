// frontend/src/lib/mockDocuments.js
//
// TEMPORARY stand-in for GET /documents (S3-001) until Ronald builds the
// real endpoint. Shape matches docs/S3-001-documents-endpoint-handoff.md,
// PLUS a `status` field for archive/restore (S3-008 / S3-BR-009) that we're
// proposing in the meeting with Ronald + Sergio — NOT confirmed yet.
//
// Delete this file once the real endpoint exists and swap the fetch call
// in Library.jsx over to it.

export const MOCK_DOCUMENTS = [
  {
    id: "mock-1",
    type: "resume",
    title: "Software Engineer Resume v2",
    file_name: "resume_v2.pdf",
    file_url: null,
    job_id: null,
    status: "active", // proposed field — active | archived
    tags: ["frontend", "software"],
    version_label: "v2",
    version_number: 2,
    owner_id: "mock-user",
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-07-01T14:30:00Z",
  },
  {
    id: "mock-2",
    type: "cover_letter",
    title: "Cover Letter — Acme Corp",
    file_name: "cover_letter_Acme_Corp.pdf",
    file_url: null,
    job_id: "job-abc",
    status: "active",
    tags: ["frontend", "acme"],
    version_label: "v1",
    version_number: 1,
    owner_id: "mock-user",
    created_at: "2026-06-15T09:00:00Z",
    updated_at: "2026-06-15T09:00:00Z",
  },
  {
    id: "mock-3",
    type: "resume",
    title: "Old Resume Draft",
    file_name: "resume_draft_old.pdf",
    file_url: null,
    job_id: null,
    status: "archived",
    tags: ["draft"],
    version_label: "v1",
    version_number: 1,
    owner_id: "mock-user",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-10T10:00:00Z",
  },
];
