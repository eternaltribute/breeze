// src/test/documentValidation.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for document upload validation logic — S3-004
//
// These tests check the two pure functions in documentValidation.js:
//   - validateFile: file type, mime type match, size, empty-file checks
//   - validateDocumentType: resume/cover_letter selection check
//
// Business rules tested:
//   S3-BR-001  Only "resume" or "cover_letter" are valid document types
//   S3-BR-004  Only PDF, DOCX, TXT files are accepted
//   S3-BR-005  Rejections must come with a clear, specific message
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  validateFile,
  validateDocumentType,
  MAX_FILE_SIZE_BYTES,
} from "../lib/documentValidation";

// Small helper to build a fake File object for testing, since we don't have
// real files in a test environment. jsdom (configured in vite.config.js)
// supports the File API, so `new File(...)` works here just like a browser.
function makeFile({ name, type, sizeBytes }) {
  // Build content of the exact byte size we want, so file.size is predictable.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("validateFile", () => {
  // ── Happy path ──────────────────────────────────────────────────────────
  it("accepts a valid PDF file", () => {
    const file = makeFile({
      name: "resume.pdf",
      type: "application/pdf",
      sizeBytes: 1024, // 1KB, well under the limit
    });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid DOCX file", () => {
    const file = makeFile({
      name: "cover_letter.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 2048,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid TXT file", () => {
    const file = makeFile({
      name: "notes.txt",
      type: "text/plain",
      sizeBytes: 512,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  // ── Error state: wrong file type (S3-BR-004, S3-BR-005) ────────────────
  it("rejects a file with an unsupported extension", () => {
    const file = makeFile({
      name: "photo.jpg",
      type: "image/jpeg",
      sizeBytes: 1024,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    // S3-BR-005: message must be clear/specific, not generic
    expect(result.error).toMatch(/PDF, DOCX, or TXT/);
  });

  it("rejects a file whose reported type doesn't match its extension", () => {
    // Extension says .pdf, but the browser reported it as a jpeg — this
    // catches a mismatched/renamed file.
    const file = makeFile({
      name: "sneaky.pdf",
      type: "image/jpeg",
      sizeBytes: 1024,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
  });

  // ── Error state: size limits ────────────────────────────────────────────
  it("rejects a file over the size limit", () => {
    const file = makeFile({
      name: "huge.pdf",
      type: "application/pdf",
      sizeBytes: MAX_FILE_SIZE_BYTES + 1, // one byte over the cap
    });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it("accepts a file exactly at the size limit", () => {
    // Edge case: the boundary itself should still be valid, not rejected.
    const file = makeFile({
      name: "exact.pdf",
      type: "application/pdf",
      sizeBytes: MAX_FILE_SIZE_BYTES,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  // ── Empty/edge state ─────────────────────────────────────────────────────
  it("rejects an empty (0 byte) file", () => {
    const file = makeFile({
      name: "empty.pdf",
      type: "application/pdf",
      sizeBytes: 0,
    });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects when no file is provided at all", () => {
    const result = validateFile(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no file/i);
  });
});

describe("validateDocumentType", () => {
  // ── Happy path (S3-BR-001) ───────────────────────────────────────────────
  it("accepts 'resume'", () => {
    expect(validateDocumentType("resume").valid).toBe(true);
  });

  it("accepts 'cover_letter'", () => {
    expect(validateDocumentType("cover_letter").valid).toBe(true);
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  it("rejects when no document type is selected", () => {
    const result = validateDocumentType("");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/choose/i);
  });

  // ── Error state ───────────────────────────────────────────────────────────
  it("rejects a document type that isn't resume or cover_letter", () => {
    const result = validateDocumentType("portfolio");
    expect(result.valid).toBe(false);
  });
});
