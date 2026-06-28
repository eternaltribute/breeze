// src/pages/CoverLetterHelper.jsx
// -----------------------------------------------------------------------------
// Cover Letter Helper page - S2-022
//
// Business rules satisfied:
//   S2-BR-018  AI drafting must be triggered by explicit user action
//   S2-BR-019  AI cover letter drafts must use profile + job context inputs
//   S2-BR-020  Generated output is editable before save
//   S2-BR-021  Job-context save operations must preserve ownership boundaries
//
// Layout:
//   Top panel   - select saved job + generate action
//   Main editor - editable cover letter draft
//   Action row  - save generated or edited draft
//
// AI calls - ALL go through Ronald's FastAPI backend.
// Never call Anthropic/OpenAI directly from the frontend.
// API keys live in backend environment variables only.
//
// TODOs:
//   POST /cover-letter/generate
//     accepts: { profile: object, job_id: string | number }
//     returns: { cover_letter: string }
//
//   POST /cover-letter/save
//     accepts: { job_id: string | number, cover_letter_text: string }
//     returns: { document_id: string }
//
//   POST /cover-letter/improve
//     accepts: {
//       cover_letter_text: string,
//       instruction: string,
//       job_id: string | number
//     }
//     returns: { improved_text: string }
//
//   GET /cover-letter/job/:jobId
//     returns: { document_id: string, cover_letter_text: string }
// -----------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { FileText, Sparkles, Save } from "lucide-react";

const BASE = import.meta.env.VITE_API_BASE_URL;

