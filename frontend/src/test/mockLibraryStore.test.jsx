// frontend/src/test/mockLibraryStore.test.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for the shared mock library store — S3-003 (frontend piece)
//
// This store is what lets ResumeHelper.jsx / CoverLetterHelper.jsx "save"
// a document in mock mode and have it actually appear on the Library page.
// These tests cover the two pieces of real logic in it: the duplicate-title
// fail-safe, and the shape of a newly created document/version.
//
// Business rules tested:
//   S3-BR-007  new versions/documents only get created by an explicit call
//              to addMockDocument — never automatically
//   S3-BR-008  every created document/version carries a version label,
//              a timestamp, and an owner id
//
// NOTE: unlike some other test files in this project, we import the real
// functions directly here instead of mirroring the logic, since
// mockLibraryStore.js already exports small, easily-testable pure-ish
// functions on their own (no component rendering involved).
//
// Because the store keeps its data in a module-level array (it resets only
// on page refresh, by design — see the comment in mockLibraryStore.js),
// each test below uses its own unique title so tests can't collide with
// each other or with the seeded mock-1/mock-2/mock-3 documents.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  addMockDocument,
  getMockLibraryDocuments,
  isDuplicateTitle,
} from "../lib/mockLibraryStore";

describe("isDuplicateTitle", () => {
  it("returns true for a title that matches an existing document of the same type (expected behavior)", () => {
    // "Software Engineer Resume v2" is one of the seeded mock-1 documents,
    // type: "resume".
    expect(isDuplicateTitle("Software Engineer Resume v2", "resume")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isDuplicateTitle("  software engineer resume v2  ", "resume")).toBe(true);
  });

  it("does NOT flag a duplicate across different document types (edge case)", () => {
    // Same title text, but seeded document is a "resume" — checking against
    // "cover_letter" should not collide.
    expect(isDuplicateTitle("Software Engineer Resume v2", "cover_letter")).toBe(false);
  });

  it("returns false for an empty or whitespace-only title (edge case)", () => {
    expect(isDuplicateTitle("", "resume")).toBe(false);
    expect(isDuplicateTitle("   ", "resume")).toBe(false);
  });

  it("returns false for a genuinely new title", () => {
    expect(isDuplicateTitle("A Totally Unique Title 12345", "resume")).toBe(false);
  });
});

describe("addMockDocument", () => {
  it("creates a document with correct type, title, version, and owner metadata (S3-BR-008)", () => {
    const doc = addMockDocument({
      type: "resume",
      title: "Unit Test Resume Alpha",
      documentText: "Some resume text.",
      tags: "test, alpha",
    });

    expect(doc.type).toBe("resume");
    expect(doc.title).toBe("Unit Test Resume Alpha");
    expect(doc.version_number).toBe(1);
    expect(doc.version_label).toBe("v1");
    expect(doc.owner_id).toBeTruthy();
    expect(doc.created_at).toBeTruthy();
    expect(doc.tags).toEqual(["test", "alpha"]);
    expect(doc.versions).toHaveLength(1);
    expect(doc.versions[0].document_text).toBe("Some resume text.");
  });

  it("falls back to a default title when none is given (fail-safe / edge case)", () => {
    const doc = addMockDocument({
      type: "cover_letter",
      title: "",
      documentText: "Draft text.",
    });

    expect(doc.title).toBe("Cover Letter");
  });

  it("makes the new document show up in getMockLibraryDocuments (regression check for the Helper -> Library wiring)", () => {
    addMockDocument({
      type: "resume",
      title: "Unit Test Resume Beta",
      documentText: "Beta text.",
    });

    const all = getMockLibraryDocuments();
    const found = all.find((doc) => doc.title === "Unit Test Resume Beta");
    expect(found).toBeTruthy();
    expect(found.type).toBe("resume");
  });
});
