// src/pages/JobDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
// S2-005  Job Card to Job Detail Expansion Pattern
//           — every card navigates here via /jobs/:id
// S2-006  Job Detail Overview Section
//           — editable panel for core job fields (company, title, body, stage,
//             location, salary, url, notes)
// S2-007  Job Deadline and Recruiter/Contact Notes Fields
//           — separate editable section for deadline + recruiter notes
//
// Business rules satisfied:
//   S2-BR-001  job must include company, title, and full job posting body
//   S2-BR-003  job posting body must be editable after creation
//   S2-BR-004  canonical stages are the six defined in STAGES constant
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
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

const BASE = import.meta.env.VITE_API_BASE_URL;

// ── Canonical stages (S2-BR-004) ─────────────────────────────────────────────
const STAGES = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"];

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
    lastActivity: (data.updated_at ?? data.created_at)?.split("T")[0] ?? "",
    createdAt: data.created_at?.split("T")[0] ?? "",
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
// JobDetail — main page component
// ─────────────────────────────────────────────────────────────────────────────
function JobDetail() {
  const { id } = useParams(); // job id from the URL /jobs/:id
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // ── Page-level state ───────────────────────────────────────────────────────
  const [job, setJob] = useState(null); // raw job data from API
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null); // error loading the job

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

  // Overview save state
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewSaved, setOverviewSaved] = useState(false); // shows "Saved!" flash
  const [overviewErrors, setOverviewErrors] = useState({}); // field-level errors (S2-BR-017)

  // ── Deadline + Recruiter Notes section state (S2-007) ─────────────────────
  const [deadline, setDeadline] = useState("");
  const [recruiterNotes, setRecruiterNotes] = useState("");

  // Deadline/recruiter save state
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailSaved, setDetailSaved] = useState(false);
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

  // ── handleOverviewSave — saves core job fields (S2-006) ───────────────────
  const handleOverviewSave = async () => {
    // Validate first — show field errors without hitting the API (S2-BR-017)
    const errors = validateOverview();
    if (Object.keys(errors).length > 0) {
      setOverviewErrors(errors);
      return;
    }

    setOverviewErrors({});
    setOverviewSaving(true);

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
          stage: stage.toLowerCase(), // backend stores lowercase
          location: location.trim() || null,
          job_url: jobUrl.trim() || null,
          salary_range: salaryRange.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Save failed");
      }

      // Flash "Saved!" for 2 seconds then reset
      setOverviewSaved(true);
      setTimeout(() => setOverviewSaved(false), 2000);
    } catch (err) {
      console.error("Overview save failed:", err);
      setOverviewErrors({ general: "Save failed. Please try again." });
    } finally {
      setOverviewSaving(false);
    }
  };

  // ── handleDetailSave — saves deadline + recruiter notes (S2-007) ──────────
  // TODO (Ronald): once deadline and recruiter_notes are added to the Job
  // model and PUT /jobs/:id, remove the console.warn and this will fully work.
  const handleDetailSave = async () => {
    const errors = {};

    // Validate deadline format if provided — must be a valid date
    if (deadline && isNaN(Date.parse(deadline))) {
      errors.deadline = "Please enter a valid date.";
    }

    if (Object.keys(errors).length > 0) {
      setDetailErrors(errors);
      return;
    }

    setDetailErrors({});
    setDetailSaving(true);

    try {
      const token = await getToken({ skipCache: true });

      // TODO (Ronald): add deadline and recruiter_notes to JobUpdate model
      // and Job SQLModel table. Until then this PUT will silently ignore them.
      const res = await fetch(`${BASE}/jobs/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deadline: deadline || null,
          recruiter_notes: recruiterNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Save failed");
      }

      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 2000);
    } catch (err) {
      console.error("Detail save failed:", err);
      setDetailErrors({ general: "Save failed. Please try again." });
    } finally {
      setDetailSaving(false);
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

        {/* Stage pill — read-only display, editable in the Overview panel below */}
        <span
          style={{
            backgroundColor: stageColor(stage),
            color: "white",
            borderRadius: "999px",
            padding: "6px 18px",
            fontSize: "13px",
            fontWeight: 600,
            alignSelf: "flex-start",
            marginTop: "4px",
          }}
        >
          {stage}
        </span>
      </div>

      {/* Last activity + created date — metadata row */}
      <p style={{ fontSize: "12px", color: "var(--color-subtext, #6b7280)", marginBottom: "32px" }}>
        Last activity: {job.lastActivity}
        {job.createdAt && ` · Added: ${job.createdAt}`}
      </p>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px", // main panel + narrower side panel
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* ── LEFT: Overview panel (S2-006) ─────────────────────────────── */}
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

          {/* Stage — dropdown using canonical stages (S2-BR-004) */}
          <div style={{ marginBottom: "16px" }}>
            <Label text="Stage" required />
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
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

          {/* Save Overview button — primary action (S2-BR-017) */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={handleOverviewSave}
              disabled={overviewSaving}
              style={{
                backgroundColor: "#003C78",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: overviewSaving ? "not-allowed" : "pointer",
                opacity: overviewSaving ? 0.7 : 1,
              }}
            >
              {overviewSaving ? "Saving…" : "Save Overview"}
            </button>

            {/* "Saved!" flash — confirms successful save without a toast library */}
            {overviewSaved && (
              <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: 500 }}>✓ Saved!</span>
            )}
          </div>
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

            {/* General save error */}
            {detailErrors.general && (
              <p style={{ color: "#DC2626", fontSize: "13px", marginBottom: "16px" }}>
                {detailErrors.general}
              </p>
            )}

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

            {/* Save Deadline & Contact button */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={handleDetailSave}
                disabled={detailSaving}
                style={{
                  backgroundColor: "#003C78",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: detailSaving ? "not-allowed" : "pointer",
                  opacity: detailSaving ? 0.7 : 1,
                  width: "100%",
                }}
              >
                {detailSaving ? "Saving…" : "Save Deadline & Contact"}
              </button>
            </div>

            {detailSaved && (
              <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 500, marginTop: "8px" }}>
                ✓ Saved!
              </p>
            )}
          </div>

          {/* Quick info card — read-only summary at the bottom of the right column */}
          <div
            style={{
              ...panelStyle,
              backgroundColor: "var(--bg, #F8FAFC)",
              border: "1px dashed var(--color-border-default, #e5e7eb)",
            }}
          >
            <p style={{ fontSize: "12px", color: "var(--color-subtext, #6b7280)", margin: 0 }}>
              <strong>Job ID:</strong> {job.id}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
                margin: "6px 0 0",
              }}
            >
              <strong>Added:</strong> {job.createdAt}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
                margin: "6px 0 0",
              }}
            >
              <strong>Last updated:</strong> {job.lastActivity}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;
