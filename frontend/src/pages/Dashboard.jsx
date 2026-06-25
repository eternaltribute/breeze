//dashboard.jsx
import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE_URL;
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

function fromApi(job) {
  const stage = normalizeStage(job.stage);
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    jobPostingBody: job.job_posting_body,
    stage,
    lastActivity: (job.updated_at ?? job.created_at)?.split("T")[0] ?? "",
  };
}

const stageColor = (stage) => {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  if (stage === "Rejected") return "#DC2626";
  if (stage === "Archived") return "#6B7280";

  return "#9CA3AF";
};

// Canonical stages for the filter dropdown (S2-BR-004)
const STAGES = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"];

// Sort options for the sort dropdown (S2-003)
const SORT_OPTIONS = [
  { label: "Last Activity (newest first)", key: "lastActivity" },
  { label: "Deadline (soonest first)", key: "deadline" },
  { label: "Company (A → Z)", key: "company" },
  { label: "Date Added (newest first)", key: "createdAt" },
];

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "var(--shadow)",
};
function JobCard({ title, company, jobPostingBody, stage, lastActivity, onEdit }) {
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
        <h3
          style={{
            margin: 0,
            color: "var(--color-heading, #003C78)",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            marginTop: "4px",
            color: "var(--color-subtext)",
          }}
        >
          {company}
        </p>

        <p
          style={{
            fontSize: "13px",
            color: "var(--color-subtext)",
            marginTop: "8px",
          }}
        >
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

      <p
        style={{
          margin: 0,
          color: "var(--text)",
          fontSize: "12px",
        }}
      >
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

function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);

  // S2-001: what the user typed in the search box
  const [searchQuery, setSearchQuery] = useState("");
  // S2-002: selected stage ("" = all) and location text
  const [filterStage, setFilterStage] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  // S2-003: which sort is active
  const [sortKey, setSortKey] = useState("lastActivity");

  // visibleJobs = jobs run through search → filter → sort
  // useMemo only reruns when one of its dependencies changes — no extra API calls
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

    // Step 3 — Sort (S2-003)
    return [...result].sort((a, b) => {
      if (sortKey === "company") return a.company.localeCompare(b.company);
      if (sortKey === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      return bVal.localeCompare(aVal);
    });
  }, [jobs, searchQuery, filterStage, filterLocation, sortKey]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs`, { headers: { Authorization: `Bearer ${token}` } });

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

  const handleAddJob = () => {
    navigate("/jobs/new");
  };

  const handleEditJob = (job) => {
    navigate(`/jobs/${job.id}/edit`);
  };

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
      {/* Header */}
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            color: "var(--color-subtext, #6b7280)",
          }}
        >
          Here are your active applications.
        </p>

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

      {/* Search + Filter + Sort toolbar — S2-001, S2-002, S2-003 */}
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap", // keep everything on one line
          gap: "10px",
          marginBottom: "24px",
          alignItems: "center",
          width: "100%", // use the full page width
        }}
      >
        {/* S2-001 Search — grows to fill leftover space */}
        <input
          type="text"
          placeholder="Search by title, company, or keywords…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search jobs"
          style={{
            flex: "1 1 0", // takes up all available space
            minWidth: 0, // lets it shrink below default min
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
            width: "130px",
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "var(--bg-card, #fff)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            outline: "none",
          }}
        />

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

        {/* Reset button — clears all filters/search/sort back to defaults */}
        <button
          onClick={() => {
            setSearchQuery("");
            setFilterStage("");
            setFilterLocation("");
            setSortKey("lastActivity");
          }}
          aria-label="Reset filters"
          style={{
            flexShrink: 0,
            padding: "9px 14px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            backgroundColor: "transparent",
            color: "var(--color-subtext, #6b7280)",
            fontSize: "14px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Reset
        </button>
      </div>

      {/* Job Grid */}
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
