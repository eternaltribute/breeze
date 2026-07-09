export const EXPORT_FORMATS = ["pdf", "docx", "txt"];

export const exportFormatLabels = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
};

export function buildExportFileName(document, format) {
  const rawName = document?.title || document?.file_name || document?.type || "document";
  const safeName = rawName
    .replace(/\.(pdf|docx|txt)$/i, "")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "_");

  return `${safeName || "document"}.${format}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openOriginalFile(document) {
  if (!document?.file_url) return false;

  window.open(document.file_url, "_blank", "noopener,noreferrer");
  return true;
}

// S3-005 / S3-BR-006 backend contract:
// GET /documents/:documentId/export?format=pdf|docx|txt
// - Requires Authorization: Bearer <Clerk token>
// - Must verify the document belongs to current_user["sub"] (S3-BR-002)
// - Must support only resume and cover_letter business types (S3-BR-001)
// - Must return a downloadable file/blob with Content-Disposition filename
// - Should export the selected version when version_id is provided later:
//   GET /documents/:documentId/export?format=pdf&version_id=:versionId
export async function exportDocument({ BASE, getToken, document, format }) {
  if (!EXPORT_FORMATS.includes(format)) {
    throw new Error("Unsupported export format.");
  }

  if (!document?.id) {
    throw new Error("Document is missing an id.");
  }

  // API-ready fallback: until backend export exists, opening the original uploaded
  // file keeps library downloads usable when the document already has a file_url.
  if (document.file_url && document.file_name?.toLowerCase().endsWith(`.${format}`)) {
    openOriginalFile(document);
    return;
  }

  const token = await getToken({ skipCache: true });
  const res = await fetch(`${BASE}/documents/${document.id}/export?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404 && openOriginalFile(document)) return;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Could not export ${exportFormatLabels[format]}.`);
  }

  const blob = await res.blob();
  downloadBlob(blob, buildExportFileName(document, format));
}
