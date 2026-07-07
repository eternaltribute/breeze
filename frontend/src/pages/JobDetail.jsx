// src/pages/JobDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// S2-005  Job Card to Job Detail Expansion Pattern
//           — every card navigates here via /jobs/:id
// S2-006  Job Detail Overview Section
//           — editable panel for core job fields (company, title, body, stage,
//             location, salary, url, notes)
// S2-007  Job Deadline and Recruiter/Contact Notes Fields
//           — separate editable section for deadline + recruiter notes
// S2-011  Interview Tracking in Job Detail
//           — when the user moves the stage INTO "Interview" (and was not
//             already in Interview), the Stage dropdown temporarily swaps
//             into a "which round?" button picker (1st–5th). Leaving
//             Interview (Interview -> Offer/Rejected) is unaffected and
//             behaves exactly like every other stage change.
//
// Business rules satisfied:
//   S2-BR-001  job must include company, title, and full job posting body
//   S2-BR-003  job posting body must be editable after creation
//   S2-BR-004  canonical stages are the six defined in STAGES constant
//   S2-BR-009  stage transitions must persist timestamped history
//   S2-BR-010  a job may have multiple interview entries while in Interview stage
//   S2-BR-011  interview entries require round type, date/time, and notes
//   S2-BR-013  timeline must reflect stage changes (stage shown in overview)
//   S2-BR-017  section-level save must return clear field-level validation errors
//
// Layout (per UX standards doc):
//   Page title + Back button    ← top left
//   Two-column panels below:
//     Left  — Overview (S2-006)
//     Right — Deadline + Recruiter Notes (S2-007)
//
// TODO (Ronald): backend Job model needs two new fields for S2-007 to fully
//   persist:
//     deadline: Optional[str]          (ISO date string "YYYY-MM-DD")
//     recruiter_notes: Optional[str]   (free text)
//   The PUT /jobs/:id endpoint already accepts extra fields via JobUpdate,
//   so once the model and migration are added, this frontend will work as-is.
//
// Interview round progression is handled through PATCH /jobs/:id/stage with
// `interview_round` and notes. The backend stores the current round and writes
// an "interview" timeline event each time the user moves forward.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ChevronDown, ChevronUp, Search, Sparkles } from "lucide-react";

const BASE = import.meta.env.VITE_API_BASE_URL;

// ── Canonical stages (S2-BR-004) ─────────────────────────────────────────────
const STAGES = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"];

// ── Interview round labels — used by the round picker (S2-011) ───────────────
const INTERVIEW_ROUNDS = [
  { value: 1, label: "1st Round" },
  { value: 2, label: "2nd Round" },
  { value: 3, label: "3rd Round" },
  { value: 4, label: "4th Round" },
  { value: 5, label: "5th Round" },
];

// ── Stage pill color — same function as Dashboard so colors stay consistent ──
const stageColor = (stage) => {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  if (stage === "Rejected") return "#DC2626";
  if (stage === "Archived") return "#6B7280";
  return "#9CA3AF";
};

// ── normalizeStage — converts backend lowercase to display title-case ─────────
const normalizeStage = (stage) => {
  const map = {
    interested: "Interested",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    archived: "Archived",
  };
  return map[stage?.toLowerCase()] || "Interested";
};

const formatLocalDateTime = (value) => {
  if (!value) return "";
  const normalizedValue =
    typeof value === "string" && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

// ── fromApi — converts raw API job to the shape this page needs ───────────────
function fromApi(data) {
  return {
    id: data.id,
    company: data.company ?? "",
    title: data.title ?? "",
    jobPostingBody: data.job_posting_body ?? "",
    stage: normalizeStage(data.stage),
    location: data.location ?? "",
    jobUrl: data.job_url ?? "",
    salaryRange: data.salary_range ?? "",
    notes: data.notes ?? "",
    // S2-007 fields — will be empty string until Ronald adds them to the model
    deadline: data.deadline ?? "",
    recruiterNotes: data.recruiter_notes ?? "",
    // S2-011 — will be null until Ronald adds interview_round to the model
    interviewRound: data.interview_round ?? null,
    lastActivity: data.updated_at ?? data.created_at ?? "",
    createdAt: data.created_at ?? "",
  };
}

// ── Shared card panel style ───────────────────────────────────────────────────
const panelStyle = {
  backgroundColor: "var(--bg-card, #fff)",
  border: "1px solid var(--color-border-default, #e5e7eb)",
  borderRadius: "12px",
  padding: "28px",
  boxShadow: "var(--shadow)",
};

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-default, #e5e7eb)",
  backgroundColor: "var(--bg, #F8FAFC)",
  color: "var(--color-heading, #003C78)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

// ── FieldError — small red error message shown under invalid fields ───────────
// Used to satisfy S2-BR-017 (clear field-level validation errors)
function FieldError({ message }) {
  if (!message) return null;
  return <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#DC2626" }}>{message}</p>;
}

// ── Label — consistent field label above inputs ───────────────────────────────
function Label({ text, required }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--color-heading, #003C78)",
        marginBottom: "6px",
      }}
    >
      {text}
      {/* S2-BR-001: required fields marked with * per UX standards */}
      {required && <span style={{ color: "#DC2626", marginLeft: "2px" }}>*</span>}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OutcomeSection — S2-013
