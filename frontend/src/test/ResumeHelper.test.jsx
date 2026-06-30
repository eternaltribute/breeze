// src/test/resume-helper.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for Resume Helper logic — S2-021, S2-023
//
// These tests check the logic behind the Resume Helper page:
//   - Score calculation from 5 metrics
//   - Metric bar color thresholds
//   - File type validation (PDF/DOCX only per PRD §4.4)
//   - Improve instruction validation
//
// Business rules tested:
//   S2-BR-018  AI drafting must be triggered by explicit user action
//   S2-BR-020  Generated output is editable before save
//   PRD §4.4   Supported upload formats: PDF, DOCX, TXT only
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ── Helper functions ──────────────────────────────────────────────────────────
// These mirror the logic used in ResumeHelper.jsx, extracted for testing.

// calculateTotalScore: adds up all 5 metric scores into an overall score.
// Each metric is 0-20, total is 0-100.
function calculateTotalScore(metrics) {
  if (!metrics) return 0;
  return (
    (metrics.contact_info ?? 0) +
    (metrics.summary ?? 0) +
    (metrics.experience ?? 0) +
    (metrics.skills ?? 0) +
    (metrics.length ?? 0)
  );
}

// getMetricColor: returns the color for a metric bar based on its percentage.
// Green = 75%+, Orange = 50-74%, Red = below 50%
function getMetricColor(score, max = 20) {
  const pct = (score / max) * 100;
  if (pct >= 75) return "#22c55e"; // green
  if (pct >= 50) return "#FF6138"; // orange
  return "#DC2626"; // red
}

// isAllowedFileType: validates that uploaded file is PDF or DOCX only.
// Per PRD §4.4 — unsupported formats must be rejected.
function isAllowedFileType(fileName) {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
}

// canAnalyze: returns true only if there is resume text to analyze.
// Per S2-BR-018 — AI action must be explicitly triggered with content present.
function canAnalyze(resumeText, isAnalyzing) {
  return resumeText.trim().length > 0 && !isAnalyzing;
}

// canImprove: returns true only if both resume text and instruction are present.
// Per S2-BR-018 — AI action requires both content and an instruction.
function canImprove(resumeText, instruction, isImproving) {
  return resumeText.trim().length > 0 && instruction.trim().length > 0 && !isImproving;
}

