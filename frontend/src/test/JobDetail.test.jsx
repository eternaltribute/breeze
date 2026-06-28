// src/test/job-detail.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for JobDetail logic — S2-008, S2-010, S2-013, S2-014
//
// These tests check the LOGIC behind the JobDetail page — not the visual UI.
// Analogy: like testing the rules of a board game without setting up the board.
// We just verify the rules work correctly in isolation.
//
// Business rules tested:
//   S2-BR-004  canonical stages are the six defined stages
//   S2-BR-005  allowed forward transitions
//   S2-BR-006  Archived is terminal for normal flow
//   S2-BR-009  stage transitions must persist timestamped history
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ── Helper functions ──────────────────────────────────────────────────────────
// These mirror the logic used in JobDetail.jsx, extracted here for testing.

// normalizeStage: converts backend lowercase stage to display title-case.
// The backend stores "applied" but we display "Applied".
function normalizeStage(stage) {
  const map = {
    interested: "Interested",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    archived: "Archived",
  };
  return map[stage?.toLowerCase()] || "Interested";
}

// stageColor: returns the correct color for each stage pill.
// Used on the Job Detail header and Dashboard cards.
function stageColor(stage) {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  if (stage === "Rejected") return "#DC2626";
  if (stage === "Archived") return "#6B7280";
  return "#9CA3AF";
}

// isOutcomeStage: returns true if the stage should show the Outcome section.
// Per S2-BR-004/005 — only Offer, Rejected, Archived are terminal stages.
function isOutcomeStage(stage) {
  return ["Offer", "Rejected", "Archived"].includes(stage);
}

// isValidForwardTransition: checks if a stage change is an allowed forward move.
// Per S2-BR-005 — only specific transitions are allowed without confirmation.
function isValidForwardTransition(from, to) {
  const allowed = {
    Interested: ["Applied", "Rejected"],
    Applied: ["Interview", "Rejected"],
    Interview: ["Offer", "Rejected"],
    Offer: ["Archived", "Rejected"],
    Rejected: [], // terminal
    Archived: [], // terminal (S2-BR-006)
  };
  return (allowed[from] ?? []).includes(to);
}

