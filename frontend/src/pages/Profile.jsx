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
  const filled = REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length;
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

  return (
    <div
      style={{ backgroundColor: "#FDFFEA", minHeight: "100vh", padding: "24px", maxWidth: "700px" }}
    >
      <h1 style={{ color: "#003C78", marginBottom: "4px" }}>My Profile</h1>
      <p style={{ color: "#6b7280", marginBottom: "24px", fontSize: "14px" }}>
        Keep your profile up to date to get the best results.
      </p>

      {/* Completion Indicator */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          borderLeft: "4px solid #046A97",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontWeight: 600, color: "#003C78" }}>Profile Completion</span>
          <span style={{ fontWeight: 600, color: completion === 100 ? "#046A97" : "#FF6138" }}>
            {completion}%
          </span>
        </div>
        <Progress value={completion} />
        <p style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
          {completion === 100
            ? "Your profile is complete! 🎉"
            : `Fill in ${REQUIRED_FIELDS.length - REQUIRED_FIELDS.filter((f) => profile[f].trim() !== "").length} more required field(s) to complete your profile.`}
        </p>
      </div>

      {/* Identity & Contact */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          borderTop: "4px solid #003C78",
        }}
      >
        <h2 style={{ color: "#003C78", fontSize: "16px", marginBottom: "16px" }}>
          Identity & Contact
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>
              First Name *
            </label>
            <input
              name="firstName"
              value={profile.firstName}
              onChange={handleChange}
              placeholder="Jane"
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>
              Last Name *
            </label>
            <input
              name="lastName"
              value={profile.lastName}
              onChange={handleChange}
              placeholder="Doe"
              style={{
                display: "block",
                width: "100%",
                marginTop: "4px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>Email *</label>
          <input
            name="email"
            value={profile.email}
            onChange={handleChange}
            placeholder="jane@example.com"
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 500 }}>Phone</label>
          <input
            name="phone"
            value={profile.phone}
            onChange={handleChange}
            placeholder="(555) 000-0000"
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Professional Summary */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          borderTop: "4px solid #046A97",
        }}
      >
        <h2 style={{ color: "#003C78", fontSize: "16px", marginBottom: "16px" }}>
          Professional Summary *
        </h2>
        <textarea
          name="summary"
          value={profile.summary}
          onChange={handleChange}
          placeholder="Tell us about yourself and your career goals..."
          rows={5}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Save Button */}
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
        <span style={{ marginLeft: "16px", color: "#046A97", fontSize: "14px" }}>
          ✓ Profile saved!
        </span>
      )}
    </div>
  );
}

export default Profile;
