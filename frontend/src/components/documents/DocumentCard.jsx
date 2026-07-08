// frontend/src/components/documents/DocumentCard.jsx
//
// Renders a single document row/card in the Library (S3-001) with an
// archive/restore action (S3-008). Matches the card style used on
// Dashboard.jsx (border, radius, shadow tokens) for visual consistency.
//
// Props are plain data in — this component doesn't fetch or know about
// mock vs. real API. That decision lives in Library.jsx.

import { FileText, Mail, Archive, RotateCcw } from "lucide-react";

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "var(--shadow)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "12px",
};

const typeLabel = {
  resume: "Resume",
  cover_letter: "Cover Letter",
};

export default function DocumentCard({ document, onArchiveClick, onRestoreClick }) {
  const isArchived = document.status === "archived";
  const Icon = document.type === "resume" ? FileText : Mail;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Icon size={20} color="var(--color-heading, #003C78)" />
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-heading, #003C78)" }}>
            {document.title}
          </div>
          <div style={{ fontSize: "13px", color: "#6B7280" }}>
            {typeLabel[document.type]} · Updated{" "}
            {new Date(document.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {isArchived ? (
        <button
          onClick={() => onRestoreClick(document)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "1px solid var(--color-border-default)",
            borderRadius: "8px",
            padding: "8px 12px",
            cursor: "pointer",
            color: "#046A97",
          }}
        >
          <RotateCcw size={16} /> Restore
        </button>
      ) : (
        <button
          onClick={() => onArchiveClick(document)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "1px solid var(--color-border-default)",
            borderRadius: "8px",
            padding: "8px 12px",
            cursor: "pointer",
            color: "#6B7280",
          }}
        >
          <Archive size={16} /> Archive
        </button>
      )}
    </div>
  );
}
