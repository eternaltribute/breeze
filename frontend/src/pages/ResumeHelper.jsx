// src/pages/ResumeHelper.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Resume Helper page — S2-021, S2-022, S2-023, S2-024
//
// Business rules satisfied:
//   S2-BR-018  AI drafting must be triggered by explicit user action
//   S2-BR-019  AI resume drafts must use profile + job context inputs
//   S2-BR-020  Generated output is editable before save
//   S2-BR-021  Job-context save operations must preserve ownership boundaries
//
// Layout:
//   Left panel  — upload zone + editable resume text area + improve action
//   Right panel — AI score ring + 5 metric bars + suggestions list
//
// AI calls — ALL go through Ronald's FastAPI backend. Never call Anthropic directly.
// The Anthropic API key lives in backend environment variables only.
//
// Supported upload formats: PDF, DOCX, and TXT.
//   - DOCX is parsed client-side with mammoth (no backend call needed).
//   - TXT is read directly client-side via the browser's built-in file.text()
//     — plain text doesn't need any parsing library, it's already just text.
//   - PDF still requires a backend call (see TODO below) since PDF binary
//     format can't be read as plain text in the browser.
//
// TODOs for Ronald:
//   POST /resume/analyze  — accepts { resume_text: string, job_id?: string }
//                           returns  {
//                             score: number,           // 0-100 overall
//                             metrics: {               // 5 category scores, each 0-20
//                               contact_info: number,
//                               summary: number,
//                               experience: number,
//                               skills: number,
//                               length: number
//                             },
//                             feedback: [{ section: string, tip: string }]
//                           }
//   POST /resume/improve  — accepts { resume_text: string, instruction: string }
//                           returns  { improved_text: string }
//   POST /resume/save     — accepts { resume_text: string, job_id?: string }
//                           returns  { document_id: string }
//   POST /resume/parse-pdf — accepts multipart form with the PDF file
//                            returns { text: string }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@clerk/clerk-react";
import {
  Upload,
  Download,
  Save,
  Sparkles,
  Brain,
  FileText,
  X,
  ChevronDown,
  Wand2,
} from "lucide-react";
import mammoth from "mammoth";

