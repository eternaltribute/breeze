import { useState } from "react";
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
  const filled = REQUIRED_FIELDS.filter(
    (f) => profile[f].trim() !== ""
  ).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

function Profile() {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);

  const completion = getCompletion(profile);

  const handleChange = (e) => {
    setSaved(false);
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setSaved(true);
  };

  const cardStyle = {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  return (
    <div
      style={{
        backgroundColor: "#F8FAFC",
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
    color: "#003C78",
    marginBottom: "12px",
    fontSize: "36px",
    lineHeight: "1.2",
    fontWeight: 700,
  }}
>
  My Profile
</h1>

        <p
  style={{
    color: "#6b7280",
    marginBottom: "28px",
    fontSize: "14px",
    lineHeight: "1.5",
  }}
>
  Keep your profile up to date to get the best results.
</p>

        {/* COMPLETION CARD */}
        <div
          style={{
            ...cardStyle,
            borderLeft: "4px solid #046A97",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontWeight: 600, color: "#003C78" }}>
              Profile Completion
            </span>

            <span
              style={{
                fontWeight: 600,
                color: completion === 100 ? "#046A97" : "#FF6138",
              }}
            >
              {completion}%
            </span>
          </div>

          <Progress value={completion} />

          <p style={{ marginTop: "10px", fontSize: "12px", color: "#6b7280" }}>
            {completion === 100
              ? "Your profile is complete! 🎉"
              : `Fill in ${
                  REQUIRED_FIELDS.length -
                  REQUIRED_FIELDS.filter(
                    (f) => profile[f].trim() !== ""
                  ).length
                } more required field(s) to complete your profile.`}
          </p>
        </div>

        {/* IDENTITY & CONTACT */}
        <div style={cardStyle}>
          <h2
            style={{
              color: "#003C78",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Identity & Contact
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                name="firstName"
                value={profile.firstName}
                onChange={handleChange}
                placeholder="Jane"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Last Name *</label>
              <input
                name="lastName"
                value={profile.lastName}
                onChange={handleChange}
                placeholder="Doe"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>Email *</label>
            <input
              name="email"
              value={profile.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>Phone</label>
            <input
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              placeholder="(555) 000-0000"
              style={inputStyle}
            />
          </div>
        </div>

        {/* SUMMARY */}
        <div style={cardStyle}>
          <h2
            style={{
              color: "#003C78",
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
              ...inputStyle,
              resize: "vertical",
              minHeight: "120px",
            }}
          />
        </div>

        {/* SAVE BUTTON */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={handleSave}
            style={{
              backgroundColor: "#003C78",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Profile
          </button>

          {saved && (
            <span style={{ color: "#046A97", fontSize: "14px" }}>
              ✓ Profile saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;

/* ===== Reusable styles ===== */

const labelStyle = {
  fontSize: "13px",
  color: "#374151",
  fontWeight: 500,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "4px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
  boxSizing: "border-box",
};
