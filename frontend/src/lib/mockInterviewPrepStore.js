// frontend/src/lib/mockInterviewPrepStore.js
//
// TEMPORARY in-memory store for Interview Prep Notes (S3-013), used while
// Ronald's real GET/PUT /jobs/{job_id}/interview-prep-notes endpoints don't
// exist yet — see docs/S3-013-interview-prep-notes-handoff.md for the real
// contract this mock is standing in for.
//
// Unlike mockLibraryStore.js (one shared shelf for all documents), this one
// is keyed BY JOB, since prep notes belong to a specific job the same way
// company_research_notes does. Each job gets its own set of 3 notes fields.
//
// TODO (Ronald): once the real endpoints exist and return this same shape
// (job_id, interview_prep_questions, interview_prep_talking_points,
// interview_prep_logistics, updated_at), delete this file and flip
// USE_MOCK_INTERVIEW_PREP to false in JobDetail.jsx.
//
// Business rules this satisfies:
//   S3-BR-003 — every save bumps `updatedAt`, matching how the real
//   endpoint is specified to bump job.updated_at on every PUT.

const notesByJobId = new Map();

/**
 * Returns the saved prep notes for a job, or empty defaults if none exist
 * yet. Returns a copy, not a reference to internal state.
 *
 * @param {string} jobId
 */
export function getMockInterviewPrepNotes(jobId) {
  const existing = notesByJobId.get(jobId);
  if (!existing) {
    return {
      jobId,
      interviewPrepQuestions: "",
      interviewPrepTalkingPoints: "",
      interviewPrepLogistics: "",
      updatedAt: null,
    };
  }
  return { ...existing };
}

/**
 * Saves prep notes for a job — this is the explicit "Save" action, never
 * called automatically (matches the explicit-save pattern used across the
 * rest of this app, e.g. S2-BR-018).
 *
 * @param {string} jobId
 * @param {object} fields
 * @param {string} fields.interviewPrepQuestions
 * @param {string} fields.interviewPrepTalkingPoints
 * @param {string} fields.interviewPrepLogistics
 */
export function saveMockInterviewPrepNotes(jobId, fields) {
  const updated = {
    jobId,
    interviewPrepQuestions: fields.interviewPrepQuestions ?? "",
    interviewPrepTalkingPoints: fields.interviewPrepTalkingPoints ?? "",
    interviewPrepLogistics: fields.interviewPrepLogistics ?? "",
    updatedAt: new Date().toISOString(),
  };
  notesByJobId.set(jobId, updated);
  return { ...updated };
}