// Shows a notes field to record the final outcome of a job application.
// Only rendered when stage is Offer, Rejected, or Archived (S2-BR-004/005).
// Calls POST /jobs/{job_id}/outcome to persist the notes.
// ─────────────────────────────────────────────────────────────────────────────
function OutcomeSection({ jobId, getToken }) {
  const [outcomeNotes, setOutcomeNotes] = useState(""); // the outcome notes text
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Save outcome notes to backend
  // POST /jobs/{job_id}/outcome — Ronald's endpoint
  const handleSave = async () => {
    if (!outcomeNotes.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/jobs/${jobId}/outcome`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: outcomeNotes.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Outcome save failed:", err);
      setError("Could not save outcome. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        ...panelStyle,
        border: "2px solid #22c55e",
        boxShadow: "0 12px 28px rgba(34, 197, 94, 0.16)",
        backgroundColor: "#F0FDF4",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-heading, #003C78)",
            margin: 0,
          }}
        >
          Outcome
        </h2>
        <span
          style={{
            backgroundColor: "#22c55e",
            color: "white",
            borderRadius: "999px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Active
        </span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)", marginBottom: "16px" }}>
        Record the final outcome of this application.
      </p>

      {/* Outcome notes textarea */}
      <textarea
        value={outcomeNotes}
        onChange={(e) => setOutcomeNotes(e.target.value)}
        rows={4}
        aria-label="Outcome notes"
        placeholder="e.g. Received offer for $95k, negotiating start date… or Rejected after final round."
        style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5", marginBottom: "12px" }}
      />

      {/* Error message */}
      {error && <p style={{ fontSize: "12px", color: "#DC2626", marginBottom: "8px" }}>{error}</p>}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !outcomeNotes.trim()}
        style={{
          backgroundColor: saving || !outcomeNotes.trim() ? "#9ca3af" : "#003C78",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: saving || !outcomeNotes.trim() ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {saving ? "Saving…" : "Save Outcome"}
      </button>

      {/* Success flash */}
      {saved && (
        <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 500, marginTop: "8px" }}>
          ✓ Outcome saved!
        </p>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ArchiveRestoreSection — S2-014
// Archive button when job is active, Restore button + stage dropdown when archived.
// Calls POST /jobs/{job_id}/archive and POST /jobs/{job_id}/restore
// ─────────────────────────────────────────────────────────────────────────────
function ArchiveRestoreSection({ jobId, stage, getToken, onStageChange }) {
  const isArchived = stage === "Archived";
  const [restoreStage, setRestoreStage] = useState("Interested");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stages you can restore to — everything except Archived
  const restoreOptions = ["Interested", "Applied", "Interview", "Offer", "Rejected"];

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/jobs/${jobId}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Archive failed");
      onStageChange("Archived"); // update the stage pill + trigger outcome section
    } catch (err) {
      console.error("Archive failed:", err);
      setError("Could not archive. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/jobs/${jobId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ restore_to: restoreStage.toLowerCase() }),
      });
      if (!res.ok) throw new Error("Restore failed");
      onStageChange(restoreStage); // update stage pill back to chosen stage
    } catch (err) {
      console.error("Restore failed:", err);
      setError("Could not restore. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={panelStyle}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        {isArchived ? "Restore Job" : "Archive Job"}
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)", marginBottom: "16px" }}>
        {isArchived
          ? "Pick a stage to restore this job to."
          : "Archive this job to hide it from your active board."}
      </p>

      {/* Restore stage dropdown — only shown when archived */}
      {isArchived && (
        <div style={{ marginBottom: "12px" }}>
          <Label text="Restore to stage" />
          <select
            value={restoreStage}
            onChange={(e) => setRestoreStage(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {restoreOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error message */}
      {error && <p style={{ fontSize: "12px", color: "#DC2626", marginBottom: "8px" }}>{error}</p>}

      {/* Archive or Restore button */}
      <button
        onClick={isArchived ? handleRestore : handleArchive}
        disabled={loading}
        style={{
          backgroundColor: loading ? "#9ca3af" : isArchived ? "#046A97" : "#6B7280",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {loading ? "Please wait…" : isArchived ? `Restore to ${restoreStage}` : "Archive Job"}
      </button>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// FollowUpSection — S2-012
// (Unchanged from before — included here only because it lives in this file.)
// ─────────────────────────────────────────────────────────────────────────────
function FollowUpSection({ jobId, getToken, onCreated }) {
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [followUps, setFollowUps] = useState([]);
  const activeFollowUps = followUps.filter((item) => !item.follow_up_completed);
  const completedFollowUps = followUps.filter((item) => item.follow_up_completed);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteFollowUp = async (eventId) => {
    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${jobId}/follow-ups/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Follow-up delete failed");

      await loadFollowUps();
      onCreated?.();
    } catch (err) {
      console.error("Follow-up delete failed:", err);
      setError("Could not delete follow-up. Please try again.");
    }
  };

  const loadFollowUps = useCallback(async () => {
    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${jobId}/follow-ups`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Follow-up load failed");

      const data = await res.json();
      setFollowUps(data);
    } catch (err) {
      console.error("Follow-up load failed:", err);
    }
  }, [getToken, jobId]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const handleToggleComplete = async (eventId, completed) => {
    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${jobId}/follow-ups/${eventId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          follow_up_completed: completed,
        }),
      });

      if (!res.ok) throw new Error("Follow-up update failed");

      await loadFollowUps();
      onCreated?.();
    } catch (err) {
      console.error("Follow-up update failed:", err);
      setError("Could not update follow-up. Please try again.");
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!dueDate) {
      setError("Choose when you want to be reminded.");
      return;
    }

    setSaving(true);

    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${jobId}/follow-ups`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          follow_up_due_date: dueDate,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Follow-up save failed");

      await loadFollowUps();
      onCreated?.();

      setDueDate("");
      setNotes("");
      setSaved(true);
      onCreated?.();

      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Follow-up save failed:", err);
      setError("Could not save follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={panelStyle}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        Follow-up Reminder
      </h2>

      <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)", marginBottom: "16px" }}>
        Create a reminder tied to this job.
      </p>

      <div style={{ marginBottom: "16px" }}>
        <Label text="Remind me on" required />
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <Label text="Follow-up Notes" />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
          placeholder="e.g. Email recruiter, send thank-you note, check application status..."
        />
      </div>

      {error && <p style={{ fontSize: "12px", color: "#DC2626", marginBottom: "8px" }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: saving ? "#9ca3af" : "#003C78",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {saving ? "Saving..." : "Create Follow-up"}
      </button>

      {activeFollowUps.length > 0 && (
        <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--color-heading, #003C78)",
            }}
          >
            Active follow-ups
          </p>

          {activeFollowUps.map((item) => (
            <label
              key={item.id}
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-default, #e5e7eb)",
                backgroundColor: "var(--bg, #F8FAFC)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => handleToggleComplete(item.id, true)}
                style={{ marginTop: "3px" }}
              />

              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-heading, #003C78)",
                  }}
                >
                  {new Date(item.follow_up_due_date).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>

                {item.notes && (
                  <span
                    style={{
                      display: "block",
                      marginTop: "2px",
                      fontSize: "12px",
                      color: "var(--color-subtext, #6b7280)",
                    }}
                  >
                    {item.notes}
                  </span>
                )}
              </span>
              {confirmDeleteId === item.id ? (
                <span
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteFollowUp(item.id);
                      setConfirmDeleteId(null);
                    }}
                    style={{
                      border: "none",
                      backgroundColor: "#DC2626",
                      color: "white",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Yes
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                    style={{
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      backgroundColor: "white",
                      color: "var(--color-subtext, #6b7280)",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Delete reminder"
                  title="Delete reminder"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDeleteId(item.id);
                  }}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    border: "1px solid #FCA5A5",
                    backgroundColor: "#FEF2F2",
                    color: "#DC2626",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </label>
          ))}
        </div>
      )}

      {completedFollowUps.length > 0 && (
        <details style={{ marginTop: "16px" }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--color-subtext, #6b7280)",
            }}
          >
            Completed follow-ups ({completedFollowUps.length})
          </summary>

          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {completedFollowUps.map((item) => (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default, #e5e7eb)",
                  backgroundColor: "#F0FDF4",
                  cursor: "pointer",
                  opacity: 0.8,
                }}
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => handleToggleComplete(item.id, false)}
                  style={{ marginTop: "3px" }}
                />

                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--color-heading, #003C78)",
                      textDecoration: "line-through",
                    }}
                  >
                    {new Date(item.follow_up_due_date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>

                  {item.notes && (
                    <span
                      style={{
                        display: "block",
                        marginTop: "2px",
                        fontSize: "12px",
                        color: "var(--color-subtext, #6b7280)",
                        textDecoration: "line-through",
                      }}
                    >
                      {item.notes}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </details>
      )}

      {saved && (
        <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 500, marginTop: "8px" }}>
          Follow-up saved!
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TimelineSection — S2-010
// Fetches and displays job activity events in chronological order.
// Each event has: event_type, title, detail, timestamp
// Calls GET /jobs/{job_id}/timeline — Ronald's endpoint
// ─────────────────────────────────────────────────────────────────────────────
function TimelineSection({ jobId, getToken, refreshKey }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? events : events.slice(-5);
  const hiddenCount = Math.max(events.length - visibleEvents.length, 0);

  // Fetch timeline events on mount
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs/${jobId}/timeline`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load timeline");
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        console.error("Timeline fetch failed:", err);
        setError("Could not load timeline.");
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [jobId, getToken, refreshKey]);

  // Pick a color dot per event type
  const dotColor = (type) => {
    if (type === "stage_change") return "#046A97";
    if (type === "interview") return "#FF6138";
    if (type === "outcome") return "#22c55e";
    if (type === "document") return "#166534";
    return "#9ca3af";
  };

  return (
    <div style={{ ...panelStyle, marginTop: "24px" }}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "20px",
        }}
      >
        Activity Timeline
      </h2>

      {/* Loading state */}
      {loading && (
        <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)" }}>
          Loading timeline...
        </p>
      )}

      {/* Error state */}
      {error && <p style={{ fontSize: "13px", color: "#DC2626" }}>{error}</p>}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)" }}>
          No activity recorded yet.
        </p>
      )}

      {/* Timeline list — latest five are shown by default so the page stays compact */}
      {visibleEvents.map((event, i) => (
        <div key={event.id || i} style={{ display: "flex", gap: "14px", marginBottom: "20px" }}>
          {/* Left: colored dot + vertical line */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: dotColor(event.event_type),
                flexShrink: 0,
                marginTop: "4px",
              }}
            />
            {/* Vertical line connecting dots — hidden on last item */}
            {i < visibleEvents.length - 1 && (
              <div
                style={{
                  width: "2px",
                  flex: 1,
                  marginTop: "4px",
                  backgroundColor: "var(--color-border-default, #e5e7eb)",
                }}
              />
            )}
          </div>

          {/* Right: event content */}
          <div style={{ paddingBottom: "4px" }}>
            <p
              style={{
                margin: "0 0 2px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-heading, #003C78)",
              }}
            >
              {event.title}
            </p>
            {event.detail && (
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "12px",
                  color: "var(--color-subtext, #6b7280)",
                }}
              >
                {event.detail}
              </p>
            )}
            <p style={{ margin: 0, fontSize: "11px", color: "var(--color-subtext, #9ca3af)" }}>
              {formatLocalDateTime(event.timestamp)}
            </p>
          </div>
        </div>
      ))}

      {!loading && !error && events.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            borderRadius: "8px",
            backgroundColor: "white",
            color: "var(--color-heading, #003C78)",
            fontSize: "12px",
            fontWeight: 700,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showAll ? "Show less activity" : `Show ${hiddenCount} older item${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JobDetail — main page component
// ─────────────────────────────────────────────────────────────────────────────
const RESEARCH_TOPICS = [
  "Company overview",
  "Culture",
  "Products",
  "Interview prep",
  "Recent news",
];

// S3-011: Company research prompt UX in job detail.
// Backend-ready contract for the future AI endpoint:
// POST /jobs/:jobId/company-research
// Body: {
//   company, title, location, job_posting_body,
//   topics: string[],
//   user_context: string
// }
// Expected response: { research_text: string, updated_at?: string }
// S3-012 can persist and render research_text as editable job notes.
function CompanyResearchSection({ jobId, company, title, location, jobPostingBody }) {
  const [selectedTopics, setSelectedTopics] = useState(["Company overview", "Interview prep"]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const toggleTopic = (topic) => {
    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]
    );
  };

  const handleGenerate = () => {
    setError("");
    setStatusMessage("");

    if (!company.trim() && !context.trim()) {
      setError("Add a company name or research context first.");
      return;
    }

    setGenerating(true);

    const payload = {
      job_id: jobId,
      company,
      title,
      location,
      job_posting_body: jobPostingBody,
      topics: selectedTopics,
      user_context: context.trim(),
    };

    console.info("Company research request prepared for backend:", payload);

    // TODO (S3-011 backend): replace this timeout with the real AI request.
    // Add getToken to this component's props when the backend endpoint is ready.
    // const token = await getToken({ skipCache: true });
    // const res = await fetch(`${BASE}/jobs/${jobId}/company-research`, {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${token}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });
    // const data = await res.json();
    // Render data.research_text here or hand it to the S3-012 notes section.
    window.setTimeout(() => {
      setStatusMessage(
        "Research request prepared. AI generation will appear here when the backend is connected."
      );
      setGenerating(false);
    }, 350);
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Search size={18} color="var(--color-heading, #003C78)" aria-hidden="true" />
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-heading, #003C78)",
            margin: 0,
          }}
        >
          Company Research
        </h2>
      </div>

      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", marginTop: 0 }}>
        Choose research areas and add any context you want AI to consider.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        {RESEARCH_TOPICS.map((topic) => {
          const selected = selectedTopics.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              style={{
                borderRadius: "999px",
                border: selected ? "1px solid #003C78" : "1px solid var(--color-border-default)",
                backgroundColor: selected ? "#EFF6FF" : "transparent",
                color: selected ? "#003C78" : "var(--color-subtext, #6b7280)",
                padding: "7px 10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {topic}
            </button>
          );
        })}
      </div>

      <Label text="Research Context" />
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={4}
        style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
        placeholder="Example: Focus on culture, recent product launches, and questions I can ask in a frontend interview."
      />

      {error && <p style={{ color: "#DC2626", fontSize: "13px", margin: "8px 0 0" }}>{error}</p>}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        style={{
          marginTop: "14px",
          width: "100%",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: generating ? "#9CA3AF" : "#003C78",
          color: "white",
          fontSize: "14px",
          fontWeight: 700,
          cursor: generating ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <Sparkles size={16} aria-hidden="true" />
        {generating ? "Preparing..." : "Prepare Research Request"}
      </button>

      {statusMessage && (
        <div
          style={{
            marginTop: "16px",
            border: "1px solid #BBF7D0",
            borderRadius: "8px",
            backgroundColor: "#F0FDF4",
            padding: "12px",
            color: "#166534",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

function InterviewProgressSection({
  currentRound,
  notes,
  error,
  saving,
  onNotesChange,
  onAdvance,
}) {
  const nextRound = currentRound ? currentRound + 1 : 1;
  const nextRoundMeta = INTERVIEW_ROUNDS.find((round) => round.value === nextRound);

  return (
    <div
      style={{
        ...panelStyle,
        border: "2px solid #FF6138",
        boxShadow: "0 12px 28px rgba(255, 97, 56, 0.18)",
        backgroundColor: "#FFF7ED",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--color-heading, #003C78)",
            margin: 0,
          }}
        >
          Interview Progress
        </h2>
        <span
          style={{
            backgroundColor: "#FF6138",
            color: "white",
            borderRadius: "999px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Active
        </span>
      </div>

      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", marginTop: 0 }}>
        Move through interview rounds in order and add notes before advancing.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        {INTERVIEW_ROUNDS.map((round) => {
          const isCurrent = currentRound === round.value;
          const isComplete = currentRound && round.value < currentRound;
          const isNext = round.value === nextRound;
          return (
            <button
              key={round.value}
              type="button"
              disabled={!isNext || saving}
              onClick={() => onAdvance(nextRound)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: isCurrent
                  ? "2px solid #003C78"
                  : "1px solid var(--color-border-default, #e5e7eb)",
                backgroundColor: isCurrent ? "#003C78" : isComplete ? "#F0FDF4" : "white",
                color: isCurrent
                  ? "white"
                  : isComplete
                    ? "#166534"
                    : isNext
                      ? "var(--color-heading, #003C78)"
                      : "var(--color-subtext, #9ca3af)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isNext && !saving ? "pointer" : "not-allowed",
                opacity: !isNext && !isCurrent && !isComplete ? 0.6 : 1,
              }}
            >
              {round.label}
            </button>
          );
        })}
      </div>

      <p style={{ color: "var(--color-heading, #003C78)", fontSize: "13px", fontWeight: 700 }}>
        {currentRound
          ? `Current round: ${INTERVIEW_ROUNDS.find((round) => round.value === currentRound)?.label}`
          : "No interview round selected yet."}
      </p>

      {nextRoundMeta ? (
        <>
          <Label text={`Notes before moving to ${nextRoundMeta.label}`} required />
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            placeholder="Add prep notes, interviewer details, feedback, or what changed before moving forward."
          />
          {error && (
            <p style={{ color: "#DC2626", fontSize: "13px", margin: "8px 0 0" }}>{error}</p>
          )}
          <button
            type="button"
            onClick={() => onAdvance(nextRound)}
            disabled={saving}
            style={{
              marginTop: "14px",
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: saving ? "#9CA3AF" : "#003C78",
              color: "white",
              fontSize: "14px",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : `Move to ${nextRoundMeta.label}`}
          </button>
        </>
      ) : (
        <p style={{ color: "#166534", fontSize: "13px", fontWeight: 700, marginBottom: 0 }}>
          All interview rounds are complete.
        </p>
      )}
    </div>
  );
}

// Shows whether a resume has been saved for this job.
function ResumeStatusSection({ jobId, getToken, onOpenHelper }) {
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResume = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/resume/job/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 404) {
          setResume(null);
          return;
        }

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to load resume");

        setResume(data);
      } catch (err) {
        console.error("Failed to load resume status:", err);
        setError("Could not check resume status.");
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, [jobId, getToken]);

  const hasResume = Boolean(resume?.resume_text?.trim() || resume?.file_url);
  const preview = resume?.resume_text?.trim()
    ? resume.resume_text.trim().replace(/\s+/g, " ").slice(0, 120)
    : resume?.file_name || "";

  return (
    <div style={panelStyle}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        Resume
      </h2>

      {loading ? (
        <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
          Checking saved resume...
        </p>
      ) : error ? (
        <p style={{ color: "#DC2626", fontSize: "13px", margin: 0 }}>{error}</p>
      ) : hasResume ? (
        <>
          <div
            style={{
              border: "1px solid #BBF7D0",
              backgroundColor: "#F0FDF4",
              color: "#166534",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "12px",
            }}
          >
            Saved resume found
          </div>
          {preview && (
            <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
              {preview}
              {resume?.resume_text?.length > 120 ? "..." : ""}
            </p>
          )}
        </>
      ) : (
        <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
          No resume has been saved to this job yet.
        </p>
      )}

      <button
        onClick={onOpenHelper}
        style={{
          marginTop: "14px",
          width: "100%",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid var(--color-border-default, #e5e7eb)",
          backgroundColor: "transparent",
          color: "var(--color-heading, #003C78)",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Open Resume Helper
      </button>
    </div>
  );
}

// Shows whether a cover letter draft has been saved for this job.
function CoverLetterStatusSection({ jobId, getToken, onOpenHelper }) {
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCoverLetter = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/cover-letter/job/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 404) {
          setCoverLetter(null);
          return;
        }

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to load cover letter");

        setCoverLetter(data);
      } catch (err) {
        console.error("Failed to load cover letter status:", err);
        setError("Could not check cover letter status.");
      } finally {
        setLoading(false);
      }
    };

    fetchCoverLetter();
  }, [jobId, getToken]);

  const hasDraft = Boolean(coverLetter?.cover_letter_text?.trim());
  const preview = hasDraft
    ? coverLetter.cover_letter_text.trim().replace(/\s+/g, " ").slice(0, 120)
    : "";

  return (
    <div style={panelStyle}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "8px",
        }}
      >
        Cover Letter
      </h2>

      {loading ? (
        <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
          Checking saved draft...
        </p>
      ) : error ? (
        <p style={{ color: "#DC2626", fontSize: "13px", margin: 0 }}>{error}</p>
      ) : hasDraft ? (
        <>
          <div
            style={{
              border: "1px solid #BBF7D0",
              backgroundColor: "#F0FDF4",
              color: "#166534",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "12px",
            }}
          >
            Saved draft found
          </div>
          <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
            {preview}
            {coverLetter.cover_letter_text.length > 120 ? "..." : ""}
          </p>
        </>
      ) : (
        <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", margin: 0 }}>
          No cover letter draft has been saved to this job yet.
        </p>
      )}

      <button
        onClick={onOpenHelper}
        style={{
          marginTop: "14px",
          width: "100%",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid var(--color-border-default, #e5e7eb)",
          backgroundColor: "transparent",
          color: "var(--color-heading, #003C78)",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Open Cover Letter Helper
      </button>
    </div>
  );
}

function JobDetail() {
  const { id } = useParams(); // job id from the URL /jobs/:id
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // ── Page-level state ───────────────────────────────────────────────────────
  const [job, setJob] = useState(null); // raw job data from API
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null); // error loading the job

  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  // ── Overview section state (S2-006) ───────────────────────────────────────
  // Each field mirrors a Job model field
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jobPostingBody, setJobPostingBody] = useState("");
  const [stage, setStage] = useState("Interested");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [notes, setNotes] = useState("");

  // Job detail save state
  const [jobDetailSaving, setJobDetailSaving] = useState(false);
  const [jobDetailSaved, setJobDetailSaved] = useState(false);
  const [jobDetailSaveError, setJobDetailSaveError] = useState("");
  const [overviewErrors, setOverviewErrors] = useState({}); // field-level errors (S2-BR-017)

  // ── S2-011: Interview round tracker ─────────────────────────────────────
  // Unlike a popup, this does NOT control whether the picker is shown.
  // The picker is shown any time stage === "Interview" (see render below).
  // This only tracks WHICH round button is currently highlighted.
  const [interviewRound, setInterviewRound] = useState(null);
  const [interviewRoundNotes, setInterviewRoundNotes] = useState("");
  const [interviewRoundSaving, setInterviewRoundSaving] = useState(false);
  const [interviewRoundError, setInterviewRoundError] = useState("");

  // ── Deadline + Recruiter Notes section state (S2-007) ─────────────────────
  const [deadline, setDeadline] = useState("");
  const [recruiterNotes, setRecruiterNotes] = useState("");

  // Deadline/recruiter validation state
  const [detailErrors, setDetailErrors] = useState({});

  // ── Fetch job on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchJob = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Job not found");

        const data = await res.json();
        const mapped = fromApi(data);

        // Store the raw job and populate all form fields
        setJob(mapped);
        setCompany(mapped.company);
        setTitle(mapped.title);
        setJobPostingBody(mapped.jobPostingBody);
        setStage(mapped.stage);
        setLocation(mapped.location);
        setJobUrl(mapped.jobUrl);
        setSalaryRange(mapped.salaryRange);
        setNotes(mapped.notes);
        setDeadline(mapped.deadline);
        setRecruiterNotes(mapped.recruiterNotes);
        setInterviewRound(mapped.interviewRound);
      } catch (err) {
        console.error("Failed to fetch job:", err);
        setPageError("Could not load this job. It may have been deleted.");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, getToken]);

  // ── validateOverview — checks required fields before saving (S2-BR-001) ────
  // Returns an errors object: { fieldName: "error message" }
  // Empty object means valid.
  const validateOverview = () => {
    const errors = {};
    if (!company.trim()) errors.company = "Company is required.";
    if (!title.trim()) errors.title = "Job title is required.";
    if (!jobPostingBody.trim()) errors.jobPostingBody = "Job posting body is required.";
    return errors;
  };

  // ── handleJobDetailSave — saves editable job detail fields together ──────
  const handleJobDetailSave = async () => {
    const overviewValidationErrors = validateOverview();
    const detailValidationErrors = {};

    // Validate deadline format if provided - must be a valid date
    if (deadline && isNaN(Date.parse(deadline))) {
      detailValidationErrors.deadline = "Please enter a valid date.";
    }

    setOverviewErrors(overviewValidationErrors);
    setDetailErrors(detailValidationErrors);
    setJobDetailSaveError("");

    if (
      Object.keys(overviewValidationErrors).length > 0 ||
      Object.keys(detailValidationErrors).length > 0
    ) {
      return;
    }

    setJobDetailSaving(true);

    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/jobs/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: company.trim(),
          title: title.trim(),
          job_posting_body: jobPostingBody.trim(), // backend uses snake_case
          //stage: stage.toLowerCase(), // backend stores lowercase
          location: location.trim() || null,
          job_url: jobUrl.trim() || null,
          salary_range: salaryRange.trim() || null,
          notes: notes.trim() || null,
          // TODO (Ronald): add deadline and recruiter_notes to JobUpdate model
          // and Job SQLModel table. Until then this PUT may silently ignore them.
          deadline: deadline || null,
          recruiter_notes: recruiterNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Save failed");
      }

      setJobDetailSaved(true);
      setTimeout(() => setJobDetailSaved(false), 2000);
    } catch (err) {
      console.error("Job detail save failed:", err);
      setJobDetailSaveError("Save failed. Please try again.");
    } finally {
      setJobDetailSaving(false);
    }
  };

  // ── handleStageChange — calls PATCH /jobs/:id/stage (S2-008) ─────────────
  // Plain stage change — round progression is handled separately by the
  // Interview Progress panel shown while stage === "Interview".
  const handleStageChange = async (newStage) => {
    if (newStage.toLowerCase() === stage.toLowerCase()) return;

    try {
      const token = await getToken({ skipCache: true });

      const body = {
        new_stage: newStage.toLowerCase(),
        confirm_override: false,
      };

      const res = await fetch(`${BASE}/jobs/${id}/stage`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const confirmed = window.confirm(
          `Moving to "${newStage}" is not a standard forward transition. Are you sure?`
        );
        if (!confirmed) return;

        const retryRes = await fetch(`${BASE}/jobs/${id}/stage`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, confirm_override: true }),
        });

        if (!retryRes.ok) throw new Error("Stage update failed");
        setStage(newStage);
        // Leaving Interview clears the round highlight so it doesn't show
        // a stale round if the job re-enters Interview again later.
        if (newStage !== "Interview") {
          setInterviewRound(null);
          setInterviewRoundNotes("");
          setInterviewRoundError("");
        }
        setTimelineRefreshKey((k) => k + 1);
        return;
      }

      if (!res.ok) throw new Error("Stage update failed");

      setStage(newStage);
      if (newStage !== "Interview") {
        setInterviewRound(null);
        setInterviewRoundNotes("");
        setInterviewRoundError("");
      }
      setTimelineRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Stage change failed:", err);
      alert("Failed to update stage. Please try again.");
    }
  };

  const handleInterviewRoundAdvance = async (round) => {
    setInterviewRoundError("");

    const nextRound = interviewRound ? interviewRound + 1 : 1;
    if (round !== nextRound) {
      setInterviewRoundError("Interview rounds can only move forward one step at a time.");
      return;
    }

    if (!interviewRoundNotes.trim()) {
      setInterviewRoundError("Add notes before moving to the next interview round.");
      return;
    }

    const previousRound = interviewRound;
    setInterviewRound(round);
    setInterviewRoundSaving(true);

    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${id}/stage`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_stage: "interview",
          confirm_override: true, // same-stage update, not a real transition
          interview_round: round,
          notes: interviewRoundNotes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Round update failed");
      }

      setInterviewRoundNotes("");
      setTimelineRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Round update failed:", err);
      setInterviewRound(previousRound);
      setInterviewRoundError(err.message || "Failed to update interview round. Please try again.");
    } finally {
      setInterviewRoundSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: "40px 60px",
          color: "var(--color-subtext, #6b7280)",
          fontSize: "14px",
        }}
      >
        Loading job details...
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (pageError || !job) {
    return (
      <div style={{ padding: "40px 60px" }}>
        <p style={{ color: "#DC2626" }}>{pageError || "Job not found."}</p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "transparent",
            cursor: "pointer",
            color: "var(--color-heading, #003C78)",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  const isFinalStage = ["Offer", "Rejected", "Archived"].includes(stage);

  return (
    <div
      style={{
        backgroundColor: "var(--bg, #F8FAFC)",
        minHeight: "100vh",
        padding: "40px 60px",
        maxWidth: "1100px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ── Page header ────────────────────────────────────────────────────── */}
      {/* Back button — lets user return to dashboard without losing context */}
      <button
        onClick={() => navigate("/dashboard")}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-subtext, #6b7280)",
          fontSize: "13px",
          cursor: "pointer",
          padding: 0,
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        ← Back to Dashboard
      </button>

      {/* Job title + company as page heading */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "8px",
        }}
      >
        <div>
          <h1
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "32px",
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {job.title}
          </h1>
          <p
            style={{ color: "var(--color-subtext, #6b7280)", margin: "4px 0 0", fontSize: "16px" }}
          >
            {job.company}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: "4px",
          }}
        >
          {/* Stage pill — read-only display, editable in the Overview panel below */}
          <span
            style={{
              backgroundColor: stageColor(stage),
              color: "white",
              borderRadius: "999px",
              padding: "6px 18px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {stage}
          </span>
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "-18px",
          marginBottom: "28px",
        }}
      >
        {jobDetailSaveError && (
          <span style={{ fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>
            {jobDetailSaveError}
          </span>
        )}

        {jobDetailSaved && (
          <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>
            Job detail saved!
          </span>
        )}

        <button
          type="button"
          onClick={handleJobDetailSave}
          disabled={jobDetailSaving}
          style={{
            backgroundColor: "#003C78",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: jobDetailSaving ? "not-allowed" : "pointer",
            opacity: jobDetailSaving ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {jobDetailSaving ? "Saving..." : "Save Job Detail"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px", // main panel + narrower side panel
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* ── LEFT: Overview panel + Timeline (S2-006, S2-010) ─────────── */}
        <div>
          <div style={panelStyle}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-heading, #003C78)",
                marginTop: 0,
                marginBottom: "24px",
              }}
            >
              Overview
            </h2>

            {/* General save error */}
            {overviewErrors.general && (
              <p style={{ color: "#DC2626", fontSize: "13px", marginBottom: "16px" }}>
                {overviewErrors.general}
              </p>
            )}

            {/* Company — required (S2-BR-001) */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Company" required />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Google"
              />
              <FieldError message={overviewErrors.company} />
            </div>

            {/* Job Title — required (S2-BR-001) */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Job Title" required />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Frontend Engineer"
              />
              <FieldError message={overviewErrors.title} />
            </div>

            {/* ── Stage — dropdown is always a dropdown (S2-BR-004) ───────── */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Stage" required />

              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Location — optional */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Location" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={inputStyle}
                placeholder="e.g. New York, NY or Remote"
              />
            </div>

            {/* Job URL — optional */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Job Posting URL" />
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                style={inputStyle}
                placeholder="https://..."
              />
            </div>

            {/* Salary Range — optional */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Salary Range" />
              <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                style={inputStyle}
                placeholder="e.g. $80,000 – $100,000"
              />
            </div>

            {/* Job Posting Body — required, editable (S2-BR-001, S2-BR-003) */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Job Posting Body" required />
              <textarea
                value={jobPostingBody}
                onChange={(e) => setJobPostingBody(e.target.value)}
                rows={8}
                style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
                placeholder="Paste the full job description here…"
              />
              <FieldError message={overviewErrors.jobPostingBody} />
            </div>

            {/* General Notes — optional */}
            <div style={{ marginBottom: "24px" }}>
              <Label text="Notes" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
                placeholder="Any personal notes about this application…"
              />
            </div>
          </div>

          {/* ── S2-010: Activity Timeline ──────────────────────────────── */}
          <TimelineSection jobId={id} getToken={getToken} refreshKey={timelineRefreshKey} />
        </div>

        {/* ── RIGHT: Deadline + Recruiter Notes panel (S2-007) ─────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={panelStyle}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-heading, #003C78)",
                marginTop: 0,
                marginBottom: "24px",
              }}
            >
              Deadline & Contact
            </h2>

            {/* Deadline — optional date field (S2-007) */}
            <div style={{ marginBottom: "16px" }}>
              <Label text="Application Deadline" />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={inputStyle}
              />
              <FieldError message={detailErrors.deadline} />
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-subtext, #6b7280)",
                  marginTop: "4px",
                }}
              >
                Optional — helps with the deadline filter on the dashboard.
              </p>
            </div>

            {/* Recruiter / Contact Notes — optional (S2-007) */}
            <div style={{ marginBottom: "24px" }}>
              <Label text="Recruiter / Contact Notes" />
              <textarea
                value={recruiterNotes}
                onChange={(e) => setRecruiterNotes(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
                placeholder="Recruiter name, email, LinkedIn, phone, notes from calls…"
              />
            </div>
          </div>
          {!isFinalStage && stage === "Interview" && (
            <InterviewProgressSection
              currentRound={interviewRound}
              notes={interviewRoundNotes}
              error={interviewRoundError}
              saving={interviewRoundSaving}
              onNotesChange={setInterviewRoundNotes}
              onAdvance={handleInterviewRoundAdvance}
            />
          )}
          {!isFinalStage && (
            <>
              <CompanyResearchSection
                jobId={id}
                company={company}
                title={title}
                location={location}
                jobPostingBody={jobPostingBody}
              />
              <FollowUpSection
                jobId={id}
                getToken={getToken}
                onCreated={() => setTimelineRefreshKey((key) => key + 1)}
              />
            </>
          )}
          {/* ── S2-013: Outcome Section ───────────────────────────────────── */}
          {/* Only shown when job is in a final stage: Offer, Rejected, Archived */}
          {/* Analogy: like a "case closed" notes field — only available at the end */}
          {isFinalStage && <OutcomeSection jobId={id} getToken={getToken} />}

          <ResumeStatusSection
            jobId={id}
            getToken={getToken}
            onOpenHelper={() => navigate("/resume-helper")}
          />
          <CoverLetterStatusSection
            jobId={id}
            getToken={getToken}
            onOpenHelper={() => navigate("/cover-letter-helper")}
          />

          {/* ── S2-014: Archive / Restore ─────────────────────────────────── */}
          <ArchiveRestoreSection
            jobId={id}
            stage={stage}
            getToken={getToken}
            onStageChange={(newStage) => setStage(newStage)}
          />

          {/* Quick info card — read-only summary at the bottom of the right column */}
          <div
            style={{
              ...panelStyle,
              backgroundColor: "var(--bg, #F8FAFC)",
              border: "1px dashed var(--color-border-default, #e5e7eb)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
                margin: 0,
              }}
            >
              <strong>Added:</strong> {formatLocalDateTime(job.createdAt)}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
                margin: "6px 0 0",
              }}
            >
              <strong>Last updated:</strong> {formatLocalDateTime(job.lastActivity)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;
