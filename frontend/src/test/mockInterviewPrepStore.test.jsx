// frontend/src/test/mockInterviewPrepStore.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for the mock interview prep notes store — S3-013 (frontend piece)
//
// Business rule tested:
//   S3-BR-003 — every save must produce a fresh, audit-friendly timestamp
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  getMockInterviewPrepNotes,
  saveMockInterviewPrepNotes,
} from "../lib/mockInterviewPrepStore";

describe("getMockInterviewPrepNotes", () => {
  it("returns empty defaults for a job with no saved notes yet (expected behavior)", () => {
    const notes = getMockInterviewPrepNotes("job-with-no-notes-yet");
    expect(notes.interviewPrepQuestions).toBe("");
    expect(notes.interviewPrepTalkingPoints).toBe("");
    expect(notes.interviewPrepLogistics).toBe("");
    expect(notes.updatedAt).toBeNull();
  });
});

describe("saveMockInterviewPrepNotes", () => {
  it("saves all three fields and stamps an updatedAt timestamp (S3-BR-003)", () => {
    const saved = saveMockInterviewPrepNotes("job-alpha", {
      interviewPrepQuestions: "What's the team size?",
      interviewPrepTalkingPoints: "Mention the migration project",
      interviewPrepLogistics: "3pm Friday, Zoom",
    });

    expect(saved.interviewPrepQuestions).toBe("What's the team size?");
    expect(saved.interviewPrepTalkingPoints).toBe("Mention the migration project");
    expect(saved.interviewPrepLogistics).toBe("3pm Friday, Zoom");
    expect(saved.updatedAt).toBeTruthy();
  });

  it("keeps notes scoped per job — saving one job never touches another (regression check)", () => {
    saveMockInterviewPrepNotes("job-beta", {
      interviewPrepQuestions: "Beta question",
      interviewPrepTalkingPoints: "",
      interviewPrepLogistics: "",
    });
    saveMockInterviewPrepNotes("job-gamma", {
      interviewPrepQuestions: "Gamma question",
      interviewPrepTalkingPoints: "",
      interviewPrepLogistics: "",
    });

    const beta = getMockInterviewPrepNotes("job-beta");
    const gamma = getMockInterviewPrepNotes("job-gamma");

    expect(beta.interviewPrepQuestions).toBe("Beta question");
    expect(gamma.interviewPrepQuestions).toBe("Gamma question");
  });

  it("allows fields to be blank/empty (edge case — not all 3 fields are required)", () => {
    const saved = saveMockInterviewPrepNotes("job-delta", {
      interviewPrepQuestions: "",
      interviewPrepTalkingPoints: "Only talking points filled in",
      interviewPrepLogistics: "",
    });

    expect(saved.interviewPrepQuestions).toBe("");
    expect(saved.interviewPrepLogistics).toBe("");
    expect(saved.interviewPrepTalkingPoints).toBe("Only talking points filled in");
  });
});
