// frontend/src/pages/Library.jsx
//
// S3-001 (Document Library List View) + S3-008 (Archive/Restore) built
// together, per team decision — see Discord thread with Ronald/Sergio.
//
// STATUS: Using MOCK_DOCUMENTS from lib/mockDocuments.js until Ronald ships
// GET /documents (S3-001) with the `status` field (S3-008, pending
// Sergio's S3-002/S3-003 schema decision). The fetch below is written in
// the SAME shape as Dashboard.jsx's real fetch (useAuth → getToken →
// fetch(`${BASE}/...`)) specifically so swapping in the real call later is
// a small, low-risk change — not a rewrite.
//
// Rules: S3-BR-001 (resume/cover letter only), S3-BR-002 (ownership —
// enforced server-side once real API lands), S3-BR-009 (archive/restore
// preserves version history — N/A until S3-003 version model exists).

import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useMemo } from "react";
import DocumentCard from "../components/documents/DocumentCard";
import { MOCK_DOCUMENTS } from "../lib/mockDocuments";

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

function Library() {
  const { getToken } = useAuth();
  const { isLoaded } = useUser();

  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [activeTab, setActiveTab] = useState("active"); // active | archived
  const [confirmTarget, setConfirmTarget] = useState(null); // doc pending archive confirm

  useEffect(() => {
    if (!isLoaded) return;

    async function loadDocuments() {
      setStatus("loading");
      try {
        if (USE_MOCK_DATA) {
          // Simulates network latency so loading state is visible/testable
          await new Promise((resolve) => setTimeout(resolve, 300));
          setDocuments(MOCK_DOCUMENTS);
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
        setDocuments(data);
        setStatus("ready");
      } catch (err) {
        console.error("Failed to load library documents:", err);
        setStatus("error");
      }
    }

    loadDocuments();
  }, [isLoaded, getToken]);

  const visibleDocuments = useMemo(
    () => documents.filter((doc) => doc.status === activeTab),
    [documents, activeTab]
  );

  // Optimistic local update — real persistence happens once the endpoint
  // exists. This just flips status client-side so the UI is demoable now.
  function handleArchiveConfirmed(doc) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "archived" } : d)));
    setConfirmTarget(null);
  }

  function handleRestoreClick(doc) {
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "active" } : d)));
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

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <button style={tabStyle(activeTab === "active")} onClick={() => setActiveTab("active")}>
          Active
        </button>
        <button style={tabStyle(activeTab === "archived")} onClick={() => setActiveTab("archived")}>
          Archived
        </button>
      </div>

      {status === "loading" && <p style={{ color: "var(--color-subtext)" }}>Loading documents…</p>}

      {status === "error" && (
        <p style={{ color: "#DC2626" }}>
          Couldn't load your documents. Please try refreshing the page.
        </p>
      )}

      {status === "ready" && visibleDocuments.length === 0 && (
        <p style={{ color: "var(--color-subtext)" }}>
          {activeTab === "active"
            ? "No documents yet. Upload a resume or cover letter to get started."
            : "No archived documents."}
        </p>
      )}

      {status === "ready" &&
        visibleDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onArchiveClick={setConfirmTarget}
            onRestoreClick={handleRestoreClick}
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
