import { useState } from "react";

const Required = () => <span style={{ color: "red" }}> *</span>;

function JobForm({ onSubmit, initialData }) {
  const [form, setForm] = useState(() => ({
    company: initialData?.company ?? "",
    title: initialData?.title ?? "",
    jobPostingBody: initialData?.jobPostingBody ?? "",
    stage: initialData?.stage ?? "interested",
    applicationDeadline: initialData?.applicationDeadline ?? "",
    recruiterNotes: initialData?.recruiterNotes ?? "",
  }));

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const labelStyle = {
    fontWeight: 600,
    marginBottom: "4px",
    display: "block",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Company */}
      <div>
        <label style={labelStyle}>
          Company <Required />
        </label>
        <input
          name="company"
          value={form.company}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        />
      </div>

      {/* Title */}
      <div>
        <label style={labelStyle}>
          Job Title <Required />
        </label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>
          Job Description <Required />
        </label>
        <textarea
          name="jobPostingBody"
          value={form.jobPostingBody}
          onChange={handleChange}
          required
          rows={10}
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        />
      </div>

      {/* Stage */}
      <div>
        <label style={labelStyle}>Stage</label>
        <select
          name="stage"
          value={form.stage}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        >
          <option value="interested">Interested</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Application Deadline */}
      <div>
        <label style={labelStyle}>Application Deadline</label>
        <input
          type="date"
          name="applicationDeadline"
          value={form.applicationDeadline}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        />
      </div>

      {/* Recruiter / Contact Notes */}
      <div>
        <label style={labelStyle}>Recruiter / Contact Notes</label>
        <textarea
          name="recruiterNotes"
          value={form.recruiterNotes}
          onChange={handleChange}
          rows={4}
          placeholder="Recruiter name, email, LinkedIn, phone, notes from calls..."
          className="w-full px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700"
        />
      </div>

      {/* Submit */}
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="submit"
          style={{
            backgroundColor: "#003C78",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save Job
        </button>
      </div>
    </form>
  );
}

export default JobForm;
