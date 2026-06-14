import { useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

const jobs = [
  {
    id: 1,
    title: "Software Engineer",
    company: "Google",
    stage: "Interview",
    lastActivity: "2026-06-09",
  },
  {
    id: 2,
    title: "Frontend Developer",
    company: "Meta",
    stage: "Applied",
    lastActivity: "2026-06-08",
  },
  {
    id: 3,
    title: "Full Stack Developer",
    company: "Spotify",
    stage: "Interested",
    lastActivity: "2026-06-07",
  },
  {
    id: 4,
    title: "React Developer",
    company: "Netflix",
    stage: "Offer",
    lastActivity: "2026-06-06",
  },
];

const stageColor = (stage) => {
  if (stage === "Interview" || stage === "Offer") return "#FF6138";
  if (stage === "Applied") return "#046A97";
  return "#9ca3af";
};

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

function JobCard({ title, company, stage, lastActivity }) {
  return (
    <div
      style={{
        ...cardStyle,
        borderLeft: "4px solid #003C78",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            color: "#003C78",
            fontSize: "16px",
            fontWeight: 600,
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: "4px 0 0",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          {company}
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

      <p style={{ margin: 0, color: "#9ca3af", fontSize: "12px" }}>Last activity: {lastActivity}</p>
    </div>
  );
}

function Dashboard() {
  const { user } = useUser();

  return (
    <div
      style={{
        backgroundColor: "#F8FAFC",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      {/* Page Header */}
      <h1
        style={{
          color: "#003C78",
          marginBottom: "12px",
          fontSize: "36px",
          lineHeight: "1.2",
          fontWeight: 700,
        }}
      >
        Welcome back{user?.firstName ? `, ${user.firstName}` : ""}!
      </h1>

      <p style={{ color: "#6b7280", marginBottom: "24px" }}>Here are your active applications.</p>

      {/* Job Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {jobs.map((job) => (
          <JobCard key={job.id} {...job} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
