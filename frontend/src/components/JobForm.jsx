import { useState, useEffect } from "react";

function JobForm({ onSubmit, initialData = null }) {
  const [form, setForm] = useState({
    company: initialData?.company || "",
    title: initialData?.title || "",
    jobPostingBody: initialData?.jobPostingBody || "",
    stage: initialData?.stage || "Interested",
  });
useEffect(() => {
  if (initialData) {
    setForm({
      company: initialData.company || "",
      title: initialData.title || "",
      jobPostingBody: initialData.jobPostingBody || "",
      stage: initialData.stage || "Interested",
    });
  }
}, [initialData]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    onSubmit(form);
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
      <input
        name="company"
        placeholder="Company"
        value={form.company}
        onChange={handleChange}
        required
        className="
  w-full
  px-3
  py-2
  rounded-md
  border
  bg-white
  text-gray-900
  dark:bg-gray-800
  dark:text-white
  dark:border-gray-700
"
      />
      <input
        name="title"
        placeholder="Job Title"
        value={form.title}
        onChange={handleChange}
        required
        className="
  w-full
  px-3
  py-2
  rounded-md
  border
  bg-white
  text-gray-900
  dark:bg-gray-800
  dark:text-white
  dark:border-gray-700
"
      />

      <textarea
        name="jobPostingBody"
        placeholder="Paste full job posting here"
        value={form.jobPostingBody}
        onChange={handleChange}
        rows={10}
        required
        className="
  w-full
  px-3
  py-2
  rounded-md
  border
  bg-white
  text-gray-900
  dark:bg-gray-800
  dark:text-white
  dark:border-gray-700
"
      />

      <select
        name="stage"
        value={form.stage}
        onChange={handleChange}
        className="
    w-full 
    px-3 
    py-2 
    rounded-md 
    border 
    bg-white 
    text-gray-900 
    dark:bg-gray-800 
    dark:text-white 
    dark:border-gray-700
    focus:outline-none 
    focus:ring-2 
    focus:ring-blue-500
  "
      >
        <option value="Interested">Interested</option>
        <option value="Applied">Applied</option>
        <option value="Interview">Interview</option>
        <option value="Offer">Offer</option>
        <option value="Rejected">Rejected</option>
        <option value="Archived">Archived</option>
      </select>

      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          border: "1px solid var(--border-color, #e5e7eb)",
          borderRadius: "12px",
          backgroundColor: "var(--bg-card, white)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="submit"
          style={{
            backgroundColor: "var(--color-heading, #003C78)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Save Job
        </button>
      </div>
    </form>
  );
}

export default JobForm;
