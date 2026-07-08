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
//  id: "...",
//  title: "...",
//  type: "resume" | "cover_letter",
//  status: "active" | "archived",
//  tags: [],
//  updated_at: "2026-07-08T12:00:00Z"
//  }
//
// Rules: S3-BR-001 (resume/cover letter only), S3-BR-002 (ownership —
// enforced server-side once real API lands), S3-BR-009 (archive/restore
// preserves version history — N/A until S3-003 version model exists).

import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useMemo } from "react";
import DocumentCard from "../components/documents/DocumentCard";
import { MOCK_DOCUMENTS } from "../lib/mockDocuments";
import { exportDocument, exportFormatLabels } from "../utils/documentExport";

const BASE = import.meta.env.VITE_API_BASE_URL;
const USE_MOCK_DATA = true; // flip to false once GET /documents is real

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
  return {
    ...doc,
    type: doc.type ?? doc.document_type,
    status: doc.status ?? "active",
    tags: normalizeTags(doc.tags),
    updated_at: doc.updated_at ?? doc.updatedAt ?? doc.created_at ?? doc.createdAt ?? "",
    created_at: doc.created_at ?? doc.createdAt ?? "",
  };
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

  useEffect(() => {
    if (!isLoaded) return;

    async function loadDocuments() {
      setStatus("loading");
      try {
        if (USE_MOCK_DATA) {
          // Simulates network latency so loading state is visible/testable
          await new Promise((resolve) => setTimeout(resolve, 300));
          setDocuments(MOCK_DOCUMENTS.map(normalizeDocument));
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
  function handleArchiveConfirmed(doc) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "archived" } : d)));
    setConfirmTarget(null);
  }

  function handleRestoreClick(doc) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "active" } : d)));
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
          />
        ))}

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
