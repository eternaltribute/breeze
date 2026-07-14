// frontend/src/pages/Library.jsx
//
// S3-001 (Document Library List View), S3-006 (Filtering/Sorting),
// and S3-008 (Archive/Restore) built
// together, per team decision — see Discord thread with Ronald/Sergio.
//
// STATUS: Using MOCK_DOCUMENTS from lib/mockDocuments.js until Ronald ships
// GET /documents (S3-001) with the `status` field (S3-008, pending
// Sergio's S3-002/S3-003 schema decision). The fetch below is written in
// the SAME shape as Dashboard.jsx's real fetch (useAuth → getToken →
// fetch(`${BASE}/...`)) specifically so swapping in the real call later is
// a small, low-risk change — not a rewrite.
//
//   EXAMPLE OF TABLE IN DATABASE:
// {
//  id: "document-id",
//  title: "My Resume",
//  type: "resume", // or "cover_letter"
//  status: "active", // or "archived"
//  updated_at: "2026-07-08T12:00:00Z",
//  tags: ["frontend"],
//  version_label: "v1",
//  version_number: 1,
//  owner_id: "user-id",
//  file_name: "resume.pdf",
//  file_url: "..."
// }
//
// Rules: S3-BR-001 (resume/cover letter only), S3-BR-002 (ownership —
// enforced server-side once real API lands), S3-BR-009 (archive/restore
// preserves version history — N/A until S3-003 version model exists).

import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useMemo } from "react";
import DocumentCard from "../components/documents/DocumentCard";
import { getMockLibraryDocuments } from "../lib/mockLibraryStore";
import { exportDocument, exportFormatLabels } from "../utils/documentExport";

const BASE = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK_DATA = false; // flip to false once GET /documents is real

// S3-007 backend contract notes:
// - PATCH /documents/:documentId should rename only; it must not create a new version.
// - POST /documents/:documentId/duplicate should create a new document copy and
//   return version label/number, timestamp, and owner metadata for S3-BR-008.
//
// C08 / version history contract:
// - GET /documents/:documentId/versions should return version_id, version_number,
//   version_label, created_at, file_url/document_text, and ownership metadata.

const tabStyle = (active) => ({
  padding: "8px 20px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-default)",
  background: active ? "var(--color-heading, #003C78)" : "var(--bg-card)",
  color: active ? "#ffffff" : "var(--color-heading, #003C78)",
  cursor: "pointer",
  fontWeight: 600,
});

const controlStyle = {
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-default)",
  backgroundColor: "var(--bg-card)",
  color: "var(--color-heading, #003C78)",
  fontSize: "14px",
};

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => (typeof tag === "string" ? tag : tag?.name))
      .filter(Boolean)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeDocument(doc) {
  const rawStatus = doc.status ?? "active";
  const normalizedStatus = rawStatus === "archived" ? "archived" : "active";

  return {
    ...doc,
    type: doc.type ?? doc.doc_type ?? doc.document_type,
    status: normalizedStatus,
    tags: normalizeTags(doc.tags),
    version_label: doc.version_label ?? doc.versionLabel ?? null,
    version_number: doc.version_number ?? doc.versionNumber ?? null,
    owner_id: doc.owner_id ?? doc.ownerId ?? doc.user_id ?? doc.userId ?? null,
    updated_at: doc.updated_at ?? doc.updatedAt ?? doc.created_at ?? doc.createdAt ?? "",
    created_at: doc.created_at ?? doc.createdAt ?? "",
  };
}

function buildDuplicateTitle(title) {
  const cleanTitle = title?.trim() || "Untitled document";
  return cleanTitle.endsWith("(Copy)") ? cleanTitle : `${cleanTitle} (Copy)`;
}

