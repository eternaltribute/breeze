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
//   S3-006     users can filter/sort by type, status, tag, and updated date
//   S3-007     users can rename/duplicate artifacts
//   S3-BR-007  rename does not create a new version; duplicate is explicit
//   S3-BR-008  duplicated artifacts include version/timestamp/owner metadata
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

// filter and sort in Library.jsx.
function filterAndSortDocuments(
  documents,
  { status = "active", type = "", tag = "", sortKey = "updated_desc" }
) {
  let result = documents;

  if (status !== "all") {
    result = result.filter((doc) => doc.status === status);
  }

  if (type) {
    result = result.filter((doc) => doc.type === type);
  }

  if (tag) {
    result = result.filter((doc) => (doc.tags ?? []).includes(tag));
  }

  return [...result].sort((a, b) => {
    const aUpdated = a.updated_at ?? "";
    const bUpdated = b.updated_at ?? "";
    if (sortKey === "updated_asc") return aUpdated.localeCompare(bUpdated);
    return bUpdated.localeCompare(aUpdated);
  });
}

function renameDocument(documents, id, title) {
  return documents.map((doc) => (doc.id === id ? { ...doc, title } : doc));
}

function duplicateDocument(documents, id, now = "2026-07-08T12:00:00Z") {
  const source = documents.find((doc) => doc.id === id);
  if (!source) return documents;

  return [
    {
      ...source,
      id: `${source.id}-copy`,
      title: `${source.title} (Copy)`,
      status: "active",
      job_id: null,
      version_label: "v1",
      version_number: 1,
      created_at: now,
      updated_at: now,
    },
    ...documents,
  ];
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const sampleDocuments = [
  { id: "1", type: "resume", title: "Resume A", status: "active" },
  { id: "2", type: "cover_letter", title: "Cover Letter B", status: "active" },
  { id: "3", type: "resume", title: "Old Resume", status: "archived" },
];

const filterDocuments = [
  {
    id: "1",
    type: "resume",
    title: "Frontend Resume",
    status: "active",
    tags: ["frontend", "internship"],
    updated_at: "2026-07-08T10:00:00Z",
  },
  {
    id: "2",
    type: "cover_letter",
    title: "Acme Cover Letter",
    status: "active",
    tags: ["frontend", "acme"],
    updated_at: "2026-07-07T10:00:00Z",
  },
  {
    id: "3",
    type: "resume",
    title: "Archived Resume",
    status: "archived",
    tags: ["draft"],
    updated_at: "2026-07-01T10:00:00Z",
  },
];

const versionedDocuments = [
  {
    id: "1",
    type: "resume",
    title: "Resume A",
    status: "active",
    job_id: "job-1",
    version_label: "v2",
    version_number: 2,
    owner_id: "user-1",
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-02T10:00:00Z",
  },
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

describe("Library - S3-006 filtering and sorting", () => {
  it("filters by document type", () => {
    const result = filterAndSortDocuments(filterDocuments, { status: "all", type: "resume" });

    expect(result).toHaveLength(2);
    expect(result.every((doc) => doc.type === "resume")).toBe(true);
  });

  it("filters by status", () => {
    const result = filterAndSortDocuments(filterDocuments, { status: "archived" });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Archived Resume");
  });

  it("filters by tag", () => {
    const result = filterAndSortDocuments(filterDocuments, { status: "all", tag: "acme" });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Acme Cover Letter");
  });

  it("sorts by updated date newest first", () => {
    const result = filterAndSortDocuments(filterDocuments, {
      status: "all",
      sortKey: "updated_desc",
    });

    expect(result.map((doc) => doc.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by updated date oldest first", () => {
    const result = filterAndSortDocuments(filterDocuments, {
      status: "all",
      sortKey: "updated_asc",
    });

    expect(result.map((doc) => doc.id)).toEqual(["3", "2", "1"]);
  });
});

describe("Library - S3-007 rename and duplicate actions", () => {
  it("renames a document without changing its version metadata", () => {
    const result = renameDocument(versionedDocuments, "1", "Updated Resume Name");
    const renamed = result[0];

    expect(renamed.title).toBe("Updated Resume Name");
    expect(renamed.version_label).toBe("v2");
    expect(renamed.version_number).toBe(2);
    expect(renamed.owner_id).toBe("user-1");
  });

  it("duplicates a document as a new active artifact", () => {
    const result = duplicateDocument(versionedDocuments, "1");
    const copy = result[0];

    expect(copy.id).not.toBe("1");
    expect(copy.title).toBe("Resume A (Copy)");
    expect(copy.status).toBe("active");
    expect(copy.job_id).toBeNull();
  });

  it("starts duplicated artifacts at version one with ownership metadata preserved", () => {
    const result = duplicateDocument(versionedDocuments, "1");
    const copy = result[0];

    expect(copy.version_label).toBe("v1");
    expect(copy.version_number).toBe(1);
    expect(copy.owner_id).toBe("user-1");
    expect(copy.created_at).toBe("2026-07-08T12:00:00Z");
    expect(copy.updated_at).toBe("2026-07-08T12:00:00Z");
  });
});
