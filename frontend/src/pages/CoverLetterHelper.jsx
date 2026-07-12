// src/pages/CoverLetterHelper.jsx
// -----------------------------------------------------------------------------
// Cover Letter Helper page - S2-022
//
// Business rules satisfied:
//   S2-BR-018  AI drafting must be triggered by explicit user action
//   S2-BR-019  AI cover letter drafts must use profile + job context inputs
//   S2-BR-020  Generated/uploaded output is editable before save
//   S2-BR-021  Job-context save operations must preserve ownership boundaries
//   S3-BR-004  Supported upload formats are PDF, DOCX, and TXT
//   S3-BR-005  Unsupported formats are rejected with clear validation messages
//
// AI calls - ALL go through Ronald's FastAPI backend.
// Never call Anthropic/OpenAI directly from the frontend.
// API keys live in backend environment variables only.
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  Save,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import mammoth from "mammoth";
import { addMockDocument } from "../lib/mockLibraryStore";

const BASE = import.meta.env.VITE_API_BASE_URL;
const SUPPORTED_DRAFT_FORMATS = ".pdf, .docx, .txt";
const SUPPORTED_DRAFT_EXTENSIONS = [".pdf", ".docx", ".txt"];

// TODO (Ronald): flip this to false once POST /documents/cover-letter/save
// is live and confirmed working end-to-end. While true, Save writes to the
// shared mock library (see lib/mockLibraryStore.js) instead of calling the
// real backend, so the whole Resume/Cover Letter -> Library flow can be
// demoed and tested without the backend being ready.
const USE_MOCK_SAVE = false;

function normalizeLibraryStatus(status) {
  return status === "archived" ? "archived" : "active";
}

const panelStyle = {
  backgroundColor: "var(--bg-card, white)",
  border: "1px solid var(--color-border-default, #e5e7eb)",
  borderRadius: "12px",
  boxShadow: "var(--shadow)",
};

