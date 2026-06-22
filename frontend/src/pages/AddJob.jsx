import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import JobForm from "../components/JobForm";

const BASE = import.meta.env.VITE_API_BASE_URL;

function AddJob() {
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    try {
      if (!BASE) {
        throw new Error("API base URL is not defined in .env");
      }

      if (!formData.company || !formData.title) {
        throw new Error("Company and Title are required");
      }

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: formData.company,
          title: formData.title,
          job_posting_body: formData.jobPostingBody,
          stage: formData.stage.toLowerCase(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to create job");
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        Add Job
      </h1>

      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            border: "1px solid red",
            borderRadius: "6px",
            color: "red",
          }}
        >
          {error}
        </div>
      )}

      <JobForm onSubmit={handleSubmit} loading={loading} />

      <button
        onClick={() => navigate("/dashboard")}
        disabled={loading}
        style={{
          marginTop: "16px",
          backgroundColor: "transparent",
          border: "1px solid var(--color-border-default)",
          borderRadius: "8px",
          padding: "10px 16px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default AddJob;
