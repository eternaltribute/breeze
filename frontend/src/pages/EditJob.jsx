import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate, useParams } from "react-router-dom";
import JobForm from "../components/JobForm";

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

  return map[stage?.toLowerCase()] || "Interested";
};

function EditJob() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setError(null);

        const token = await getToken({ skipCache: true });

        const res = await fetch(`${BASE}/jobs/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load job");
        }

        const data = await res.json();

        setJob({
          id: data.id,
          company: data.company,
          title: data.title,
          jobPostingBody: data.job_posting_body,
          stage: normalizeStage(data.stage),
          applicationDeadline: data.application_deadline || "",
          recruiterNotes: data.recruiter_notes || "",
        });
      } catch (err) {
        console.error("Failed to fetch job:", err);
        setError("Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, getToken]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    setError(null);

    try {
      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: formData.company,
          title: formData.title,
          job_posting_body: formData.jobPostingBody,
          stage: formData.stage.toLowerCase(),
          application_deadline: formData.applicationDeadline || null,
          recruiter_notes: formData.recruiterNotes || null,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to update job");
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to update job:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>Loading job...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "red" }}>
        <h2>{error}</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: "40px" }}>
        <h2>Job not found</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          marginBottom: "24px",
        }}
      >
        Edit Job
      </h1>

      <JobForm initialData={job} onSubmit={handleSubmit} loading={saving} />

      <button
        onClick={() => navigate("/dashboard")}
        disabled={saving}
        style={{
          marginTop: "16px",
          backgroundColor: "transparent",
          border: "1px solid var(--color-border-default)",
          borderRadius: "8px",
          padding: "10px 16px",
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default EditJob;