function CoverLetterUploadZone({ onFileAccepted, onFileRejected, disabled }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    validator: (file) => {
      const lowerName = file.name.toLowerCase();
      const isSupported = SUPPORTED_DRAFT_EXTENSIONS.some((extension) =>
        lowerName.endsWith(extension)
      );

      if (isSupported) return null;

      return {
        code: "unsupported-cover-letter-draft",
        message: "Upload a PDF, DOCX, or TXT cover letter draft.",
      };
    },
    disabled,
    maxFiles: 1,
    onDropAccepted: (files) => onFileAccepted(files[0]),
    onDropRejected: () => onFileRejected("Upload a PDF, DOCX, or TXT cover letter draft."),
  });

  return (
    <div
      {...getRootProps()}
      style={{
        ...panelStyle,
        padding: "48px 24px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: isDragActive ? "var(--brand-ocean-muted, #EFF6FF)" : "var(--bg, #F8FAFC)",
        border: `2px dashed ${isDragActive ? "#003C78" : "var(--color-border-default, #e5e7eb)"}`,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <input {...getInputProps()} accept={SUPPORTED_DRAFT_FORMATS} />
      <Upload
        size={36}
        style={{
          color: isDragActive ? "#003C78" : "var(--color-subtext, #9ca3af)",
          marginBottom: "12px",
        }}
      />
      <p
        style={{
          margin: "0 0 6px",
          fontSize: "15px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
        }}
      >
        {isDragActive ? "Drop your draft here" : "Upload a cover letter draft"}
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--color-subtext, #6b7280)" }}>
        PDF, DOCX, or TXT
      </p>
    </div>
  );
}

function GenerateFromJobCard({ jobs, selectedJobId, onJobChange, onGenerate, generating }) {
  return (
    <div style={{ ...panelStyle, padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <Sparkles size={22} style={{ color: "#046A97" }} />
        <h2
          style={{
            color: "var(--color-heading, #003C78)",
            fontSize: "16px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Generate from Job
        </h2>
      </div>

      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "13px", marginBottom: "18px" }}>
        Pick a saved job and AI will create a new editable cover letter draft.
      </p>

      <div style={{ position: "relative", marginBottom: "14px" }}>
        <select
          value={selectedJobId}
          onChange={(e) => onJobChange(e.target.value)}
          aria-label="Select a saved job"
          style={{
            width: "100%",
            padding: "11px 36px 11px 14px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-default, #d1d5db)",
            backgroundColor: "var(--bg-card, white)",
            color: "var(--color-heading, #003C78)",
            fontSize: "14px",
            appearance: "none",
          }}
        >
          <option value="">Select a saved job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} at {job.company}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--color-subtext, #6b7280)",
          }}
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={!selectedJobId || generating}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          width: "100%",
          padding: "11px 18px",
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
  );
}

function getReview(draft) {
  const text = draft.trim();
  if (!text) {
    return {
      score: null,
      metrics: null,
      feedback: [],
    };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasGreeting = /^(dear|hello|hi)\b/i.test(text);
  const hasClosing = /(sincerely|best regards|thank you|regards),?/i.test(text);
  const hasCompanyMention = /\b(company|team|role|position|opportunity)\b/i.test(text);
  const hasSpecifics = /\b(project|experience|skills|built|led|created|developed|managed)\b/i.test(
    text
  );
  const hasAction = /\b(interview|discuss|speak|connect|next steps)\b/i.test(text);

  const metrics = {
    structure: Math.min(
      20,
      (hasGreeting ? 8 : 0) + (hasClosing ? 8 : 0) + (wordCount > 120 ? 4 : 0)
    ),
    personalization: Math.min(20, (hasCompanyMention ? 10 : 0) + (hasSpecifics ? 10 : 0)),
    clarity: wordCount >= 160 && wordCount <= 420 ? 20 : wordCount > 80 ? 14 : 8,
    tone: /!{2,}|\bvery very\b/i.test(text) ? 12 : 18,
    callToAction: hasAction ? 20 : 8,
  };

  const score = Object.values(metrics).reduce((sum, value) => sum + value, 0);
  const feedback = [];
  if (!hasGreeting) feedback.push("Add a direct greeting so the letter opens professionally.");
  if (!hasCompanyMention)
    feedback.push("Mention the company, team, role, or opportunity more directly.");
  if (!hasSpecifics)
    feedback.push("Add one concrete experience or skill that connects you to the job.");
  if (wordCount < 160)
    feedback.push("Expand the draft with a short body paragraph that shows fit.");
  if (wordCount > 420) feedback.push("Trim the draft so the strongest points are easier to scan.");
  if (!hasAction)
    feedback.push(
      "Close with a clear next step, such as interest in an interview or conversation."
    );

  return {
    score,
    metrics,
    feedback: feedback.length
      ? feedback
      : ["Strong draft. Consider one final pass for job-specific keywords."],
  };
}

function MetricBar({ label, score }) {
  const pct = Math.round((score / 20) * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#FF6138" : "#DC2626";

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "13px", color: "var(--color-heading, #003C78)", fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ fontSize: "12px", color: "var(--color-subtext, #6b7280)", fontWeight: 700 }}>
          {score}/20
        </span>
      </div>
      <div
        style={{
          height: "6px",
          borderRadius: "999px",
          backgroundColor: "var(--color-border-default, #e5e7eb)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
      </div>
    </div>
  );
}

function CoverLetterReviewPanel({ draft, sticky = false }) {
  const review = useMemo(() => getReview(draft), [draft]);

  return (
    <div
      style={{
        ...panelStyle,
        padding: "24px",
        ...(sticky ? { position: "sticky", top: "24px" } : {}),
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        <Brain size={18} style={{ color: "#046A97" }} />
        AI Review
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-subtext, #6b7280)", marginBottom: "20px" }}>
        Upload or generate a draft, then use the review to guide edits.
      </p>

      {review.score === null ? (
        <div
          style={{ textAlign: "center", padding: "24px 0", color: "var(--color-subtext, #9ca3af)" }}
        >
          <FileText size={32} style={{ marginBottom: "8px", opacity: 0.4 }} />
          <p style={{ fontSize: "13px", margin: 0 }}>No cover letter draft yet</p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <p
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "34px",
                fontWeight: 800,
                lineHeight: 1,
                margin: 0,
              }}
            >
              {review.score}
            </p>
            <p
              style={{
                color: "var(--color-subtext, #6b7280)",
                fontSize: "12px",
                margin: "6px 0 0",
              }}
            >
              Draft Score
            </p>
          </div>

          <MetricBar label="Structure" score={review.metrics.structure} />
          <MetricBar label="Personalization" score={review.metrics.personalization} />
          <MetricBar label="Clarity" score={review.metrics.clarity} />
          <MetricBar label="Tone" score={review.metrics.tone} />
          <MetricBar label="Call to Action" score={review.metrics.callToAction} />

          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-subtext, #6b7280)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "18px 0 10px",
            }}
          >
            Suggestions
          </p>
          {review.feedback.map((item) => (
            <div
              key={item}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-default, #e5e7eb)",
                backgroundColor: "var(--bg, #F8FAFC)",
                color: "var(--color-subtext, #6b7280)",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              {item}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function CoverLetterHelper() {
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [draft, setDraft] = useState("");
  const [draftFileName, setDraftFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [parsingDraft, setParsingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [improveInstruction, setImproveInstruction] = useState("");
  const [previousDraft, setPreviousDraft] = useState("");
  const [improving, setImproving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("Cover Letter");
  const [saveStatus, setSaveStatus] = useState("active");
  const [saveTags, setSaveTags] = useState("");
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

  const fetchSavedCoverLetter = async (jobId) => {
    try {
      setError("");
      setDraft("");
      setDraftFileName("");
      setPreviousDraft("");

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/documents/cover-letter/job/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) return;

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load saved cover letter");
      }

      setDraft(data?.cover_letter_text ?? "");
      setDraftFileName("Saved cover letter");
      setSaveTitle(data?.title ?? "Cover Letter");
      setSaveStatus(normalizeLibraryStatus(data?.status));
      setSaveTags(data?.tags ?? "");
    } catch (err) {
      console.error("Failed to load saved cover letter:", err);
    }
  };

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId);
    setSaveSuccess(false);

    if (jobId) {
      fetchSavedCoverLetter(jobId);
    } else {
      setDraft("");
      setDraftFileName("");
      setSaveTitle("Cover Letter");
      setSaveStatus("active");
      setSaveTags("");
    }
  };

  const handleDraftRejected = (message) => {
    setUploadError(
      message || `Unsupported file type. Accepted formats: ${SUPPORTED_DRAFT_FORMATS}.`
    );
  };

  const handleDraftAccepted = useCallback(
    async (file) => {
      setUploadError("");
      setError("");
      setParsingDraft(true);

      try {
        const lowerName = file.name.toLowerCase();
        let text = "";

        if (lowerName.endsWith(".docx")) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else if (lowerName.endsWith(".txt")) {
          text = await file.text();
        } else if (lowerName.endsWith(".pdf")) {
          const token = await getToken({ skipCache: true });
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch(`${BASE}/documents/resume/parse-pdf`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.detail || "Could not extract text from this PDF.");
          text = data?.text ?? "";
        } else {
          throw new Error(`Unsupported file type. Accepted formats: ${SUPPORTED_DRAFT_FORMATS}.`);
        }

        if (!text.trim()) {
          throw new Error("This file did not contain readable cover letter text.");
        }

        setDraft(text.trim());
        setDraftFileName(file.name);
        setSaveTitle(file.name.replace(/\.(pdf|docx|txt)$/i, ""));
        setPreviousDraft("");
        setSaveSuccess(false);
      } catch (err) {
        console.error("Cover letter draft upload failed:", err);
        setDraft("");
        setDraftFileName("");
        setUploadError(err.message || "Could not read this draft. Try PDF, DOCX, or TXT.");
      } finally {
        setParsingDraft(false);
      }
    },
    [getToken]
  );

  const handleClearDraft = () => {
    setDraft("");
    setDraftFileName("");
    setPreviousDraft("");
    setSaveSuccess(false);
    setUploadError("");
    setSaveTitle("Cover Letter");
    setSaveStatus("active");
    setSaveTags("");
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

      const res = await fetch(`${BASE}/documents/cover-letter/generate`, {
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
      setDraftFileName(`${selectedJob.company} ${selectedJob.title} draft`);
      setSaveTitle(`${selectedJob.company} ${selectedJob.title} Cover Letter`);
      setSaveTags(`${selectedJob.company}, tailored`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate cover letter.");
    } finally {
      setGenerating(false);
    }
  };

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

      const res = await fetch(`${BASE}/documents/cover-letter/improve`, {
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
      setDraftFileName("Improved cover letter draft");
      setImproveInstruction("");
      setSaveSuccess(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to improve cover letter.");
    } finally {
      setImproving(false);
    }
  };

  const handleSave = async () => {
    if (!draft.trim()) return;

    const documentTitle = saveTitle.trim() || "Cover Letter";

    // ── Fail-safe: block saving a document with the same name as an
    // existing cover letter (S3-BR-007/008-adjacent — this is a UX
    // safeguard, not a substitute for a real backend uniqueness rule).
    //if (isDuplicateTitle(documentTitle, "cover_letter")) {
     // setError(
       // `A cover letter named "${documentTitle}" already exists. Rename this draft or edit the existing one instead.`
      //);
     // return;
    //}

    try {
      setError("");
      setSaving(true);
      setSaveSuccess(false);

      if (USE_MOCK_SAVE) {
        // Simulates a brief save delay so the "Saving..." state is visible
        await new Promise((resolve) => setTimeout(resolve, 400));
        addMockDocument({
          type: "cover_letter",
          title: documentTitle,
          documentText: draft,
          jobId: selectedJob?.id ?? null,
          tags: saveTags,
        });
        setSaveSuccess(true);
        setPreviousDraft("");
        return;
      }

      const token = await getToken({ skipCache: true });

      const res = await fetch(`${BASE}/documents/cover-letter/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: selectedJob?.id ?? null,
          cover_letter_text: draft,
          title: documentTitle,
          status: saveStatus,
          tags: saveTags,
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

  const draftLoaded = draft.trim().length > 0;

  return (
    <div
      style={{
        backgroundColor: "var(--bg, #F8FAFC)",
        minHeight: "100vh",
        padding: "40px 60px",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          fontSize: "40px",
          fontWeight: 700,
          marginBottom: "8px",
          lineHeight: 1.2,
        }}
      >
        Cover Letter Helper
      </h1>

      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "16px", marginBottom: "32px" }}>
        Upload a draft for review or generate a new editable cover letter from a saved job.
      </p>

      {error && <p style={{ color: "var(--color-error, #FF6138)", fontWeight: 700 }}>{error}</p>}
      {uploadError && <p style={{ color: "#DC2626", fontWeight: 700 }}>{uploadError}</p>}
      {parsingDraft && <p style={{ color: "var(--color-subtext, #6b7280)" }}>Reading draft...</p>}

      {!draftLoaded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
            alignItems: "stretch",
          }}
        >
          <CoverLetterUploadZone
            onFileAccepted={handleDraftAccepted}
            onFileRejected={handleDraftRejected}
            disabled={parsingDraft}
          />

          <GenerateFromJobCard
            jobs={jobs}
            selectedJobId={selectedJobId}
            onJobChange={handleJobChange}
            onGenerate={handleGenerate}
            generating={generating}
          />

          <CoverLetterReviewPanel draft={draft} />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <CoverLetterReviewPanel draft={draft} />
          </div>

          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: previousDraft ? "1fr 1fr" : "1fr",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div style={{ ...panelStyle, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
                    backgroundColor: "var(--bg, #F8FAFC)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={16} style={{ color: "var(--color-subtext, #6b7280)" }} />
                    <span
                      style={{
                        color: "var(--color-heading, #003C78)",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {draftFileName || "Cover letter draft"}
                    </span>
                  </div>
                  <button
                    onClick={handleClearDraft}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      backgroundColor: "transparent",
                      color: "var(--color-subtext, #6b7280)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} /> Clear
                  </button>
                </div>

                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSaveSuccess(false);
                  }}
                  spellCheck
                  aria-label="Cover letter draft editor"
                  placeholder="Your uploaded or generated cover letter draft will appear here."
                  style={{
                    width: "100%",
                    minHeight: "500px",
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
                <div style={{ ...panelStyle, overflow: "hidden" }}>
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
                      minHeight: "500px",
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
                ...panelStyle,
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--color-heading, #003C78)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Wand2 size={16} style={{ color: "#046A97" }} />
                Improve with AI
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  value={improveInstruction}
                  onChange={(e) => setImproveInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImprove()}
                  placeholder='e.g. "Make this more concise"'
                  aria-label="Improvement instruction for AI"
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
                  disabled={
                    !selectedJobId || !draft.trim() || !improveInstruction.trim() || improving
                  }
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

            <div
              style={{
                marginTop: "16px",
                padding: "16px 20px",
                ...panelStyle,
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--color-heading, #003C78)",
                }}
              >
                Save details
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.4fr) minmax(140px, 0.7fr)",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--color-heading, #003C78)",
                    }}
                  >
                    Library title
                  </span>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Cover letter title"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      color: "var(--color-input-text, #111827)",
                      backgroundColor: "var(--color-input-bg, white)",
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--color-heading, #003C78)",
                    }}
                  >
                    Status
                  </span>
                  <select
                    value={saveStatus}
                    onChange={(e) => setSaveStatus(e.target.value)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      color: "var(--color-heading, #003C78)",
                      backgroundColor: "var(--bg-card, white)",
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--color-heading, #003C78)",
                  }}
                >
                  Tags
                </span>
                <input
                  type="text"
                  value={saveTags}
                  onChange={(e) => setSaveTags(e.target.value)}
                  placeholder="frontend, tailored, internship"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-default, #e5e7eb)",
                    color: "var(--color-input-text, #111827)",
                    backgroundColor: "var(--color-input-bg, white)",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "14px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobChange(e.target.value)}
                  aria-label="Link cover letter to a job"
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-default, #e5e7eb)",
                    backgroundColor: "var(--bg-card, white)",
                    color: "var(--color-heading, #003C78)",
                    fontSize: "14px",
                    appearance: "none",
                  }}
                >
                  <option value="">Link to a job (optional)</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} at {job.company}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "var(--color-subtext, #6b7280)",
                  }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!draft.trim() || saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: !draft.trim() || saving ? "#9ca3af" : "#003C78",
                  color: "white",
                  fontWeight: 700,
                  cursor: !draft.trim() || saving ? "not-allowed" : "pointer",
                }}
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Cover Letter"}
              </button>

              {saveSuccess && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#22c55e",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  Saved to Library
                  <Link
                    to="/library"
                    style={{ color: "#046A97", textDecoration: "underline", marginLeft: "4px" }}
                  >
                    View in Library
                  </Link>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverLetterHelper;
