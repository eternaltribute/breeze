import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { calculateProfileCompletion } from "../utils/profileCompletion";

function Settings() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [completion, setCompletion] = useState(0);
  const [missingSections, setMissingSections] = useState([]);
  const BASE = import.meta.env.VITE_API_BASE_URL;
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const token = await getToken({ skipCache: true });

        const [profileRes, skillsRes, experiencesRes, educationRes, preferencesRes] =
          await Promise.all([
            fetch(`${BASE}/auth/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${BASE}/profile/skills`, {
              headers: { Authorization: `Bearer ${token}` },
            }),

            // Future backend routes
            fetch(`${BASE}/profile/experiences`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${BASE}/profile/education`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${BASE}/profile/preferences`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        if (!profileRes.ok) {
          throw new Error("Failed to load profile");
        }

        const profileData = await profileRes.json();
        const skillsData = skillsRes.ok ? await skillsRes.json() : [];
        const experiencesData = experiencesRes.ok ? await experiencesRes.json() : [];
        const educationData = educationRes.ok ? await educationRes.json() : [];
        const preferencesData = preferencesRes.ok ? await preferencesRes.json() : {};

        const rawPreferences =
          preferencesData.preferences ?? preferencesData.preference ?? preferencesData ?? {};

        const result = calculateProfileCompletion({
          profile: {
            firstName: profileData.first_name ?? "",
            lastName: profileData.last_name ?? "",
            email: profileData.email ?? "",
            phone: profileData.phone_number ?? "",
            summary: profileData.professional_summary ?? "",
          },
          skills: skillsData || [],
          experiences: experiencesData || [],
          education: educationData || [],
          preferences: {
            targetRole:
              rawPreferences.desired_role ??
              rawPreferences.target_role ??
              rawPreferences.targetRole ??
              "",

            locationPreference:
              rawPreferences.desired_location ??
              rawPreferences.location_preference ??
              rawPreferences.locationPreference ??
              "",

            workMode:
              rawPreferences.location_type ??
              rawPreferences.work_mode ??
              rawPreferences.workMode ??
              "",

            salaryPreference:
              rawPreferences.desired_salary ??
              rawPreferences.salary_preference ??
              rawPreferences.salaryPreference ??
              "",
          },
        });

        setCompletion(result.completion);
        setMissingSections(result.missingSections);
      } catch (err) {
        console.error("Failed to load completion:", err);
      }
    };

    fetchProfileData();
  }, [BASE, getToken]);

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

        {/* PROFILE COMPLETION */}
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
          <p
            style={{
              ...valueStyle,
              fontWeight: 600,
              color: "var(--color-heading, #003C78)",
            }}
          >
            {completion}% complete
          </p>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "#E5E7EB",
              borderRadius: "999px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: `${completion}%`,
                height: "100%",
                backgroundColor: "var(--color-accent, #046A97)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <p
            style={{
              color: completion === 100 ? "var(--color-accent, #046A97)" : "#FF6138",
              fontSize: "14px",
            }}
          >
            {completion === 100
              ? "✓ Profile Complete"
              : missingSections.length > 0
                ? `Missing: ${missingSections.join(", ")}`
                : "Profile completion is still loading"}
          </p>
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
