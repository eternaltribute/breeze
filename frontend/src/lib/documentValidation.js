// documentValidation.js
//
// Pure validation logic for the S3-004 Document Upload Workflow.
// Kept separate from the UI component on purpose:
//   1. It's easy to unit test (S3-021 wants coverage on document logic).
//   2. Other flows (like a future "upload a new version" action) can reuse it
//      without duplicating the same checks.
//
// Business rules this file enforces:
//   S3-BR-001: only "resume" or "cover_letter" are valid document types.
//   S3-BR-004: only PDF, DOCX, TXT files are accepted.
//   S3-BR-005: rejections must come with a clear, specific message.

// The two document types the business allows. If this list ever needs a
// third type, S3-BR-001 (the canonical rule) has to change first — this is
// just where that rule lives in code.
export const VALID_DOCUMENT_TYPES = ["resume", "cover_letter"];

// Map of allowed file extension -> the MIME type(s) browsers/OSes typically
// report for it. We check extension AND mime type together because relying
// on just one is easy to spoof or get a false negative on (e.g. some
// Windows setups report .docx as a generic octet-stream mime type).
const ALLOWED_FILE_TYPES = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".txt": ["text/plain"],
};

// Adjustable cap — nothing in the business rules pins a number, this is a
// judgment call to keep uploads demo-safe. Change this one constant if the
// team decides on a different limit.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Pulls the extension off a filename, lowercased, including the dot.
 * "MyResume.PDF" -> ".pdf"
 */
function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Checks a single File object against S3-BR-004 / S3-BR-005.
 * Returns { valid: true } or { valid: false, error: "human readable message" }.
 *
 * This does NOT check document type (resume/cover_letter) — that's a
 * separate concern handled by validateDocumentType, since a file can be
 * "a valid file" and still be missing a document type selection.
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: "No file was selected." };
  }

  const extension = getFileExtension(file.name);
  const allowedMimeTypes = ALLOWED_FILE_TYPES[extension];

  if (!allowedMimeTypes) {
    return {
      valid: false,
      error: `"${extension || "unknown"}" isn't a supported format. Please upload a PDF, DOCX, or TXT file.`,
    };
  }

  // Some browsers leave file.type empty for certain file types — if that
  // happens, we don't hard-fail on mime type alone since extension already
  // passed. But if the browser DID report a mime type, it must match.
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `This file's contents don't match a ${extension} file. Please check the file and try again.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    return {
      valid: false,
      error: `File is too large. Maximum size is ${maxMB}MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "This file appears to be empty." };
  }

  return { valid: true };
}

/**
 * Checks that a document type was actually selected and is one of the
 * two allowed values (S3-BR-001).
 */
export function validateDocumentType(documentType) {
  if (!documentType) {
    return {
      valid: false,
      error: "Please choose whether this is a resume or cover letter.",
    };
  }

  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    return {
      valid: false,
      error: "Document type must be either resume or cover letter.",
    };
  }

  return { valid: true };
}
