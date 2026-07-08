// frontend/src/components/documents/DocumentCard.jsx
//
// Renders a single document row/card in the Library (S3-001) with an
// archive/restore action (S3-008). Matches the card style used on
// Dashboard.jsx (border, radius, shadow tokens) for visual consistency.
//
// Props are plain data in — this component doesn't fetch or know about
// mock vs. real API. That decision lives in Library.jsx.

import { FileText, Mail, Archive, RotateCcw, Download } from "lucide-react";
import { EXPORT_FORMATS, exportFormatLabels } from "../../utils/documentExport";

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "var(--shadow)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "12px",
  flexWrap: "wrap",
};

const typeLabel = {
  resume: "Resume",
  cover_letter: "Cover Letter",
};

const statusLabel = {
  active: "Active",
  archived: "Archived",
};

const getStatusChipStyle = (isArchived) => ({
  display: "inline-block",
  borderRadius: "999px",
  backgroundColor: isArchived ? "#F3F4F6" : "#ECFDF5",
  color: isArchived ? "#6B7280" : "#047857",
  padding: "3px 8px",
  fontSize: "11px",
  fontWeight: 700,
});

export default function DocumentCard({ document, onArchiveClick, onRestoreClick, onExport }) {
  const isArchived = document.status === "archived";
  const Icon = document.type === "resume" ? FileText : Mail;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 280px" }}>
        <Icon size={20} color="var(--color-heading, #003C78)" />
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-heading, #003C78)" }}>
            {document.title}
          </div>
          <div style={{ fontSize: "13px", color: "#6B7280" }}>
            {typeLabel[document.type]} · Updated{" "}
            {new Date(document.updated_at).toLocaleDateString()}
          </div>
          {document.tags?.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    borderRadius: "999px",
                    backgroundColor: "#EFF6FF",
                    color: "#003C78",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
        <span style={getStatusChipStyle(isArchived)}>
          {statusLabel[document.status] ?? document.status}
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              onClick={() => onExport(document, format)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "1px solid var(--color-border-default)",
                borderRadius: "8px",
                padding: "8px 10px",
                cursor: "pointer",
                color: "#046A97",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <Download size={15} /> {exportFormatLabels[format]}
            </button>
          ))}

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
      </div>
    </div>
  );
}
