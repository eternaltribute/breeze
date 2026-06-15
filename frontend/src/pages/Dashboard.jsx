import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import JobForm from "../components/JobForm";

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

const initialJobs = [
  {
    id: 1,
    company: "Google",
    title: "Software Engineer",
    jobPostingBody: "Seeking a software engineer with React and backend experience.",
    stage: "Interview",
    lastActivity: "2026-06-09",
  },
];

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

  const [jobs, setJobs] = useState(initialJobs);
  const [showForm, setShowForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const handleAddJob = () => {
    setSelectedJob(null);
    setShowForm(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    setShowForm(true);
  };

  const handleUpdateJob = (updatedJob) => {
    if (selectedJob) {
      const originalJob = jobs.find((job) => job.id === selectedJob.id);

      if (
        originalJob &&
        originalJob.stage !== updatedJob.stage &&
        !canTransition(originalJob.stage, updatedJob.stage)
      ) {
        const confirmed = window.confirm(
          `Moving from ${originalJob.stage} to ${updatedJob.stage}
is not part of the normal workflow.

Do you want to continue?`
        );

        if (!confirmed) {
          return;
        }

        // Override logging
        console.log({
          userId: user?.id,
          userName: user?.fullName,
          timestamp: new Date().toISOString(),
          fromStage: originalJob.stage,
          toStage: updatedJob.stage,
        });
      }

      setJobs(
        jobs.map((job) =>
          job.id === selectedJob.id
            ? {
                ...job,
                ...updatedJob,
                lastActivity: new Date().toISOString().split("T")[0],
              }
            : job
        )
      );
    } else {
      const newJob = {
        ...updatedJob,
        id: Date.now(),
        lastActivity: new Date().toISOString().split("T")[0],
      };

      setJobs([...jobs, newJob]);
    }

    setShowForm(false);
    setSelectedJob(null);
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
