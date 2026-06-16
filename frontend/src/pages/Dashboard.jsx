import { useUser, useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import JobForm from "../components/JobForm";

const BASE = import.meta.env.VITE_API_BASE_URL;

const allowedTransitions = {
  Interested: ["Applied", "Rejected"],
  Applied: ["Interview", "Rejected"],
  Interview: ["Offer", "Rejected"],
  Offer: ["Archived", "Rejected"],
  Rejected: [],
  Archived: [],
};

function canTransition(currentStage, nextStage) {
  return allowedTransitions[currentStage]?.includes(nextStage);
}

//backend uses snakcCase whilst front uses camelCase
function fromApi(job) {
  const stage = job.stage.charAt(0).toUpperCase() + job.stage.slice(1);
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    jobPostingBody: job.job_posting_body,
    stage,
    lastActivity: (job.updated_at ?? job.created_at)?.split("T")[0] ?? "",
  };
}
//does reverse
function toApi(form) {
  return {
    company: form.company,
    title: form.title,
    job_posting_body: form.jobPostingBody,
    stage: form.stage.toUpperCase(),
  };
}

const stageColor = (stage) => {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  if (stage === "Rejected") return "#DC2626";
  if (stage === "Archived") return "#6B7280";

  return "#9CA3AF";
};

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

  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

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
    setSelectedJob(null);
    setShowForm(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    setShowForm(true);
  };

  const handleUpdateJob = async (formData) => {
    if (selectedJob && selectedJob.stage != formData.stage) {
      if (!canTransition(selectedJob.stage, formData.stage)) {
        const confirmed = window.confirm(
          `Moving from ${selectedJob.stage} to ${formData.stage} is not part of the normal workflow. Do you want to continue?`
        );
        if (!confirmed) {
          return;
        }

        console.log({
          userId: user?.id,
          userName: user?.fullName,
          timestamp: new Date().toISOString(),
          fromStage: selectedJob.stage,
          toStage: formData.stage,
        });
      }
    }

    try {
      const token = await getToken({ skipCache: true });

      if (selectedJob) {
        const res = await fetch(`${BASE}/jobs/${selectedJob.id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(toApi(formData)),
        });
        if (!res.ok) {
          throw new Error("Updating of this job failed");
        }
        const updated = await res.json();
        setJobs(jobs.map((j) => (j.id === selectedJob.id ? fromApi(updated) : j)));
      } else {
        const res = await fetch(`${BASE}/jobs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(toApi(formData)),
        });
        if (!res.ok) {
          throw new Error("Creation of this job failed");
        }
        const created = await res.json();
        setJobs([...jobs, fromApi(created)]);
      }

      setShowForm(false);
      setSelectedJob(null);
    } catch (err) {
      console.error("Failed to save job:", err);
    }
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

      {showForm && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--color-border-default)",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "24px",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>{selectedJob ? "Edit Job" : "Add Job"}</h2>

          <JobForm initialData={selectedJob} onSubmit={handleUpdateJob} />

          <button
            onClick={() => setShowForm(false)}
            style={{
              marginTop: "12px",
              backgroundColor: "var(--bg-card)",
              color: "var(--color-heading)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Job Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {jobs.map((job) => (
          <JobCard key={job.id} {...job} onEdit={() => handleEditJob(job)} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
