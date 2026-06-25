// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// S2-001  Search bar — filters cards by title, company, or job body text
// S2-002  Filter controls — narrow by stage, location, and deadline state
// S2-003  Sort controls — order by last activity, deadline, company, or date added
//
// How they chain together:
//   1. Fetch ALL jobs once from the API → store in `jobs` state
//   2. `visibleJobs` (useMemo) runs: search → filter → sort
//   3. Only `visibleJobs` is rendered — `jobs` never mutates
// ─────────────────────────────────────────────────────────────────────────────

import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE_URL;

// Converts lowercase backend stage to display title-case
const normalizeStage = (stage) => {
  const map = {
    interested: "Interested",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    archived: "Archived",
  };
  return map[stage] || "Interested";
};

// Converts raw API job object into the shape the UI needs
// Backend uses snake_case; frontend uses camelCase
function fromApi(job) {
  const stage = normalizeStage(job.stage);
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    jobPostingBody: job.job_posting_body,
    location: job.location ?? "",
    stage,
    lastActivity: (job.updated_at ?? job.created_at)?.split("T")[0] ?? "",
    deadline: job.deadline ?? "",
    createdAt: job.created_at?.split("T")[0] ?? "",
  };
}

// Returns a color for the stage pill on each card
const stageColor = (stage) => {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  if (stage === "Rejected") return "#DC2626";
  if (stage === "Archived") return "#6B7280";
  return "#9CA3AF";
};

// Canonical stages (S2-BR-004) — used in the filter dropdown
const STAGES = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"];

// Deadline state options — used in the deadline filter dropdown (S2-002)
const DEADLINE_STATES = [
  { label: "All Deadlines", value: "" },
  { label: "Overdue", value: "overdue" },
  { label: "Due this week", value: "this_week" },
  { label: "No deadline", value: "none" },
];

// Sort options — used in the sort dropdown (S2-003)
const SORT_OPTIONS = [
  { label: "Last Activity (newest first)", key: "lastActivity" },
  { label: "Deadline (soonest first)", key: "deadline" },
  { label: "Company (A → Z)", key: "company" },
  { label: "Date Added (newest first)", key: "createdAt_desc" },
  { label: "Date Added (oldest first)", key: "createdAt_asc" },
];

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "var(--shadow)",
};

