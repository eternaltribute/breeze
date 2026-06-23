import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Progress } from "@/components/ui/progress";

const REQUIRED_FIELDS = ["firstName", "lastName", "email", "summary"];

const initialProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  summary: "",
};

function getCompletion(profile) {
  const filled = REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

function Profile() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [shaking, setShaking] = useState({});
  const [showBanner, setShowBanner] = useState(false);

  // ── Skills ──────────────────────────────────────────
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({ name: "", category: "", proficiency: "" });
  const [skillError, setSkillError] = useState("");
  const [skillsSaved, setSkillsSaved] = useState(false);

  const skillCategories = [
    {
      label: "Frontend",
      skills: ["HTML", "CSS", "JavaScript", "React", "TypeScript", "Tailwind CSS"],
    },
    { label: "Backend", skills: ["Python", "Node.js", "Java", "FastAPI", "Express", "PostgreSQL"] },
    { label: "Tools", skills: ["Git", "Docker", "GitHub Actions", "Figma", "Vite", "VS Code"] },
  ];

  const handleAddSkill = () => {
    if (!newSkill.name) return;
    if (skills.some((s) => s.name === newSkill.name)) {
      setSkillError("That skill is already in your list.");
      return;
    }
    setSkillError("");
    setSkillsSaved(false);
    setSkills([...skills, { id: Date.now(), ...newSkill }]);
    setNewSkill({ name: "", category: "", proficiency: "" });
  };

  const handleDeleteSkill = (id) => {
    setSkillsSaved(false);
    setSkills(skills.filter((s) => s.id !== id));
  };

  const handleSaveSkills = () => {
    // TODO: replace with PUT /profile/skills
    console.log("Saving skills:", skills);
    setSkillsSaved(true);
  };
  // ── Experiences ──────────────────────────────────────────
  const [experiences, setExperiences] = useState([]);
  const [experienceErrors, setExperienceErrors] = useState({});
  const [experienceSaved, setExperienceSaved] = useState(false);

  const handleAddExperience = () => {
    setExperiences([
      ...experiences,
      {
        id: crypto.randomUUID(),
        title: "",
        company: "",
        startDate: "",
        endDate: "",
        description: "",
        saved: false,
        collapsed: false,
        hasStartedEditing: false,
      },
    ]);
  };
  const validateExperience = (exp) => {
    const errors = {};

    if (!exp.title.trim()) errors.title = "Job Title is required.";
    if (!exp.company.trim()) errors.company = "Company is required.";
    if (!exp.startDate) errors.startDate = "Start date is required.";
    if (!exp.endDate) errors.endDate = "End date is required.";
    if (!exp.description.trim()) errors.description = "Description is required.";

    if (exp.startDate && exp.endDate && new Date(exp.endDate) < new Date(exp.startDate)) {
      errors.endDate = "End date cannot be earlier than start date.";
    }

    return errors;
  };
  const updateExperience = (id, field, value) => {
    setExperienceSaved(false);

    setExperiences((prev) =>
      prev.map((exp) => {
        if (exp.id !== id) return exp;

        const updated = {
          ...exp,
          [field]: value,
          hasStartedEditing: true,
        };

        const errors = validateExperience(updated);

        setExperienceErrors((prevErrors) => ({
          ...prevErrors,
          [id]: errors,
        }));

        return updated;
      })
    );
  };

  const deleteExperience = (id) => {
    setExperienceSaved(false);

    setExperiences(experiences.filter((exp) => exp.id !== id));
  };

  const moveExperienceUp = (index) => {
    if (index === 0) return;

    const copy = [...experiences];

    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];

    setExperiences(copy);
  };

  const moveExperienceDown = (index) => {
    if (index === experiences.length - 1) return;

    const copy = [...experiences];

    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];

    setExperiences(copy);
  };

  const handleSaveExperiences = () => {
    const errors = {};

    experiences.forEach((exp) => {
      const fieldErrors = {};

      if (!exp.title.trim()) {
        fieldErrors.title = "Job Title is required.";
      }

      if (!exp.company.trim()) {
        fieldErrors.company = "Company is required.";
      }

      if (!exp.startDate) {
        fieldErrors.startDate = "Start date is required.";
      }

      if (!exp.endDate) {
        fieldErrors.endDate = "End date is required.";
      }

      if (!exp.description.trim()) {
        fieldErrors.description = "Description is required.";
      }

      if (exp.startDate && exp.endDate && new Date(exp.endDate) < new Date(exp.startDate)) {
        fieldErrors.endDate = "End date cannot be earlier than start date.";
      }

      if (Object.keys(fieldErrors).length > 0) {
        errors[exp.id] = fieldErrors;
      }
    });

    setExperienceErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    console.log("Saving experiences:", experiences);
    setExperienceSaved(true);
    setExperiences(
      experiences.map((exp) => ({
        ...exp,
        saved: true,
        collapsed: true,
      }))
    );
  };

  const BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
            email: data.email ?? "",
            phone: data.phone_number ?? "",
            summary: data.professional_summary ?? "",
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    fetchProfile();
  }, [BASE, getToken]);

  const completion = getCompletion(profile);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    setSaved(false);
    const value = e.target.name === "phone" ? formatPhone(e.target.value) : e.target.value;
    setProfile({ ...profile, [e.target.name]: value });
    // clear error for this field as they type
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!profile.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!profile.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!profile.email.trim()) newErrors.email = "Email is required.";
    if (!profile.summary.trim()) newErrors.summary = "Professional summary is required.";
    const phoneDigits = profile.phone.replace(/\D/g, "");
    if (profile.phone && phoneDigits.length < 10) {
      newErrors.phone = "Please enter a complete 10-digit US phone number.";
    }
    return newErrors;
  };

  const triggerShake = (fields) => {
    const shakeMap = {};
    fields.forEach((f) => (shakeMap[f] = true));
    setShaking(shakeMap);
    setTimeout(() => setShaking({}), 600);
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShowBanner(true);
      triggerShake(Object.keys(newErrors));
      return;
    }
    setErrors({});
    setShowBanner(false);
    try {
      const token = await getToken({ skipCache: true });
      const res = await fetch(`${BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          phone_number: profile.phone || null,
          professional_summary: profile.summary || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await user.update({
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
  };

  const cardStyle = {
    backgroundColor: "var(--bg-card, white)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const getInputStyle = (field) => ({
    ...inputStyle,
    border: errors[field]
      ? "1px solid var(--color-error, #FF6138)"
      : "1px solid var(--border, #d1d5db)",
    backgroundColor: errors[field] ? "rgba(255, 97, 56, 0.05)" : "var(--color-input-bg)",
    animation: shaking[field] ? "shake 0.4s ease" : "none",
  });

  const hasOpenExperience = experiences.some((exp) => !exp.collapsed);
  const openExperience = experiences.find((exp) => !exp.collapsed);
  const canSaveExperiences =
    hasOpenExperience &&
    experiences.length > 0 &&
    experiences.every(
      (exp) =>
        exp.title.trim() &&
        exp.company.trim() &&
        exp.startDate &&
        exp.endDate &&
        exp.description.trim()
    );

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
      <div
        style={{
          backgroundColor: "var(--bg, #F8FAFC)",
          minHeight: "100vh",
          padding: "32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: "700px" }}>
          {/* HEADER */}
          <h1
            style={{
              color: "var(--color-heading, #003C78)",
              marginBottom: "12px",
              fontSize: "40px",
              lineHeight: "1.2",
              fontWeight: 700,
            }}
          >
            My Profile
          </h1>

          <p
            style={{
              color: "var(--color-subtext, #6b7280)",
              marginBottom: "28px",
              fontSize: "16px",
              lineHeight: "1.5",
            }}
          >
            Keep your profile up to date to get the best results!
          </p>

          {/* VALIDATION BANNER */}
          {showBanner && (
            <div
              style={{
                backgroundColor: "rgba(255, 97, 56, 0.08)",
                border: "1px solid var(--color-error, #FF6138)",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "24px",
                color: "var(--color-error, #FF6138)",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              * Please complete all required fields before saving.
            </div>
          )}

          {/* COMPLETION CARD */}
          <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontWeight: 600, color: "var(--color-heading, #003C78)" }}>
                Profile Completion
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    completion === 100
                      ? "var(--color-accent, #046A97)"
                      : "var(--color-error, #FF6138)",
                }}
              >
                {completion}%
              </span>
            </div>
            <Progress value={completion} />
            <p
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: "var(--color-subtext, #6b7280)",
              }}
            >
              {completion === 100
                ? "Your profile is complete! 🎉"
                : `Fill in ${
                    REQUIRED_FIELDS.length -
                    REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length
                  } more required field(s) to complete your profile.`}
            </p>
          </div>

          {/* IDENTITY & CONTACT */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Identity & Contact *
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                  style={getInputStyle("firstName")}
                />
                {errors.firstName && <p style={errorTextStyle}>{errors.firstName}</p>}
              </div>

              <div>
                <label style={labelStyle}>Last Name *</label>
                <input
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  style={getInputStyle("lastName")}
                />
                {errors.lastName && <p style={errorTextStyle}>{errors.lastName}</p>}
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Email *</label>
              <input
                name="email"
                value={profile.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                style={getInputStyle("email")}
              />
              {errors.email && <p style={errorTextStyle}>{errors.email}</p>}
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={labelStyle}>Phone</label>

              <div
                style={{
                  position: "relative",
                  marginTop: "4px",
                }}
              >
                <input
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  placeholder="(000) 000-0000"
                  style={{
                    ...getInputStyle("phone"),
                    paddingLeft: "12px",
                  }}
                />
              </div>

              {errors.phone && <p style={errorTextStyle}>{errors.phone}</p>}
            </div>

            {/* Divider */}
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border)",
                margin: "24px 0",
              }}
            />
            {/* SUMMARY */}
            <div>
              <h2
                style={{
                  color: "var(--color-heading, #003C78)",
                  fontSize: "16px",
                  marginBottom: "16px",
                }}
              >
                Professional Summary *
              </h2>
              <textarea
                name="summary"
                value={profile.summary}
                onChange={handleChange}
                placeholder="Tell us about yourself and your career goals..."
                rows={5}
                style={{
                  ...getInputStyle("summary"),
                  resize: "vertical",
                  minHeight: "120px",
                }}
              />
              {errors.summary && <p style={errorTextStyle}>{errors.summary}</p>}
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={handleSave}
                style={{
                  backgroundColor: "var(--brand-deep, #003C78)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Profile Information
              </button>

              {saved && (
                <span
                  style={{
                    color: "#22c55e",
                    fontSize: "13px",
                  }}
                >
                  ✓ Profile information saved!
                </span>
              )}
            </div>
          </div>

          {/* SKILLS */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Skills
            </h2>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              <select
                value={newSkill.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const cat = skillCategories.find((c) => c.skills.includes(val))?.label ?? "";
                  setNewSkill({ ...newSkill, name: val, category: cat });
                }}
                style={inputStyle}
              >
                <option value="">Select a skill...</option>
                {skillCategories.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.skills.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <select
                value={newSkill.proficiency}
                onChange={(e) => setNewSkill({ ...newSkill, proficiency: e.target.value })}
                style={{ ...inputStyle, maxWidth: "180px" }}
              >
                <option value="">Proficiency...</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <button
                onClick={handleAddSkill}
                disabled={!newSkill.name || !newSkill.proficiency}
                style={{
                  backgroundColor:
                    !newSkill.name || !newSkill.proficiency
                      ? "var(--color-border-default, #d1d5db)"
                      : "var(--brand-deep, #003C78)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: !newSkill.name || !newSkill.proficiency ? "not-allowed" : "pointer",
                  opacity: !newSkill.name || !newSkill.proficiency ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                + Add
              </button>
            </div>

            {skillError && (
              <p
                style={{
                  color: "var(--color-error, #FF6138)",
                  fontSize: "13px",
                  marginBottom: "12px",
                }}
              >
                {skillError}
              </p>
            )}

            {skills.length === 0 ? (
              <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "14px" }}>
                No skills added yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #d1d5db)",
                      backgroundColor: "var(--bg, #F8FAFC)",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{skill.name}</span>
                      {skill.category && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--color-subtext, #6b7280)",
                            marginLeft: "8px",
                          }}
                        >
                          {skill.category}
                        </span>
                      )}
                      {skill.proficiency && (
                        <span
                          style={{
                            fontSize: "12px",
                            marginLeft: "8px",
                            padding: "2px 8px",
                            borderRadius: "20px",
                            backgroundColor: "var(--color-accent, #046A97)",
                            color: "white",
                          }}
                        >
                          {skill.proficiency}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSkill(skill.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-error, #FF6138)",
                        fontSize: "18px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "16px" }}>
              <button
                onClick={handleSaveSkills}
                style={{
                  backgroundColor: "var(--brand-deep, #003C78)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save Skills
              </button>
              {skillsSaved && (
                <span style={{ color: "var(--color-accent, #046A97)", fontSize: "14px" }}>
                  ✓ Skills saved!
                </span>
              )}
            </div>
          </div>

          {/* EXPERIENCE */}
          <div
            style={{
              ...cardStyle,
              borderLeft: "4px solid var(--section-border)",
            }}
          >
            <h2
              style={{
                color: "var(--color-heading, #003C78)",
                fontSize: "16px",
                marginBottom: "16px",
              }}
            >
              Experience
            </h2>

            <button
              onClick={handleAddExperience}
              disabled={hasOpenExperience}
              style={{
                backgroundColor: hasOpenExperience
                  ? "var(--color-border-default, #d1d5db)"
                  : "var(--brand-deep, #003C78)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                cursor: hasOpenExperience ? "not-allowed" : "pointer",
                opacity: hasOpenExperience ? 0.7 : 1,
                marginBottom: "16px",
              }}
            >
              + Add Experience
            </button>
            {hasOpenExperience && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-subtext)",
                  marginBottom: "12px",
                }}
              >
                Save or finish editing the current experience before adding another.
              </p>
            )}
            {experiences.length === 0 ? (
              <p
                style={{
                  color: "var(--color-subtext, #6b7280)",
                }}
              >
                No experience entries yet.
              </p>
            ) : (
              experiences.map((exp, index) => {
                return (
                  <div key={exp.id}>
                    {" "}
                    {exp.collapsed ? (
                      <div
                        style={{
                          border: "2px solid #f59e0b",
                          borderRadius: "10px",
                          padding: "16px",
                          marginBottom: "16px",
                          backgroundColor: "var(--color-card-bg)",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            color: "var(--color-heading)",
                            fontSize: "18px",
                          }}
                        >
                          {exp.title || "Untitled Position"}
                        </h3>

                        <p
                          style={{
                            marginTop: "4px",
                            color: "var(--color-subtext)",
                          }}
                        >
                          {exp.company}
                        </p>
                        {exp.saved && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: "6px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              backgroundColor: "#22c55e",
                              color: "white",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Saved
                          </span>
                        )}
                        <p
                          style={{
                            marginTop: "4px",
                            color: "var(--color-subtext)",
                            fontSize: "14px",
                          }}
                        >
                          {exp.startDate} – {exp.endDate}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "12px",
                          }}
                        >
                          {" "}
                          <button
                            onClick={() => moveExperienceUp(index)}
                            style={{
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              width: "40px",
                              height: "40px",
                              cursor: "pointer",
                            }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveExperienceDown(index)}
                            style={{
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              width: "40px",
                              height: "40px",
                              cursor: "pointer",
                            }}
                          >
                            ▼
                          </button>
                          <button
                            disabled={!!openExperience}
                            onClick={() => {
                              setExperienceSaved(false);
                              updateExperience(exp.id, "collapsed", false);
                            }}
                            style={{
                              backgroundColor: !openExperience ? "#94a3b8" : "var(--brand-deep)",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              padding: "8px 14px",
                              cursor: !openExperience ? "not-allowed" : "pointer",
                              opacity: !openExperience ? 0.7 : 1,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteExperience(exp.id)}
                            style={{
                              backgroundColor: "#FF6138",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              padding: "8px 14px",
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          border: "2px solid #f59e0b",
                          borderRadius: "10px",
                          padding: "16px",
                          marginBottom: "16px",
                          backgroundColor: "var(--color-card-bg)",
                        }}
                      >
                        <label style={labelStyle}>Job Title *</label>
                        <input
                          placeholder="Job Title"
                          value={exp.title}
                          onChange={(e) => updateExperience(exp.id, "title", e.target.value)}
                          style={inputStyle}
                        />

                        {exp.hasStartedEditing && experienceErrors[exp.id]?.title && (
                          <p style={errorTextStyle}>{experienceErrors[exp.id].title}</p>
                        )}
                        <label style={labelStyle}>Company *</label>
                        <input
                          placeholder="Company"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                          style={inputStyle}
                        />

                        {exp.hasStartedEditing && experienceErrors[exp.id]?.company && (
                          <p style={errorTextStyle}>{experienceErrors[exp.id].company}</p>
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "16px",
                            marginTop: "12px",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                display: "block",
                                marginBottom: "6px",
                              }}
                            >
                              Start Date *
                            </label>
                            <input
                              type="date"
                              value={exp.startDate}
                              onChange={(e) =>
                                updateExperience(exp.id, "startDate", e.target.value)
                              }
                              style={inputStyle}
                            />
                            {exp.hasStartedEditing && experienceErrors[exp.id]?.startDate && (
                              <p style={errorTextStyle}>{experienceErrors[exp.id].startDate}</p>
                            )}
                          </div>

                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                display: "block",
                                marginBottom: "6px",
                              }}
                            >
                              End Date *
                            </label>

                            <input
                              type="date"
                              value={exp.endDate}
                              onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
                              style={inputStyle}
                            />
                            {exp.hasStartedEditing && experienceErrors[exp.id]?.endDate && (
                              <p style={errorTextStyle}>{experienceErrors[exp.id].endDate}</p>
                            )}
                          </div>
                        </div>

                        <label style={labelStyle}>Describe your responsibilities *</label>
                        <textarea
                          value={exp.description}
                          onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                          rows={4}
                          style={{
                            ...inputStyle,
                            marginTop: "10px",
                          }}
                        />
                        {exp.hasStartedEditing && experienceErrors[exp.id]?.description && (
                          <p style={errorTextStyle}>{experienceErrors[exp.id].description}</p>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => deleteExperience(exp.id)}
                            style={{
                              backgroundColor: "#FF6138",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              padding: "10px 16px",
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={handleSaveExperiences}
                disabled={!canSaveExperiences}
                style={{
                  backgroundColor: canSaveExperiences
                    ? "var(--brand-deep, #003C78)"
                    : "var(--color-border-default, #d1d5db)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  cursor: canSaveExperiences ? "pointer" : "not-allowed",
                  opacity: canSaveExperiences ? 1 : 0.7,
                }}
              >
                Save Experience
              </button>
              {!canSaveExperiences && experiences.length > 0 && (
                <p
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "var(--color-subtext)",
                  }}
                >
                  Complete all experience fields before saving.
                </p>
              )}

              {experienceSaved && !hasOpenExperience && (
                <span
                  style={{
                    marginLeft: "12px",
                    color: "#22c55e",
                  }}
                >
                  ✓ Experience saved!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Profile;

/* ===== Reusable styles ===== */

const labelStyle = {
  fontSize: "13px",
  color: "var(--color-label, #cbd5e1)",
  fontWeight: 500,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  boxSizing: "border-box",

  backgroundColor: "var(--color-input-bg)",
  color: "var(--color-input-text)",
};

const errorTextStyle = {
  color: "var(--color-error, #FF6138)",
  fontSize: "12px",
  marginTop: "4px",
};