function CoverLetterHelper() {
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [improveInstruction, setImproveInstruction] = useState("");
  const [previousDraft, setPreviousDraft] = useState("");
  const [improving, setImproving] = useState(false);
  const selectedJob = jobs.find((job) => String(job.id) === String(selectedJobId));

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        setError("");

        const token = await getToken({ skipCache: true });

        const [profileRes, jobsRes] = await Promise.all([
          fetch(`${BASE}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE}/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!profileRes.ok) throw new Error("Failed to load profile");
        if (!jobsRes.ok) throw new Error("Failed to load jobs");

        const profileData = await profileRes.json();
        const jobsData = await jobsRes.json();

        setProfile({
          firstName: profileData.first_name ?? "",
          lastName: profileData.last_name ?? "",
          email: profileData.email ?? "",
          phone: profileData.phone_number ?? "",
          summary: profileData.professional_summary ?? "",
        });

        setJobs(jobsData || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load cover letter data.");
      }
    };

    fetchPageData();
  }, [getToken]);

  const handleImprove = async () => {
    if (!selectedJob) {
      setError("Please select a job first.");
      return;
    }

    if (!draft.trim() || !improveInstruction.trim()) return;

    try {
      setError("");
      setImproving(true);
      setPreviousDraft(draft);

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/cover-letter/improve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: selectedJob.id,
          cover_letter_text: draft,
          instruction: improveInstruction,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Cover letter improvement failed");
      }

      setDraft(data?.improved_text ?? "");
      setImproveInstruction("");
      setSaveSuccess(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to improve cover letter.");
    } finally {
      setImproving(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedJob) {
      setError("Please select a job first.");
      return;
    }

    if (!profile) {
      setError("Profile data is still loading.");
      return;
    }

    try {
      setError("");
      setSaveSuccess(false);
      setPreviousDraft("");
      setGenerating(true);

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/cover-letter/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile,
          job_id: selectedJob.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Cover letter generation failed");
      }

      setDraft(data?.cover_letter ?? "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate cover letter.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedJob || !draft.trim()) return;

    try {
      setError("");
      setSaving(true);
      setSaveSuccess(false);

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/cover-letter/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: selectedJob.id,
          cover_letter_text: draft,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Cover letter save failed");
      }

      setSaveSuccess(true);
      setPreviousDraft("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save cover letter.");
    } finally {
      setSaving(false);
    }
  };

  const fetchSavedCoverLetter = async (jobId) => {
    try {
      setError("");
      setDraft("");
      setPreviousDraft("");

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/cover-letter/job/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 404) {
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load saved cover letter");
      }

      setDraft(data?.cover_letter_text ?? "");
    } catch (err) {
      console.error("Failed to load saved cover letter:", err);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg, #F8FAFC)",
        minHeight: "100vh",
        padding: "40px 60px",
        maxWidth: "1100px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          fontSize: "40px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        Cover Letter Helper
      </h1>

      <p style={{ color: "var(--color-subtext, #6b7280)", marginBottom: "28px" }}>
        Generate an editable cover letter draft using your profile and selected job context.
      </p>

      {error && <p style={{ color: "var(--color-error, #FF6138)", fontWeight: 600 }}>{error}</p>}

      <div
        style={{
          backgroundColor: "var(--bg-card, white)",
          border: "1px solid var(--color-border-default, #e5e7eb)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "var(--shadow)",
        }}
      >
        <label
          style={{
            display: "block",
            color: "var(--color-heading, #003C78)",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Job Context
        </label>

        <select
          value={selectedJobId}
          onChange={(e) => {
            const jobId = e.target.value;

            setSelectedJobId(jobId);
            setSaveSuccess(false);

            if (jobId) {
              fetchSavedCoverLetter(jobId);
            } else {
              setDraft("");
            }
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #d1d5db)",
            backgroundColor: "var(--bg-card, white)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            marginBottom: "16px",
          }}
        >
          <option value="">Select a saved job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} at {job.company}
            </option>
          ))}
        </select>

        <button
          onClick={handleGenerate}
          disabled={!selectedJobId || generating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: !selectedJobId || generating ? "#9ca3af" : "#046A97",
            color: "white",
            fontWeight: 700,
            cursor: !selectedJobId || generating ? "not-allowed" : "pointer",
          }}
        >
          <Sparkles size={16} />
          {generating ? "Generating..." : "Generate Cover Letter"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: previousDraft ? "1fr 1fr" : "1fr",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-card, white)",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 20px",
              borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
              backgroundColor: "var(--bg, #F8FAFC)",
              color: "var(--color-heading, #003C78)",
              fontWeight: 700,
            }}
          >
            <FileText size={16} />
            Current Draft
          </div>

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="Your generated cover letter will appear here. You can edit it before saving."
            style={{
              width: "100%",
              minHeight: "460px",
              padding: "24px",
              border: "none",
              outline: "none",
              resize: "vertical",
              fontFamily: "Georgia, serif",
              fontSize: "15px",
              lineHeight: 1.7,
              color: "var(--color-input-text, #111827)",
              backgroundColor: "var(--color-input-bg, white)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {previousDraft && (
          <div
            style={{
              backgroundColor: "var(--bg-card, white)",
              border: "1px solid var(--color-border-default, #e5e7eb)",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "var(--shadow)",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
                backgroundColor: "var(--bg, #F8FAFC)",
                color: "var(--color-heading, #003C78)",
                fontWeight: 700,
              }}
            >
              Previous Draft
            </div>

            <textarea
              value={previousDraft}
              readOnly
              style={{
                width: "100%",
                minHeight: "460px",
                padding: "24px",
                border: "none",
                outline: "none",
                resize: "vertical",
                fontFamily: "Georgia, serif",
                fontSize: "15px",
                lineHeight: 1.7,
                color: "var(--color-input-text, #111827)",
                backgroundColor: "var(--color-input-bg, white)",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "16px 20px",
          borderRadius: "12px",
          border: "1px solid var(--color-border-default, #e5e7eb)",
          backgroundColor: "var(--bg-card, white)",
          boxShadow: "var(--shadow)",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--color-heading, #003C78)",
          }}
        >
          Improve with AI
        </p>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={improveInstruction}
            onChange={(e) => setImproveInstruction(e.target.value)}
            placeholder='e.g. "Make this more concise"'
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--color-border-default, #e5e7eb)",
              fontSize: "13px",
              color: "var(--color-input-text, #111827)",
              backgroundColor: "var(--color-input-bg, white)",
            }}
          />

          <button
            onClick={handleImprove}
            disabled={!selectedJobId || !draft.trim() || !improveInstruction.trim() || improving}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor:
                !selectedJobId || !draft.trim() || !improveInstruction.trim() || improving
                  ? "#9ca3af"
                  : "#046A97",
              color: "white",
              fontWeight: 700,
              cursor:
                !selectedJobId || !draft.trim() || !improveInstruction.trim() || improving
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {improving ? "Improving..." : "Improve"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
        <button
          onClick={handleSave}
          disabled={!draft.trim() || !selectedJobId || saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: !draft.trim() || !selectedJobId || saving ? "#9ca3af" : "#003C78",
            color: "white",
            fontWeight: 700,
            cursor: !draft.trim() || !selectedJobId || saving ? "not-allowed" : "pointer",
          }}
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Cover Letter"}
        </button>

        {saveSuccess && (
          <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "14px" }}>
            ✓ Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

export default CoverLetterHelper;
