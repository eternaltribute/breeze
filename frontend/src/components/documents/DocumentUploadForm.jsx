// DocumentUploadForm.jsx
//
// Frontend piece of S3-004 (Implement Document Upload Workflow).
// This component handles the "sign at the entrance" (client-side validation)
// described in S3-BR-001, S3-BR-004, S3-BR-005. It does NOT talk to the
// backend directly — it hands a ready-to-send package to whatever function
// is passed in as `onUpload`, so this component stays usable no matter what
// Ronald and I land on for the FormData vs JSON contract.
//
// Follows the UI standards doc (S1-002):
//   - inline error messages, not toast-only
//   - disable actions while "in flight" instead of a spinner
//   - 8px spacing scale, existing color tokens

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  validateFile,
  validateDocumentType,
  MAX_FILE_SIZE_BYTES,
} from "../../lib/documentValidation";

// Adjust this import path if your project's UI standards doc colors live in
// a Tailwind config / CSS variables file instead — swap these for your
// existing tokens (Deep Blue #003C78, Ocean Blue #046A97, Accent Coral
// #FF6138, Soft Background #F8FAFC) rather than hardcoding new ones.

/**
 * @param {Object} props
 * @param {(payload: { file: File, documentType: string, title: string }) => Promise<void>} props.onUpload
 *   Called ONLY after client-side validation passes. Parent component is
 *   responsible for actually sending this to the backend (and for turning
 *   it into FormData or JSON, once that decision is made with Ronald).
 */
export default function DocumentUploadForm({ onUpload }) {
  // Which file the user has staged for upload (not yet submitted)
  const [selectedFile, setSelectedFile] = useState(null);

  // "resume" | "cover_letter" | "" (empty = not chosen yet)
  const [documentType, setDocumentType] = useState("");

  // Optional friendly title/name for the document, e.g. "Google SWE Resume v2"
  const [title, setTitle] = useState("");

  // Holds a single error message string, or null if no error.
  // Kept simple on purpose — one visible error at a time is easier for a
  // user to act on than a list of five things wrong at once.
  const [error, setError] = useState(null);

  // True while onUpload's promise is pending — disables the form so a user
  // can't double-submit.
  const [isUploading, setIsUploading] = useState(false);

  // react-dropzone gives us drag-and-drop AND click-to-browse for free.
  // onDrop fires with whatever files the user dropped/selected.
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    setError(null);

    // react-dropzone can reject files itself (via the `accept` prop below)
    // before they even reach our validateFile function. We still want a
    // clear message in that case.
    if (fileRejections.length > 0) {
      setError(
        "That file type isn't supported. Please upload a PDF, DOCX, or TXT file."
      );
      return;
    }

    const file = acceptedFiles[0];
    const result = validateFile(file);

    if (!result.valid) {
      setError(result.error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false, // one file at a time keeps the mental model simple
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Re-run both checks at submit time too — a user could pick a file via
    // drag-and-drop (validated above) but then never select a document
    // type, or could technically get into a weird state. Cheap to re-check.
    const fileCheck = validateFile(selectedFile);
    if (!fileCheck.valid) {
      setError(fileCheck.error);
      return;
    }

    const typeCheck = validateDocumentType(documentType);
    if (!typeCheck.valid) {
      setError(typeCheck.error);
      return;
    }

    setIsUploading(true);
    try {
      await onUpload({
        file: selectedFile,
        documentType,
        title: title.trim() || selectedFile.name, // fall back to filename
      });

      // Reset the form after a successful upload
      setSelectedFile(null);
      setDocumentType("");
      setTitle("");
    } catch (err) {
      // We don't know exactly what shape backend errors will take yet
      // (that's part of the API contract conversation with Ronald), so this
      // is a safe generic fallback for now.
      setError(
        err?.message || "Something went wrong uploading this document. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      {/* Dropzone area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-[#046A97] bg-[#F8FAFC]" : "border-gray-300"}
          ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} disabled={isUploading} />
        {selectedFile ? (
          <p className="text-sm font-medium text-[#003C78]">
            {selectedFile.name}
          </p>
        ) : isDragActive ? (
          <p className="text-sm text-gray-600">Drop the file here...</p>
        ) : (
          <p className="text-sm text-gray-600">
            Drag a file here, or click to browse
            <br />
            <span className="text-xs text-gray-400">
              PDF, DOCX, or TXT — up to {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB
            </span>
          </p>
        )}
      </div>

      {/* Document type selection — required, only resume or cover letter */}
      <div className="flex flex-col gap-1">
        <label htmlFor="documentType" className="text-sm font-medium">
          Document type <span className="text-[#FF6138]">*</span>
        </label>
        <select
          id="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={isUploading}
          className="border rounded-md p-2 text-sm"
        >
          <option value="">Select type...</option>
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover Letter</option>
        </select>
      </div>

      {/* Optional title field */}
      <div className="flex flex-col gap-1">
        <label htmlFor="documentTitle" className="text-sm font-medium">
          Title (optional)
        </label>
        <input
          id="documentTitle"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isUploading}
          placeholder="e.g. Google SWE Resume v2"
          className="border rounded-md p-2 text-sm"
        />
      </div>

      {/* Inline error message — per UI standards doc, not toast-only */}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isUploading || !selectedFile}
        className="bg-[#003C78] text-white rounded-md py-2 text-sm font-medium
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? "Uploading..." : "Upload Document"}
      </button>
    </form>
  );
}