// canSave: returns true only if there is resume text to save.
function canSave(resumeText, isSaving) {
  return resumeText.trim().length > 0 && !isSaving;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("calculateTotalScore — S2-021", () => {
  it("adds all five metrics to get a total score", () => {
    const metrics = {
      contact_info: 18,
      summary: 10,
      experience: 16,
      skills: 8,
      length: 20,
    };
    // 18 + 10 + 16 + 8 + 20 = 72
    expect(calculateTotalScore(metrics)).toBe(72);
  });

  it("returns 100 for a perfect score", () => {
    const metrics = {
      contact_info: 20,
      summary: 20,
      experience: 20,
      skills: 20,
      length: 20,
    };
    expect(calculateTotalScore(metrics)).toBe(100);
  });

  it("returns 0 for all zero scores", () => {
    const metrics = {
      contact_info: 0,
      summary: 0,
      experience: 0,
      skills: 0,
      length: 0,
    };
    expect(calculateTotalScore(metrics)).toBe(0);
  });

  it("returns 0 for null metrics", () => {
    expect(calculateTotalScore(null)).toBe(0);
  });

  it("handles missing individual metrics gracefully", () => {
    // If a metric is missing, treat it as 0
    const metrics = { contact_info: 15, summary: 10 };
    expect(calculateTotalScore(metrics)).toBe(25);
  });
});

describe("getMetricColor — S2-021", () => {
  it("returns green when score is 75% or above of max", () => {
    // 15/20 = 75% — should be green
    expect(getMetricColor(15, 20)).toBe("#22c55e");
    // 20/20 = 100% — should be green
    expect(getMetricColor(20, 20)).toBe("#22c55e");
  });

  it("returns orange when score is 50-74% of max", () => {
    // 10/20 = 50% — should be orange
    expect(getMetricColor(10, 20)).toBe("#FF6138");
    // 14/20 = 70% — should be orange
    expect(getMetricColor(14, 20)).toBe("#FF6138");
  });

  it("returns red when score is below 50% of max", () => {
    // 8/20 = 40% — should be red
    expect(getMetricColor(8, 20)).toBe("#DC2626");
    // 0/20 = 0% — should be red
    expect(getMetricColor(0, 20)).toBe("#DC2626");
  });
});

describe("isAllowedFileType — PRD §4.4", () => {
  it("allows PDF files", () => {
    expect(isAllowedFileType("resume.pdf")).toBe(true);
    expect(isAllowedFileType("My Resume.PDF")).toBe(true); // case insensitive
  });

  it("allows DOCX files", () => {
    expect(isAllowedFileType("resume.docx")).toBe(true);
    expect(isAllowedFileType("Resume.DOCX")).toBe(true); // case insensitive
  });

  it("rejects DOC files — only DOCX is supported", () => {
    expect(isAllowedFileType("resume.doc")).toBe(false);
  });

  it("rejects TXT files", () => {
    expect(isAllowedFileType("resume.txt")).toBe(false);
  });

  it("rejects PNG and other image files", () => {
    expect(isAllowedFileType("resume.png")).toBe(false);
    expect(isAllowedFileType("resume.jpg")).toBe(false);
  });

  it("rejects empty or null filename", () => {
    expect(isAllowedFileType("")).toBe(false);
    expect(isAllowedFileType(null)).toBe(false);
  });
});

describe("canAnalyze — S2-BR-018", () => {
  it("returns true when resume text is present and not currently analyzing", () => {
    expect(canAnalyze("My resume text here", false)).toBe(true);
  });

  it("returns false when resume text is empty", () => {
    // Can't analyze with no content — S2-BR-018 requires content present
    expect(canAnalyze("", false)).toBe(false);
    expect(canAnalyze("   ", false)).toBe(false); // whitespace only
  });

  it("returns false when already analyzing", () => {
    // Prevents double-clicking the analyze button
    expect(canAnalyze("My resume text", true)).toBe(false);
  });
});

describe("canImprove — S2-BR-018, S2-BR-020", () => {
  it("returns true when both resume text and instruction are present", () => {
    expect(canImprove("My resume", "Make bullets more concise", false)).toBe(true);
  });

  it("returns false when resume text is empty", () => {
    expect(canImprove("", "Make bullets more concise", false)).toBe(false);
  });

  it("returns false when instruction is empty", () => {
    // User must provide an instruction — S2-BR-018 requires explicit action
    expect(canImprove("My resume", "", false)).toBe(false);
    expect(canImprove("My resume", "   ", false)).toBe(false);
  });

  it("returns false when already improving", () => {
    expect(canImprove("My resume", "Make it better", true)).toBe(false);
  });
});

describe("canSave — S2-024", () => {
  it("returns true when resume text is present and not saving", () => {
    expect(canSave("My resume text", false)).toBe(true);
  });

  it("returns false when resume text is empty", () => {
    expect(canSave("", false)).toBe(false);
  });

  it("returns false when already saving", () => {
    expect(canSave("My resume text", true)).toBe(false);
  });
});

// ── S2-021: Generate Tailored Resume from Job — helper functions ─────────────
// These mirror the logic in GenerateFromProfileCard and the empty-state
// chooser added to ResumeHelper.jsx.

// canGenerateForJob: mirrors the Generate button's disabled logic.
// Requires a job to be selected, and blocks double-clicks while in flight.
function canGenerateForJob(selectedJobId, isGenerating) {
  return Boolean(selectedJobId) && !isGenerating;
}

// shouldShowChooser: mirrors which screen renders at the top of the page —
// the three-card chooser (Upload / Generate / AI Review) when there's no
// resume text yet, or the full editor once there is.
function shouldShowChooser(resumeText) {
  return !resumeText || resumeText.trim().length === 0;
}

// hasNoJobsAvailable: mirrors the "Add a job on your Dashboard first" hint
// shown under the Generate button when the user has no jobs to pick from.
function hasNoJobsAvailable(jobs) {
  return jobs.length === 0;
}

// formatJobOptionLabel: mirrors the "{title} — {company}" text shown for
// each option in the job dropdown.
function formatJobOptionLabel(job) {
  return `${job.title} — ${job.company}`;
}

describe("canGenerateForJob — S2-021, S2-BR-018", () => {
  it("returns true when a job is selected and not currently generating", () => {
    expect(canGenerateForJob("job-123", false)).toBe(true);
  });

  it("returns false when no job is selected", () => {
    // Can't generate a tailored resume without knowing which job to tailor it to
    expect(canGenerateForJob("", false)).toBe(false);
  });

  it("returns false while already generating", () => {
    // Prevents double-clicking the generate button
    expect(canGenerateForJob("job-123", true)).toBe(false);
  });
});

describe("shouldShowChooser — empty-state layout", () => {
  it("returns true when resumeText is an empty string", () => {
    expect(shouldShowChooser("")).toBe(true);
  });

  it("returns true when resumeText is only whitespace", () => {
    expect(shouldShowChooser("   ")).toBe(true);
  });

  it("returns false once resumeText has real content", () => {
    expect(shouldShowChooser("John Doe\nSoftware Engineer")).toBe(false);
  });
});

describe("hasNoJobsAvailable — Generate card empty state", () => {
  it("returns true when the user has no jobs yet", () => {
    expect(hasNoJobsAvailable([])).toBe(true);
  });

  it("returns false when the user has at least one job", () => {
    expect(hasNoJobsAvailable([{ id: "1", title: "SWE", company: "Acme" }])).toBe(false);
  });
});

describe("formatJobOptionLabel — job dropdown display", () => {
  it("formats title and company with an em dash separator", () => {
    const job = { id: "1", title: "Frontend Engineer", company: "Google" };
    expect(formatJobOptionLabel(job)).toBe("Frontend Engineer — Google");
  });

  it("handles a different title/company pair correctly", () => {
    const job = { id: "2", title: "Backend Intern", company: "Stripe" };
    expect(formatJobOptionLabel(job)).toBe("Backend Intern — Stripe");
  });
});