function normalizeVersion(version, fallbackDocument) {
  return {
    version_id: version.version_id ?? version.id ?? `${fallbackDocument.id}-current`,
    version_number:
      version.version_number ?? version.versionNumber ?? fallbackDocument.version_number ?? 1,
    version_label: version.version_label ?? version.versionLabel ?? fallbackDocument.version_label,
    document_text: version.document_text ?? version.documentText ?? "",
    file_url: version.file_url ?? version.fileUrl ?? fallbackDocument.file_url ?? null,
    owner_id:
      version.owner_id ??
      version.ownerId ??
      version.user_id ??
      version.userId ??
      fallbackDocument.owner_id ??
      null,
    created_at:
      version.created_at ??
      version.createdAt ??
      fallbackDocument.updated_at ??
      fallbackDocument.created_at ??
      "",
  };
}

function buildMockVersions(doc) {
  if (Array.isArray(doc.versions) && doc.versions.length > 0) {
    return doc.versions.map((version) => normalizeVersion(version, doc));
  }

  return [
    normalizeVersion(
      {
        version_id: `${doc.id}-current`,
        version_number: doc.version_number ?? 1,
        version_label: doc.version_label ?? `v${doc.version_number ?? 1}`,
        document_text: "Current saved document version.",
        created_at: doc.updated_at,
      },
      doc
    ),
  ];
}