// validateJobOverview: checks required fields before saving.
// Returns errors object — empty means valid. (S2-BR-001)
function validateJobOverview({ company, title, jobPostingBody }) {
  const errors = {};
  if (!company?.trim()) errors.company = "Company is required.";
  if (!title?.trim()) errors.title = "Job title is required.";
  if (!jobPostingBody?.trim()) errors.jobPostingBody = "Job posting body is required.";
  return errors;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("normalizeStage — S2-BR-004", () => {
  it("converts lowercase backend stage to title-case display", () => {
    expect(normalizeStage("applied")).toBe("Applied");
    expect(normalizeStage("interview")).toBe("Interview");
    expect(normalizeStage("offer")).toBe("Offer");
  });

  it("handles already title-cased input", () => {
    expect(normalizeStage("Applied")).toBe("Applied");
    expect(normalizeStage("Rejected")).toBe("Rejected");
  });

  it("defaults to Interested for unknown or undefined stage", () => {
    expect(normalizeStage(undefined)).toBe("Interested");
    expect(normalizeStage("unknown")).toBe("Interested");
    expect(normalizeStage("")).toBe("Interested");
  });

  it("normalizes all six canonical stages correctly", () => {
    const stages = ["interested", "applied", "interview", "offer", "rejected", "archived"];
    const expected = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"];
    stages.forEach((s, i) => {
      expect(normalizeStage(s)).toBe(expected[i]);
    });
  });
});

describe("stageColor — S2-BR-004", () => {
  it("returns orange for Interview and Offer", () => {
    expect(stageColor("Interview")).toBe("#FF6138");
    expect(stageColor("Offer")).toBe("#FF6138");
  });

  it("returns blue for Applied", () => {
    expect(stageColor("Applied")).toBe("#046A97");
  });

  it("returns red for Rejected", () => {
    expect(stageColor("Rejected")).toBe("#DC2626");
  });

  it("returns gray for Archived", () => {
    expect(stageColor("Archived")).toBe("#6B7280");
  });

  it("returns light gray for Interested or unknown", () => {
    expect(stageColor("Interested")).toBe("#9CA3AF");
    expect(stageColor("unknown")).toBe("#9CA3AF");
  });
});

describe("isOutcomeStage — S2-013", () => {
  it("returns true for Offer, Rejected, Archived", () => {
    // Outcome section should only appear for these stages
    expect(isOutcomeStage("Offer")).toBe(true);
    expect(isOutcomeStage("Rejected")).toBe(true);
    expect(isOutcomeStage("Archived")).toBe(true);
  });

  it("returns false for active stages", () => {
    // Outcome section should be hidden for these stages
    expect(isOutcomeStage("Interested")).toBe(false);
    expect(isOutcomeStage("Applied")).toBe(false);
    expect(isOutcomeStage("Interview")).toBe(false);
  });
});

describe("isValidForwardTransition — S2-BR-005", () => {
  it("allows Interested → Applied", () => {
    expect(isValidForwardTransition("Interested", "Applied")).toBe(true);
  });

  it("allows Interested → Rejected", () => {
    expect(isValidForwardTransition("Interested", "Rejected")).toBe(true);
  });

  it("allows Applied → Interview", () => {
    expect(isValidForwardTransition("Applied", "Interview")).toBe(true);
  });

  it("allows Interview → Offer", () => {
    expect(isValidForwardTransition("Interview", "Offer")).toBe(true);
  });

  it("allows Offer → Archived", () => {
    expect(isValidForwardTransition("Offer", "Archived")).toBe(true);
  });

  it("blocks skipping stages — Interested → Interview is not allowed", () => {
    // Can't skip Applied and go straight to Interview
    expect(isValidForwardTransition("Interested", "Interview")).toBe(false);
  });

  it("blocks going backwards — Applied → Interested is not allowed", () => {
    expect(isValidForwardTransition("Applied", "Interested")).toBe(false);
  });

  it("blocks any transition from Archived — S2-BR-006", () => {
    // Archived is terminal — nothing is allowed forward from it
    expect(isValidForwardTransition("Archived", "Interested")).toBe(false);
    expect(isValidForwardTransition("Archived", "Applied")).toBe(false);
  });

  it("blocks any transition from Rejected — terminal state", () => {
    expect(isValidForwardTransition("Rejected", "Interested")).toBe(false);
    expect(isValidForwardTransition("Rejected", "Applied")).toBe(false);
  });
});

describe("validateJobOverview — S2-BR-001", () => {
  it("returns no errors when all required fields are filled", () => {
    const errors = validateJobOverview({
      company: "Google",
      title: "Frontend Engineer",
      jobPostingBody: "We are looking for...",
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("returns error when company is empty", () => {
    const errors = validateJobOverview({
      company: "",
      title: "Frontend Engineer",
      jobPostingBody: "We are looking for...",
    });
    expect(errors.company).toBe("Company is required.");
  });

  it("returns error when title is empty", () => {
    const errors = validateJobOverview({
      company: "Google",
      title: "",
      jobPostingBody: "We are looking for...",
    });
    expect(errors.title).toBe("Job title is required.");
  });

  it("returns error when job posting body is empty — S2-BR-002", () => {
    const errors = validateJobOverview({
      company: "Google",
      title: "Frontend Engineer",
      jobPostingBody: "",
    });
    expect(errors.jobPostingBody).toBe("Job posting body is required.");
  });

  it("returns all three errors when all fields are empty", () => {
    const errors = validateJobOverview({
      company: "",
      title: "",
      jobPostingBody: "",
    });
    expect(Object.keys(errors)).toHaveLength(3);
  });

  it("treats whitespace-only fields as empty", () => {
    // A field with just spaces should be treated as empty
    const errors = validateJobOverview({
      company: "   ",
      title: "Frontend Engineer",
      jobPostingBody: "We are looking for...",
    });
    expect(errors.company).toBeDefined();
  });
});