// ─────────────────────────────────────────────────────────────────────────────
// JobCard — renders a single job entry
// ─────────────────────────────────────────────────────────────────────────────
function JobCard({ title, company, jobPostingBody, location, stage, lastActivity, onEdit }) {
  return (
    <div
      style={{
        ...cardStyle,
        borderLeft: "4px solid var(--color-heading, #003C78)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3 style={{ margin: 0, color: "var(--color-heading, #003C78)" }}>{title}</h3>

        <p style={{ marginTop: "4px", color: "var(--color-subtext)" }}>{company}</p>

        {location && (
          <p style={{ marginTop: "2px", fontSize: "12px", color: "var(--color-subtext)" }}>
            📍 {location}
          </p>
        )}

        <p style={{ fontSize: "13px", color: "var(--color-subtext)", marginTop: "8px" }}>
          {jobPostingBody.length > 120 ? `${jobPostingBody.slice(0, 120)}...` : jobPostingBody}
        </p>
      </div>

      <span
        style={{
          display: "inline-block",
          backgroundColor: stageColor(stage),
          color: "white",
          borderRadius: "999px",
          padding: "3px 12px",
          fontSize: "12px",
          fontWeight: 500,
          alignSelf: "flex-start",
        }}
      >
        {stage}
      </span>

      <p style={{ margin: 0, color: "var(--text)", fontSize: "12px" }}>
        Last activity: {lastActivity}
      </p>

      <button
        onClick={onEdit}
        style={{
          backgroundColor: "#003C78",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        Edit
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — main page
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Full job list from the API — never changes after fetch
  const [jobs, setJobs] = useState([]);

  // S2-001: search box text
  const [searchQuery, setSearchQuery] = useState("");

  // S2-002: stage dropdown, location input, deadline state dropdown
  const [filterStage, setFilterStage] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDeadline, setFilterDeadline] = useState("");

  // S2-003: active sort key
  const [sortKey, setSortKey] = useState("lastActivity");

  // Fetch jobs once on mount
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setJobs(data.map(fromApi));
        }
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
      }
    };
    fetchJobs();
  }, [getToken]);

  // visibleJobs — runs search → filter → sort every time a dependency changes
  const visibleJobs = useMemo(() => {
    // Step 1 — Search (S2-001)
    const query = searchQuery.toLowerCase().trim();
    let result = jobs.filter((job) => {
      if (!query) return true;
      return (
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.jobPostingBody.toLowerCase().includes(query)
      );
    });

    // Step 2a — Stage filter (S2-002)
    if (filterStage) {
      result = result.filter((job) => job.stage === filterStage);
    }

    // Step 2b — Location filter (S2-002)
    const locQuery = filterLocation.toLowerCase().trim();
    if (locQuery) {
      result = result.filter((job) => (job.location ?? "").toLowerCase().includes(locQuery));
    }

    // Step 2c — Deadline state filter (S2-002)
    if (filterDeadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      result = result.filter((job) => {
        if (filterDeadline === "none") return !job.deadline;
        if (!job.deadline) return false;
        const d = new Date(job.deadline);
        if (filterDeadline === "overdue") return d < today;
        if (filterDeadline === "this_week") return d >= today && d <= nextWeek;
        return true;
      });
    }

    // Step 3 — Sort (S2-003)
    return [...result].sort((a, b) => {
      if (sortKey === "company") {
        return a.company.localeCompare(b.company);
      }
      if (sortKey === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (sortKey === "createdAt_desc") {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (sortKey === "createdAt_asc") {
        return a.createdAt.localeCompare(b.createdAt);
      }
      // default: lastActivity newest first
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      return bVal.localeCompare(aVal);
    });
  }, [jobs, searchQuery, filterStage, filterLocation, filterDeadline, sortKey]);

  // True when any filter/search/sort is active — controls Reset button visibility
  const isFiltered =
    searchQuery || filterStage || filterLocation || filterDeadline || sortKey !== "lastActivity";

  const handleReset = () => {
    setSearchQuery("");
    setFilterStage("");
    setFilterLocation("");
    setFilterDeadline("");
    setSortKey("lastActivity");
  };

  const handleAddJob = () => navigate("/jobs/new");
  const handleEditJob = (job) => navigate(`/jobs/${job.id}/edit`);

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
      {/* Page header */}
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          marginBottom: "12px",
          fontSize: "40px",
          lineHeight: "1.2",
          fontWeight: 700,
        }}
      >
        Welcome back{user?.firstName ? `, ${user.firstName}` : ""}!
      </h1>

      {/* Subtitle + Add Job button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <p style={{ color: "var(--color-subtext, #6b7280)" }}>Here are your active applications.</p>

        <button
          onClick={handleAddJob}
          style={{
            backgroundColor: "#003C78",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add Job
        </button>
      </div>

      {/* Search + Filter + Sort toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: "10px",
          marginBottom: "12px",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* S2-001 Search */}
        <input
          type="text"
          placeholder="Search by title, company, or keywords…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search jobs"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            padding: "9px 14px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            outline: "none",
          }}
        />

        {/* S2-002 Stage filter */}
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          aria-label="Filter by stage"
          style={{
            flexShrink: 0,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* S2-002 Location filter */}
        <input
          type="text"
          placeholder="Location…"
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          aria-label="Filter by location"
          style={{
            flexShrink: 0,
            width: "120px",
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            outline: "none",
          }}
        />

        {/* S2-002 Deadline state filter */}
        <select
          value={filterDeadline}
          onChange={(e) => setFilterDeadline(e.target.value)}
          aria-label="Filter by deadline"
          style={{
            flexShrink: 0,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {DEADLINE_STATES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        {/* S2-003 Sort */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          aria-label="Sort jobs"
          style={{
            flexShrink: 0,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count + Reset filters row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)", margin: 0 }}>
          Results: {visibleJobs.length} / {jobs.length} total
        </p>

        {/* Reset only appears when something is actually filtered */}
        {isFiltered && (
          <button
            onClick={handleReset}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--color-border-default, #e5e7eb)",
              backgroundColor: "transparent",
              color: "var(--color-subtext, #6b7280)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Empty state — no jobs at all */}
      {jobs.length === 0 && (
        <p style={{ color: "var(--color-subtext)", textAlign: "center", marginTop: "60px" }}>
          No applications yet. Add your first job to get started!
        </p>
      )}

      {/* Empty state — jobs exist but nothing matches filters */}
      {jobs.length > 0 && visibleJobs.length === 0 && (
        <p style={{ color: "var(--color-subtext)", textAlign: "center", marginTop: "60px" }}>
          No applications match your search or filters. Try adjusting them.
        </p>
      )}

      {/* Job card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {visibleJobs.map((job) => (
          <JobCard key={job.id} {...job} onEdit={() => handleEditJob(job)} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