// ── API base URL — same pattern used across all pages (Analytics, Dashboard, etc.) ──
const BASE = import.meta.env.VITE_API_BASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// ScoreRing — circular SVG progress indicator showing the overall resume score
// Analogy: like the speedometer on a car — one number that summarizes everything
// ─────────────────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius; // total path length of the circle
  const filled = ((score ?? 0) / 100) * circumference; // how much arc to color in
  const empty = circumference - filled;

  // Color changes based on score: green = good, orange = ok, red = needs work
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#FF6138" : "#DC2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Gray background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-border-default, #e5e7eb)"
          strokeWidth="10"
        />
        {/* Colored progress arc — starts at top (rotate -90deg) */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${empty}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Score number in the center */}
        <text
          x="50"
          y="54"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="var(--color-heading, #003C78)"
        >
          {score ?? "--"}
        </text>
      </svg>
      <p style={{ fontSize: "12px", color: "var(--color-subtext, #6b7280)", margin: 0 }}>
        Resume Score
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricBar — one row showing a category name + a colored progress bar + score
// Analogy: like a report card row — "Math: ████████░░ 16/20"
// ─────────────────────────────────────────────────────────────────────────────
function MetricBar({ label, score, max = 20 }) {
  const pct = Math.round((score / max) * 100); // convert to percentage for the bar width
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#FF6138" : "#DC2626";

  return (
    <div style={{ marginBottom: "14px" }}>
      {/* Label row: category name on left, score fraction on right */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "13px", color: "var(--color-heading, #003C78)", fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: "12px", color: "var(--color-subtext, #6b7280)", fontWeight: 600 }}>
          {score}/{max}
        </span>
      </div>
      {/* Progress bar track */}
      <div
        style={{
          height: "6px",
          borderRadius: "999px",
          backgroundColor: "var(--color-border-default, #e5e7eb)",
          overflow: "hidden",
        }}
      >
        {/* Filled portion — width driven by pct */}
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: "999px",
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackItem — one AI suggestion card in the right panel
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackItem({ section, tip }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "8px",
        marginBottom: "10px",
        border: "1px solid var(--color-border-default, #e5e7eb)",
        backgroundColor: "var(--bg, #F8FAFC)",
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--color-heading, #003C78)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {section}
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--color-subtext, #6b7280)" }}>{tip}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadZone — drag-and-drop file upload area
// Analogy: the physical inbox tray on a desk — you drop your document in here
// Uses react-dropzone which handles all the browser drag-and-drop events for us
//
// S2-011-adjacent change: now accepts .txt in addition to PDF and DOCX.
// ─────────────────────────────────────────────────────────────────────────────
function UploadZone({ onFileAccepted }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      // PDF, DOCX, and TXT are accepted (PDF/DOCX per PRD §4.4; TXT added
      // since it's trivial to read in the browser and gives users a fast
      // path when they already have a plain-text resume).
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    onDropAccepted: (files) => onFileAccepted(files[0]),
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${isDragActive ? "#003C78" : "var(--color-border-default, #e5e7eb)"}`,
        borderRadius: "12px",
        padding: "48px 24px",
        textAlign: "center",
        cursor: "pointer",
        backgroundColor: isDragActive ? "var(--brand-ocean-muted, #EFF6FF)" : "var(--bg, #F8FAFC)",
        transition: "all 0.2s ease",
      }}
    >
      <input {...getInputProps()} />
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
          fontWeight: 600,
          color: "var(--color-heading, #003C78)",
        }}
      >
        {isDragActive ? "Drop your resume here" : "Upload your resume"}
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--color-subtext, #6b7280)" }}>
        Drag and drop, or click to browse — PDF, DOCX, or TXT
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResumeHelper — main page component
// Covers tickets: S2-021 (analyze), S2-023 (improve), S2-024 (save)
// ─────────────────────────────────────────────────────────────────────────────
function ResumeHelper() {
  const [uploadedFile, setUploadedFile] = useState(null);

  const { getToken } = useAuth(); // Clerk auth — same hook used in Analytics.jsx

  // ── State ──────────────────────────────────────────────────────────────────
  const [resumeText, setResumeText] = useState(""); // editable resume content
  const [fileName, setFileName] = useState(""); // name of uploaded file
  const [aiScore, setAiScore] = useState(null); // overall 0-100 score from backend
  const [metrics, setMetrics] = useState(null); // { contact_info, summary, experience, skills, length }
  const [feedback, setFeedback] = useState([]); // [{ section, tip }] from backend
  const [analyzing, setAnalyzing] = useState(false); // loading state for analyze call
  const [improving, setImproving] = useState(false); // loading state for improve call
  const [saving, setSaving] = useState(false); // loading state for save call
  const [improveInstruction, setImproveInstruction] = useState(""); // what the user wants improved
  const [jobs, setJobs] = useState([]); // user's job list for the link dropdown
  const [selectedJobId, setSelectedJobId] = useState(""); // job to link this resume to
  const [saveSuccess, setSaveSuccess] = useState(false); // brief success confirmation

  // ── Fetch user's jobs on mount ─────────────────────────────────────────────
  // Lets the user link this resume to a specific job application (S2-024)
  // Same fetch pattern as Analytics.jsx: Clerk token → FastAPI → return data
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setJobs(await res.json());
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
      }
    };
    fetchJobs();
  }, [getToken]);

  // ── Handle file upload ─────────────────────────────────────────────────────
  // When a file is dropped, read it and extract the text so we can display it
  //
  // Three branches now: .docx (mammoth), .txt (built-in file.text()), .pdf
  // (needs backend — browsers can't read PDF binary as plain text).
  const handleFileAccepted = useCallback(async (file) => {
    setFileName(file.name);
    setUploadedFile(file);
    setAiScore(null); // reset AI results when a new file comes in
    setMetrics(null);
    setFeedback([]);

    if (file.name.endsWith(".docx")) {
      // mammoth converts DOCX binary format into plain text
      // Analogy: mammoth is like a translator that reads Word files and gives us the words
      const arrayBuffer = await file.arrayBuffer(); // read raw file bytes into memory
      const result = await mammoth.extractRawText({ arrayBuffer });
      setResumeText(result.value);
    } else if (file.name.endsWith(".txt")) {
      // Plain text files don't need any parsing/translation — they're
      // already just words. file.text() is a built-in browser method that
      // reads the file's raw bytes straight into a string. No library needed.
      const text = await file.text();
      setResumeText(text);
    } else if (file.name.endsWith(".pdf")) {
      // PDF text extraction needs a backend call — mammoth only handles DOCX,
      // and there's no built-in browser equivalent for PDF binary like there
      // is for plain text.
      // TODO (Ronald): implement POST /resume/parse-pdf
      //   accepts: multipart form with the PDF file
      //   returns: { text: string }
      setResumeText(
        "PDF text extraction requires the backend endpoint.\n\n" +
          "For now, please paste your resume text directly into this editor.\n\n" +
          "Ronald: TODO — POST /resume/parse-pdf"
      );
    }
  }, []);

  // ── Clear everything ───────────────────────────────────────────────────────
  const handleClear = () => {
    setResumeText("");
    setFileName("");
    setUploadedFile(null);
    setAiScore(null);
    setMetrics(null);
    setFeedback([]);
    setSaveSuccess(false);
    setImproveInstruction("");
  };

  // ── S2-021: Analyze resume ─────────────────────────────────────────────────
  // Sends resume text to Ronald's backend → backend calls Anthropic → returns score + metrics + feedback
  // The Anthropic API key is NEVER here — it lives only in the backend environment variables
  //
  // TODO (Ronald): implement POST /resume/analyze
  //   Request:  { resume_text: string, job_id?: string }
  //   Response: {
  //     score: number,
  //     metrics: { contact_info: number, summary: number, experience: number, skills: number, length: number },
  //     feedback: [{ section: string, tip: string }]
  //   }
  const handleAnalyze = async () => {
    if (!resumeText.trim()) return;
    setAnalyzing(true);
    try {
      const token = await getToken({ skipCache: true });

      // ── Uncomment this block once Ronald's endpoint is ready ──────────────
      // const res = await fetch(`${BASE}/resume/analyze`, {
      //   method: "POST",
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     resume_text: resumeText,
      //     job_id: selectedJobId || null,
      //   }),
      // });
      // const data = await res.json();
      // setAiScore(data.score);
      // setMetrics(data.metrics);
      // setFeedback(data.feedback);
      // ── End real call ─────────────────────────────────────────────────────

      // ── TEMPORARY placeholder — remove once Ronald's endpoint is live ─────
      // This lets the UI be demonstrated and tested before the backend is ready
      console.log("Auth token ready for POST /resume/analyze:", !!token);
      await new Promise((r) => setTimeout(r, 1200)); // simulate network delay
      setAiScore(72);
      setMetrics({
        contact_info: 18, // 18/20 — has name, email, phone, LinkedIn
        summary: 10, // 10/20 — summary exists but is too short
        experience: 16, // 16/20 — good bullets but lacks some numbers
        skills: 8, // 8/20  — no dedicated skills section found
        length: 20, // 20/20 — resume is exactly one page
      });
      setFeedback([
        {
          section: "Skills",
          tip: "Add a dedicated Skills section. ATS systems scan for keyword lists.",
        },
        {
          section: "Summary",
          tip: "Expand your summary to 2-3 sentences covering your role, years of experience, and top strength.",
        },
        {
          section: "Experience",
          tip: "Quantify your bullet points — 'increased efficiency by 30%' beats 'improved efficiency'.",
        },
      ]);
      // ── End placeholder ───────────────────────────────────────────────────
    } catch (err) {
      console.error("Resume analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── S2-023: Improve / rewrite resume text ─────────────────────────────────
  // Sends the current resume text + a user instruction to Ronald's backend.
  // Backend calls Anthropic, gets improved text, returns it here for the user to review.
  // User sees the result in the editor and can accept, edit, or discard it. (S2-BR-020)
  //
  // TODO (Ronald): implement POST /resume/improve
  //   Request:  { resume_text: string, instruction: string }
  //   Response: { improved_text: string }
  const handleImprove = async () => {
    if (!resumeText.trim() || !improveInstruction.trim()) return;
    setImproving(true);
    try {
      const token = await getToken({ skipCache: true });

      // ── Uncomment once Ronald's endpoint is ready ─────────────────────────
      // const res = await fetch(`${BASE}/resume/improve`, {
      //   method: "POST",
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     resume_text: resumeText,
      //     instruction: improveInstruction,
      //   }),
      // });
      // const data = await res.json();
      // setResumeText(data.improved_text); // replace editor content with improved version
      // ── End real call ─────────────────────────────────────────────────────

      // ── TEMPORARY placeholder ─────────────────────────────────────────────
      console.log("Auth token ready for POST /resume/improve:", !!token);
      console.log("Instruction:", improveInstruction);
      await new Promise((r) => setTimeout(r, 1000));
      // Prepend a note so the user can see the "improvement" happened
      setResumeText(`[AI improved: "${improveInstruction}"]\n\n` + resumeText);
      setImproveInstruction(""); // clear the instruction box after success
      // ── End placeholder ───────────────────────────────────────────────────
    } catch (err) {
      console.error("Resume improve failed:", err);
    } finally {
      setImproving(false);
    }
  };

  // ── S2-024: Save resume as a document linked to a job ─────────────────────
  // Saves the current resume text as a Document record in the database,
  // optionally linked to a specific job application.
  //
  // TODO (Ronald): implement POST /resume/save
  //   Request:  { resume_text: string, job_id?: string }
  //   Response: { document_id: string }
  const handleSave = async () => {
    if (!resumeText.trim()) return;
    setSaving(true);
    try {
      const token = await getToken({ skipCache: true });

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("resume_text", resumeText);
      if (selectedJobId) formData.append("job_id", selectedJobId);

      const res = await fetch(`${BASE}/resume/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Save failed");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // ── Uncomment once Ronald's endpoint is ready ─────────────────────────
      // const res = await fetch(`${BASE}/resume/save`, {
      //   method: "POST",
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     resume_text: resumeText,
      //     job_id: selectedJobId || null,
      //   }),
      // });
      // if (res.ok) {
      //   setSaveSuccess(true);
      //   setTimeout(() => setSaveSuccess(false), 3000);
      // }
      // ── End real call ─────────────────────────────────────────────────────

      // ── TEMPORARY placeholder ─────────────────────────────────────────────
      //console.log("Auth token ready for POST /resume/save:", !!token);
      //await new Promise((r) => setTimeout(r, 800));
      //setSaveSuccess(true);
      //setTimeout(() => setSaveSuccess(false), 3000);
      // ── End placeholder ───────────────────────────────────────────────────
    } catch (err) {
      console.error("Resume save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Download as .txt ───────────────────────────────────────────────────────
  // Creates a local download from the editor content.
  // Full PDF export is Sprint 3 scope — requires backend rendering.
  const handleDownload = () => {
    if (!resumeText.trim()) return;
    const blob = new Blob([resumeText], { type: "text/plain" });
    const url = URL.createObjectURL(blob); // temporary browser download URL
    const a = document.createElement("a"); // invisible link element
    a.href = url;
    a.download = fileName ? fileName.replace(/\.(pdf|docx|txt)$/i, ".txt") : "resume.txt";
    a.click();
    URL.revokeObjectURL(url); // clean up memory after download triggers
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
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
      {/* Page header */}
      <h1
        style={{
          color: "var(--color-heading, #003C78)",
          fontSize: "40px",
          fontWeight: 700,
          marginBottom: "8px",
          lineHeight: 1.2,
        }}
      >
        Resume Helper
      </h1>
      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "16px", marginBottom: "32px" }}>
        Upload your resume, get AI feedback and a score, improve sections, then save to a job.
      </p>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* ── LEFT: Upload zone + editor + improve action ──────────────────── */}
        <div>
          {!resumeText ? (
            <UploadZone onFileAccepted={handleFileAccepted} />
          ) : (
            <>
              {/* Editor card */}
              <div
                style={{
                  backgroundColor: "var(--bg-card, #fff)",
                  border: "1px solid var(--color-border-default, #e5e7eb)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "var(--shadow)",
                }}
              >
                {/* Toolbar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--color-border-default, #e5e7eb)",
                    backgroundColor: "var(--bg, #F8FAFC)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={16} style={{ color: "var(--color-subtext, #6b7280)" }} />
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--color-heading, #003C78)",
                      }}
                    >
                      {fileName || "resume.txt"}
                    </span>
                  </div>
                  <button
                    onClick={handleClear}
                    style={{
                      display: "flex",
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

                {/* Editable resume text area — S2-BR-020: output is editable before save */}
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  spellCheck
                  aria-label="Resume content editor"
                  style={{
                    width: "100%",
                    minHeight: "500px",
                    padding: "24px",
                    border: "none",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    lineHeight: 1.7,
                    color: "var(--color-heading, #003C78)",
                    backgroundColor: "var(--bg-card, #fff)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* ── S2-023: Improve section ───────────────────────────────── */}
              {/* User types an instruction, clicks Improve, AI rewrites the resume */}
              {/* Result appears in the editor above — user can then edit or discard it */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border-default, #e5e7eb)",
                  backgroundColor: "var(--bg-card, #fff)",
                  boxShadow: "var(--shadow)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--color-heading, #003C78)",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Brain size={16} style={{ color: "#046A97" }} />
                    <Sparkles size={13} style={{ color: "#046A97" }} />
                    Improve with AI
                  </span>
                </p>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "12px",
                    color: "var(--color-subtext, #6b7280)",
                  }}
                >
                  Tell the AI what to fix — it rewrites your resume and you can edit the result
                  before saving.
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  {/* Instruction input — what should the AI do? */}
                  <input
                    type="text"
                    value={improveInstruction}
                    onChange={(e) => setImproveInstruction(e.target.value)}
                    placeholder='e.g. "Make my bullet points more concise" or "Add more action verbs"'
                    aria-label="Improvement instruction for AI"
                    onKeyDown={(e) => e.key === "Enter" && handleImprove()}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      fontSize: "13px",
                      color: "var(--color-input-text, #111827)",
                      backgroundColor: "var(--color-input-bg, white)",
                      outline: "none",
                    }}
                  />
                  {/* Improve button — triggers POST /resume/improve */}
                  <button
                    onClick={handleImprove}
                    disabled={improving || !improveInstruction.trim()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor:
                        improving || !improveInstruction.trim() ? "#9ca3af" : "#046A97",
                      color: "white",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: improving || !improveInstruction.trim() ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Wand2 size={14} />
                    {improving ? "Improving..." : "Improve"}
                  </button>
                </div>
              </div>

              {/* ── Action row: job link + download + save ────────────────── */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "14px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* Job link dropdown — S2-024: link resume to a specific application */}
                <div style={{ position: "relative", flex: "1", minWidth: "200px" }}>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    aria-label="Link resume to a job application"
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      backgroundColor: "var(--bg-card, #fff)",
                      color: "var(--color-heading, #003C78)",
                      fontSize: "14px",
                      cursor: "pointer",
                      appearance: "none",
                    }}
                  >
                    <option value="">Link to a job (optional)</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} — {job.company}
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

                {/* Download as .txt */}
                <button
                  onClick={handleDownload}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border-default, #e5e7eb)",
                    backgroundColor: "transparent",
                    color: "var(--color-heading, #003C78)",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={16} /> Download .txt
                </button>

                {/* Save to backend — S2-024 */}
                <button
                  onClick={handleSave}
                  disabled={saving} //|| resumeText.trim() || !uploadedFile}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: saving ? "#9ca3af" : "#003C78",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Resume"}
                </button>

                {/* Brief success message after save */}
                {saveSuccess && (
                  <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: 600 }}>
                    ✓ Saved successfully
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: AI Review panel ───────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: "var(--bg-card, #fff)",
            border: "1px solid var(--color-border-default, #e5e7eb)",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "var(--shadow)",
            position: "sticky",
            top: "24px", // stays on screen as user scrolls editor
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--color-heading, #003C78)",
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            AI Review
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-subtext, #6b7280)",
              marginBottom: "20px",
            }}
          >
            Upload a resume then click Analyze to get your score.
          </p>

          {/* Overall score ring — shown after analysis */}
          {aiScore !== null && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <ScoreRing score={aiScore} />
            </div>
          )}

          {/* Analyze button — S2-021, triggers POST /resume/analyze */}
          <button
            onClick={handleAnalyze}
            disabled={!resumeText || analyzing}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: !resumeText || analyzing ? "#9ca3af" : "#046A97",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: !resumeText || analyzing ? "not-allowed" : "pointer",
              marginBottom: "20px",
              transition: "background-color 0.2s",
            }}
          >
            <Sparkles size={16} />
            {analyzing ? "Analyzing..." : "Analyze Resume"}
          </button>

          {/* ── 5 metric bars — shown after analysis returns metrics ───────── */}
          {/* Each metric is scored 0-20, they add up to 100 total */}
          {/* These values come from Ronald's POST /resume/analyze response */}
          {metrics && (
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-subtext, #6b7280)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "14px",
                }}
              >
                Score Breakdown
              </p>
              {/* Contact Info: does it have name, email, phone, LinkedIn? */}
              <MetricBar label="Contact Info" score={metrics.contact_info} />
              {/* Summary: is there a professional summary at the top? */}
              <MetricBar label="Summary" score={metrics.summary} />
              {/* Experience: are bullet points strong and quantified? */}
              <MetricBar label="Experience" score={metrics.experience} />
              {/* Skills: is there a dedicated skills / keywords section? */}
              <MetricBar label="Skills" score={metrics.skills} />
              {/* Length: is the resume an appropriate length for experience level? */}
              <MetricBar label="Length" score={metrics.length} />
            </div>
          )}

          {/* AI suggestions list */}
          {feedback.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-subtext, #6b7280)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}
              >
                Suggestions
              </p>
              {feedback.map((item, i) => (
                <FeedbackItem key={i} section={item.section} tip={item.tip} />
              ))}
            </div>
          )}

          {/* Empty state — before any file is uploaded */}
          {!resumeText && !analyzing && (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                color: "var(--color-subtext, #9ca3af)",
              }}
            >
              <FileText size={32} style={{ marginBottom: "8px", opacity: 0.4 }} />
              <p style={{ fontSize: "13px", margin: 0 }}>Upload a resume to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResumeHelper;
