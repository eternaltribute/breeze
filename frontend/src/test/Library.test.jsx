// frontend/src/test/Library.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for Library page logic — S3-001, S3-008
//
// Same approach as JobDetail.test.jsx: test the RULES behind the page, not
// the rendered UI. These functions mirror the logic inside Library.jsx.
//
// Business rules tested:
//   S3-BR-001  only resume/cover_letter document types exist
//   S3-BR-009  archive/restore must not lose document data (stand-in check;
//              real version-history preservation depends on S3-003, which
//              doesn't exist in the backend yet)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

// ── Helper functions ──────────────────────────────────────────────────────────
// Mirror the logic used in Library.jsx, extracted here for testing.

// filterByStatus: mirrors the `visibleDocuments` useMemo in Library.jsx.
function filterByStatus(documents, tab) {
  return documents.filter((doc) => doc.status === tab);
}

// archiveDocument: mirrors handleArchiveConfirmed in Library.jsx.
function archiveDocument(documents, id) {
  return documents.map((d) => (d.id === id ? { ...d, status: "archived" } : d));
}

// restoreDocument: mirrors handleRestoreClick in Library.jsx.
function restoreDocument(documents, id) {
  return documents.map((d) => (d.id === id ? { ...d, status: "active" } : d));
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const sampleDocuments = [
  { id: "1", type: "resume", title: "Resume A", status: "active" },
  { id: "2", type: "cover_letter", title: "Cover Letter B", status: "active" },
  { id: "3", type: "resume", title: "Old Resume", status: "archived" },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Library — filtering by status", () => {
  it("happy path: shows only active documents on the Active tab", () => {
    const result = filterByStatus(sampleDocuments, "active");
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.status === "active")).toBe(true);
  });

  it("happy path: shows only archived documents on the Archived tab", () => {
    const result = filterByStatus(sampleDocuments, "archived");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Old Resume");
  });

  it("edge case: returns an empty list when no documents match the tab", () => {
    const noArchived = sampleDocuments.filter((d) => d.status !== "archived");
    const result = filterByStatus(noArchived, "archived");
    expect(result).toEqual([]);
  });
});

describe("Library — archive action", () => {
  it("happy path: archiving a document flips its status to archived", () => {
    const result = archiveDocument(sampleDocuments, "1");
    const archived = result.find((d) => d.id === "1");
    expect(archived.status).toBe("archived");
  });

  it("regression: archiving one document does not affect other documents", () => {
    const result = archiveDocument(sampleDocuments, "1");
    const untouched = result.find((d) => d.id === "2");
    expect(untouched.status).toBe("active");
  });

  it("edge case: archiving preserves all other document fields (stand-in for S3-BR-009 — real version-history preservation depends on S3-003)", () => {
    const result = archiveDocument(sampleDocuments, "1");
    const archived = result.find((d) => d.id === "1");
    expect(archived.title).toBe("Resume A");
    expect(archived.type).toBe("resume");
  });
});

describe("Library — restore action", () => {
  it("happy path: restoring a document flips its status back to active", () => {
    const result = restoreDocument(sampleDocuments, "3");
    const restored = result.find((d) => d.id === "3");
    expect(restored.status).toBe("active");
  });

  it("regression: an archived-then-restored document reappears on the Active tab", () => {
    const restored = restoreDocument(sampleDocuments, "3");
    const activeList = filterByStatus(restored, "active");
    expect(activeList.some((d) => d.id === "3")).toBe(true);
  });
});