function Library() {
  const { getToken } = useAuth();
  const { isLoaded } = useUser();

  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [statusFilter, setStatusFilter] = useState("active"); // all | active | archived
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortKey, setSortKey] = useState("updated_desc");
  const [confirmTarget, setConfirmTarget] = useState(null); // doc pending archive confirm
  const [exportMessage, setExportMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [versionTarget, setVersionTarget] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;

    async function loadDocuments() {
      setStatus("loading");
      try {
        if (USE_MOCK_DATA) {
          // Simulates network latency so loading state is visible/testable
          await new Promise((resolve) => setTimeout(resolve, 300));
          // Reads from the SHARED shelf (mockLibraryStore) instead of the
          // static mockDocuments.js file directly, so documents saved from
          // Resume Helper / Cover Letter Helper show up here too.
          setDocuments(getMockLibraryDocuments().map(normalizeDocument));
          setStatus("ready");
          return;
        }

        // Real path — same shape as Dashboard.jsx's job fetch
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load documents");
        const data = await res.json();
        setDocuments(data.map(normalizeDocument));
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load library documents:", err);
        setStatus("error");
      }
    }

    loadDocuments();
  }, [isLoaded, getToken]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(documents.flatMap((doc) => doc.tags ?? []))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    let result = documents;

    if (statusFilter !== "all") {
      result = result.filter((doc) => doc.status === statusFilter);
    }

    if (typeFilter) {
      result = result.filter((doc) => doc.type === typeFilter);
    }

    if (tagFilter) {
      result = result.filter((doc) => (doc.tags ?? []).includes(tagFilter));
    }

    return [...result].sort((a, b) => {
      const aUpdated = a.updated_at ?? "";
      const bUpdated = b.updated_at ?? "";
      if (sortKey === "updated_asc") return aUpdated.localeCompare(bUpdated);
      return bUpdated.localeCompare(aUpdated);
    });
  }, [documents, statusFilter, typeFilter, tagFilter, sortKey]);

  const isFiltered =
    statusFilter !== "active" || typeFilter || tagFilter || sortKey !== "updated_desc";

  const handleResetFilters = () => {
    setStatusFilter("active");
    setTypeFilter("");
    setTagFilter("");
    setSortKey("updated_desc");
  };

  // Optimistic local update — real persistence happens once the endpoint
  // exists. This just flips status client-side so the UI is demoable now.
  async function handleArchiveConfirmed(doc) {
    setActionMessage("");

    if (USE_MOCK_DATA) {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "archived" } : d)));
      setConfirmTarget(null);
      return;
    }

    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/documents/${doc.id}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Archive failed");

      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? normalizeDocument(data) : d)));
      setConfirmTarget(null);
    } catch (err) {
      console.error("Document archive failed:", err);
      setActionMessage("Could not archive this document. Please try again.");
    }
  }

  async function handleRestoreClick(doc) {
    setActionMessage("");

    if (USE_MOCK_DATA) {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "active" } : d)));
      return;
    }

    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/documents/${doc.id}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ restore_to: "draft" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Restore failed");

      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? normalizeDocument(data) : d)));
    } catch (err) {
      console.error("Document restore failed:", err);
      setActionMessage("Could not restore this document. Please try again.");
    }
  }

  async function handleExportDocument(doc, format) {
    setExportMessage("");

    try {
      await exportDocument({ BASE, getToken, document: doc, format });
    } catch (err) {
      console.error("Document export failed:", err);
      setExportMessage(
        `${exportFormatLabels[format]} export is ready in the UI, but needs the backend export endpoint for this document.`
      );
    }
  }

  async function handleDuplicateDocument(doc) {
    setActionMessage("");

    try {
      if (USE_MOCK_DATA) {
        const now = new Date().toISOString();
        const copy = normalizeDocument({
          ...doc,
          id: `mock-copy-${crypto.randomUUID?.() ?? Date.now()}`,
          title: buildDuplicateTitle(doc.title),
          status: "active",
          job_id: null,
          created_at: now,
          updated_at: now,
          version_label: "v1",
          version_number: 1,
        });
        setDocuments((prev) => [copy, ...prev]);
        setStatusFilter("active");
        setSortKey("updated_desc");
        setActionMessage(`Duplicated "${doc.title}".`);
        return;
      }

      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/documents/${doc.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Duplicate failed");

      setDocuments((prev) => [normalizeDocument(data), ...prev]);
      setStatusFilter("active");
      setSortKey("updated_desc");
      setActionMessage(`Duplicated "${doc.title}".`);
    } catch (err) {
      console.error("Document duplicate failed:", err);
      setActionMessage("Duplicate is ready in the UI, but needs the backend duplicate endpoint.");
    }
  }

  function handleRenameClick(doc) {
    setActionMessage("");
    setRenameError("");
    setRenameTarget(doc);
    setRenameTitle(doc.title ?? "");
  }

  async function handleRenameSubmit() {
    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      setRenameError("Document name is required.");
      return;
    }

    if (nextTitle === renameTarget.title) {
      setRenameTarget(null);
      return;
    }

    // Same-type, case-insensitive duplicate check against what's actually
    // on screen right now (documents state) — not mockLibraryStore's
    // isDuplicateTitle(), which only knows about documents from the
    // original page load and never sees Duplicate/Rename actions taken
    // during this session.
    const normalizedNextTitle = nextTitle.toLowerCase();
    const isDuplicate = documents.some(
      (doc) =>
        doc.id !== renameTarget.id &&
        doc.type === renameTarget.type &&
        (doc.title ?? "").trim().toLowerCase() === normalizedNextTitle
    );
    if (isDuplicate) {
      setRenameError(
        `A ${renameTarget.type === "resume" ? "resume" : "cover letter"} named "${nextTitle}" already exists.`
      );
      return;
    }

    setRenameSaving(true);
    setRenameError("");

    try {
      if (USE_MOCK_DATA) {
        const now = new Date().toISOString();
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === renameTarget.id ? { ...doc, title: nextTitle, updated_at: now } : doc
          )
        );
        setRenameTarget(null);
        setActionMessage(`Renamed document to "${nextTitle}".`);
        return;
      }

      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/documents/${renameTarget.id}/rename`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Rename failed");

      const renamedDocument = normalizeDocument(data);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === renameTarget.id ? { ...doc, ...renamedDocument } : doc))
      );
      setRenameTarget(null);
      setActionMessage(`Renamed document to "${renamedDocument.title ?? nextTitle}".`);
    } catch (err) {
      console.error("Document rename failed:", err);
      setRenameError("Rename is ready in the UI, but needs the backend rename endpoint.");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleVersionHistoryClick(doc) {
    setVersionTarget(doc);
    setSelectedVersion(null);
    setVersions([]);
    setVersionsError("");
    setVersionsLoading(true);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        setVersions(buildMockVersions(doc));
        return;
      }

      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/documents/${doc.id}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to load version history");

      setVersions(
        (Array.isArray(data) ? data : []).map((version) => normalizeVersion(version, doc))
      );
    } catch (err) {
      console.error("Document version history failed:", err);
      setVersionsError("Could not load version history for this document.");
    } finally {
      setVersionsLoading(false);
    }
  }

  function handleCloseVersionHistory() {
    setVersionTarget(null);
    setSelectedVersion(null);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg, #F8FAFC)",
        minHeight: "100vh",
        padding: "40px 60px",
        maxWidth: "1000px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          marginBottom: "12px",
          fontSize: "40px",
          lineHeight: "1.2",
          fontWeight: 700,
        }}
      >
        Library
      </h1>

      <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
        <button style={tabStyle(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
          All
        </button>
        <button
          style={tabStyle(statusFilter === "active")}
          onClick={() => setStatusFilter("active")}
        >
          Active
        </button>
        <button
          style={tabStyle(statusFilter === "archived")}
          onClick={() => setStatusFilter("archived")}
        >
          Archived
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={controlStyle}
          aria-label="Filter documents by type"
        >
          <option value="">All Types</option>
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover Letter</option>
        </select>

        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={controlStyle}
          aria-label="Filter documents by tag"
        >
          <option value="">All Tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          style={controlStyle}
          aria-label="Sort documents by updated date"
        >
          <option value="updated_desc">Updated Date (newest first)</option>
          <option value="updated_asc">Updated Date (oldest first)</option>
        </select>

        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              ...controlStyle,
              backgroundColor: "transparent",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {status === "loading" && <p style={{ color: "var(--color-subtext)" }}>Loading documents…</p>}

      {status === "error" && (
        <p style={{ color: "#DC2626" }}>
          Couldn't load your documents. Please try refreshing the page.
        </p>
      )}

      {exportMessage && (
        <div
          style={{
            border: "1px solid #BFDBFE",
            backgroundColor: "#EFF6FF",
            color: "#003C78",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "16px",
          }}
        >
          {exportMessage}
        </div>
      )}

      {actionMessage && (
        <div
          style={{
            border: "1px solid #BBF7D0",
            backgroundColor: "#F0FDF4",
            color: "#166534",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "16px",
          }}
        >
          {actionMessage}
        </div>
      )}

      {status === "ready" && visibleDocuments.length === 0 && (
        <p style={{ color: "var(--color-subtext)" }}>
          {isFiltered
            ? "No documents match those filters."
            : "No documents yet. Upload a resume or cover letter to get started."}
        </p>
      )}

      {status === "ready" &&
        visibleDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onArchiveClick={setConfirmTarget}
            onRestoreClick={handleRestoreClick}
            onExport={handleExportDocument}
            onDuplicate={handleDuplicateDocument}
            onRename={handleRenameClick}
            onVersionHistory={handleVersionHistoryClick}
          />
        ))}

      {versionTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "var(--shadow)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "var(--color-heading, #003C78)" }}>
              Version history
            </h3>
            <p style={{ color: "var(--color-subtext)", fontSize: "13px", marginBottom: "18px" }}>
              {versionTarget.title}
            </p>

            {versionsLoading && (
              <p style={{ color: "var(--color-subtext)", fontSize: "14px" }}>
                Loading version history...
              </p>
            )}

            {versionsError && (
              <p style={{ color: "#DC2626", fontSize: "13px", fontWeight: 700 }}>{versionsError}</p>
            )}

            {!versionsLoading && !versionsError && versions.length === 0 && (
              <p style={{ color: "var(--color-subtext)", fontSize: "14px" }}>
                No previous versions found for this document.
              </p>
            )}

            {!versionsLoading &&
              !versionsError &&
              versions.map((version) => (
                <div
                  key={version.version_id}
                  style={{
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "8px",
                    padding: "14px",
                    marginBottom: "10px",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--color-heading, #003C78)" }}>
                        {version.version_label ?? `v${version.version_number}`}
                      </div>
                      <div style={{ color: "#6B7280", fontSize: "12px", marginTop: "4px" }}>
                        Version {version.version_number}
                        {version.owner_id ? ` - Owner ${version.owner_id}` : ""}
                      </div>
                    </div>
                    <div style={{ color: "#6B7280", fontSize: "12px", textAlign: "right" }}>
                      {version.created_at
                        ? new Date(version.created_at).toLocaleString()
                        : "No timestamp"}
                    </div>
                  </div>

                  {version.document_text && (
                    <p
                      style={{
                        color: "var(--color-subtext)",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        marginBottom: "12px",
                      }}
                    >
                      {version.document_text.slice(0, 160)}
                      {version.document_text.length > 160 ? "..." : ""}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedVersion(version)}
                      style={{
                        border: "1px solid var(--color-border-default)",
                        borderRadius: "8px",
                        background: "none",
                        padding: "7px 12px",
                        color: "#046A97",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>

                    {version.file_url && (
                      <a
                        href={version.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          border: "1px solid var(--color-border-default)",
                          borderRadius: "8px",
                          padding: "7px 12px",
                          color: "#046A97",
                          fontSize: "13px",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        Open file
                      </a>
                    )}
                  </div>
                </div>
              ))}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                onClick={handleCloseVersionHistory}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default)",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVersion && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 30,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "82vh",
              overflowY: "auto",
              boxShadow: "var(--shadow)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "var(--color-heading, #003C78)" }}>
              {selectedVersion.version_label ?? `v${selectedVersion.version_number}`}
            </h3>
            <p style={{ color: "var(--color-subtext)", fontSize: "13px", marginBottom: "18px" }}>
              Version {selectedVersion.version_number}
              {selectedVersion.created_at
                ? ` - ${new Date(selectedVersion.created_at).toLocaleString()}`
                : ""}
            </p>

            {selectedVersion.document_text ? (
              <div
                style={{
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#F8FAFC",
                  color: "var(--color-heading, #003C78)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedVersion.document_text}
              </div>
            ) : (
              <p style={{ color: "var(--color-subtext)", fontSize: "14px" }}>
                This version does not include readable text. Open the saved file to view it.
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
                flexWrap: "wrap",
              }}
            >
              {selectedVersion.file_url && (
                <a
                  href={selectedVersion.file_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-default)",
                    color: "#046A97",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Open file
                </a>
              )}
              <button
                onClick={() => setSelectedVersion(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default)",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                Back to history
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "var(--shadow)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "var(--color-heading, #003C78)" }}>
              Rename document
            </h3>
            <p style={{ color: "var(--color-subtext)", fontSize: "13px" }}>
              Update the document name without creating a new version.
            </p>
            <input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              aria-label="Document name"
              style={{
                ...controlStyle,
                width: "100%",
                boxSizing: "border-box",
                marginTop: "8px",
              }}
              autoFocus
            />
            {renameError && (
              <p style={{ color: "#DC2626", fontSize: "13px", fontWeight: 700 }}>{renameError}</p>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setRenameTarget(null)}
                disabled={renameSaving}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default)",
                  background: "none",
                  cursor: renameSaving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={renameSaving}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#003C78",
                  color: "white",
                  cursor: renameSaving ? "not-allowed" : "pointer",
                  opacity: renameSaving ? 0.7 : 1,
                }}
              >
                {renameSaving ? "Saving..." : "Save name"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              boxShadow: "var(--shadow)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "var(--color-heading, #003C78)" }}>
              Archive this document?
            </h3>
            <p style={{ color: "var(--color-subtext)" }}>
              "{confirmTarget.title}" will move out of your active library. You can restore it any
              time.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default)",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveConfirmed(confirmTarget)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#FF6138",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Library;
