import { useUser } from "@clerk/clerk-react";
import { calculateProfileCompletion } from "../utils/profileCompletion"; 

function Settings() {
  const { user } = useUser();

  const cardStyle = {
    backgroundColor: "var(--color-card-bg, white)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const labelStyle = {
    fontWeight: 600,
    color: "var(--color-heading, #003C78)",
    marginBottom: "4px",
    fontSize: "14px",
  };

  const valueStyle = {
    color: "var(--text-h, #6b7280)",
    fontSize: "14px",
    marginBottom: "12px",
  };
const { completion, missingSections } =
  calculateProfileCompletion({
    profile,
    skills,
    experiences,
    education,
    preferences,
    profileSaved,
    skillsSaved,
    experienceSaved,
    educationSaved,
    preferencesCompleted,
  });

  return (
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
        <h1
          style={{
            color: "var(--color-heading, #003C78)",
            marginBottom: "12px",
            fontSize: "40px",
            lineHeight: "1.2",
            fontWeight: 700,
          }}
        >
          Settings
        </h1>

        <p
          style={{
            color: "var(--color-subtext, #6b7280)",
            marginBottom: "28px",
            fontSize: "16px",
            lineHeight: "1.5",
          }}
        >
          Manage your account preferences and application settings.
        </p>

        {/* ACCOUNT INFORMATION — real data from Clerk */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Account Information
          </h2>
          <p style={labelStyle}>Name</p>
          <p style={valueStyle}>{user?.fullName ?? "—"}</p>
          <p style={labelStyle}>Email</p>
          <p style={valueStyle}>{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
          <p style={labelStyle}>Authentication Provider</p>
          <p style={{ ...valueStyle, marginBottom: 0 }}>Clerk</p>
        </div>

        {/* PROFILE COMPLETION — TODO: Sprint 2 GET /profile */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Profile Completion
          </h2>
          <p style={labelStyle}>Profile Status</p>
         <p style={valueStyle}>
  {completion}% Complete
</p>

<p
  style={{
    color:
      completion === 100
        ? "var(--color-accent, #046A97)"
        : "#FF6138",
    fontSize: "14px",
  }}
>
  {completion === 100
    ? "✓ Profile Complete"
    : `Missing: ${missingSections.join(", ")}`}
</p>
        </div>

        {/* DOCUMENT PREFERENCES — TODO: Sprint 2 GET /documents */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Document Preferences
          </h2>
          <p style={labelStyle}>Default Resume</p>
          {/* TODO: Sprint 2 — replace with GET /documents */}
          <p style={{ ...valueStyle, marginBottom: 0 }}>No resume uploaded yet.</p>
        </div>

        {/* SECURITY — Clerk managed, see S1-013 */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Security
          </h2>
          <p style={labelStyle}>Password Management</p>
          <p style={valueStyle}>Managed by Clerk.</p>

        </div>


      </div>
    </div>
  );
}

export default Settings;