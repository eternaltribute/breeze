import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Camera, FileText, Save, Trash2 } from "lucide-react";
import { calculateProfileCompletion } from "../utils/profileCompletion";
import { deleteProfilePhoto, fetchProfilePhoto, uploadProfilePhoto } from "../utils/profilePhoto";

const SETTINGS_STORAGE_KEY = "breeze:user-preferences";

const defaultPreferences = {
  documents: {
    showJobCardIndicators: true,
  },
};

const loadStoredPreferences = () => {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return defaultPreferences;

    const parsed = JSON.parse(stored);
    return {
      documents: {
        ...defaultPreferences.documents,
        ...(parsed.documents ?? {}),
      },
    };
  } catch (err) {
    console.error("Failed to load settings preferences:", err);
    return defaultPreferences;
  }
};

function PreferenceToggle({
  enabled,
  title,
  detail,
  onToggle,
  labelStyle,
  valueStyle,
  rowStyle,
  toggleStyle,
  toggleKnobStyle,
}) {
  return (
    <div style={rowStyle}>
      <div>
        <p style={{ ...labelStyle, marginBottom: "2px" }}>{title}</p>
        <p style={{ ...valueStyle, marginBottom: 0 }}>{detail}</p>
      </div>
      <button
        type="button"
        aria-pressed={enabled}
        aria-label={title}
        onClick={onToggle}
        style={toggleStyle(enabled)}
      >
        <span style={toggleKnobStyle(enabled)} />
      </button>
    </div>
  );
}

function Settings() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [completion, setCompletion] = useState(0);
  const [missingSections, setMissingSections] = useState([]);
  const [preferences, setPreferences] = useState(loadStoredPreferences);
  const [savedMessage, setSavedMessage] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const savedMessageTimeout = useRef(null);
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

  useEffect(() => {
    const loadProfilePhoto = async () => {
      try {
        const photoUrl = await fetchProfilePhoto(BASE, getToken);
        setProfilePhoto(photoUrl);
      } catch (err) {
        console.error("Failed to load profile photo:", err);
      }
    };

    loadProfilePhoto();
  }, [BASE, getToken]);

  useEffect(() => {
    return () => {
      if (savedMessageTimeout.current) {
        window.clearTimeout(savedMessageTimeout.current);
      }
    };
  }, []);

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

  const sectionHeaderStyle = {
    color: "var(--color-heading, #003C78)",
    fontSize: "16px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px 0",
    borderTop: "1px solid var(--color-border-default, #e5e7eb)",
  };

  const toggleStyle = (enabled) => ({
    width: "44px",
    height: "24px",
    borderRadius: "999px",
    border: "none",
    backgroundColor: enabled ? "var(--color-accent, #046A97)" : "#d1d5db",
    cursor: "pointer",
    padding: "3px",
    position: "relative",
    flexShrink: 0,
  });

  const toggleKnobStyle = (enabled) => ({
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    backgroundColor: "white",
    position: "absolute",
    top: "3px",
    left: enabled ? "23px" : "3px",
    transition: "left 0.2s",
  });

  const showSavedConfirmation = () => {
    setSavedMessage("Preferences saved");

    if (savedMessageTimeout.current) {
      window.clearTimeout(savedMessageTimeout.current);
    }

    savedMessageTimeout.current = window.setTimeout(() => setSavedMessage(""), 1800);
  };

  const persistPreferences = (nextPreferences) => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextPreferences));
    window.dispatchEvent(new Event("breeze-preferences-updated"));
    showSavedConfirmation();
  };

  const handleToggle = (section, key) => {
    setPreferences((current) => {
      const nextPreferences = {
        ...current,
        [section]: {
          ...current[section],
          [key]: !current[section][key],
        },
      };

      persistPreferences(nextPreferences);
      return nextPreferences;
    });
  };

  const toggleProps = (section, name) => {
    return {
      enabled: preferences[section][name],
      onToggle: () => handleToggle(section, name),
      labelStyle,
      valueStyle,
      rowStyle,
      toggleStyle,
      toggleKnobStyle,
    };
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfilePhotoError("Please upload an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfilePhotoError("Please choose an image under 2 MB.");
      return;
    }

    try {
      const photoUrl = await uploadProfilePhoto(BASE, getToken, file);
      setProfilePhoto(photoUrl);
      setProfilePhotoError("");
      showSavedConfirmation();
    } catch (err) {
      console.error("Profile photo upload failed:", err);
      setProfilePhotoError(err.message || "Could not upload that image. Please try again.");
    }
  };

  const handleRemoveProfilePhoto = async () => {
    try {
      await deleteProfilePhoto(BASE, getToken);
      setProfilePhoto("");
      setProfilePhotoError("");
      showSavedConfirmation();
    } catch (err) {
      console.error("Profile photo remove failed:", err);
      setProfilePhotoError(err.message || "Could not remove the profile photo. Please try again.");
    }
  };

  const displayedProfilePhoto = profilePhoto || user?.imageUrl || "";

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

        {/* PROFILE PICTURE */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2
            style={{
              color: "var(--color-heading, #003C78)",
              fontSize: "16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Camera size={18} />
            Profile Picture
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                border: "2px solid var(--color-border-default, #e5e7eb)",
                backgroundColor: "var(--bg, #F8FAFC)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-heading, #003C78)",
                fontSize: "28px",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {displayedProfilePhoto ? (
                <img
                  src={displayedProfilePhoto}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (user?.firstName?.[0] ?? "U")
              )}
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <p style={{ ...valueStyle, marginBottom: "12px" }}>
                Upload a profile picture to show on Settings and Profile on this browser.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "var(--color-accent, #046A97)",
                    color: "white",
                    borderRadius: "8px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Camera size={15} />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleProfilePhotoUpload}
                    style={{ display: "none" }}
                  />
                </label>

                {profilePhoto && (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePhoto}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      border: "1px solid var(--color-border-default, #e5e7eb)",
                      borderRadius: "8px",
                      backgroundColor: "white",
                      color: "#DC2626",
                      padding: "9px 12px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                )}
              </div>
              {profilePhotoError && (
                <p style={{ color: "#DC2626", fontSize: "12px", marginTop: "8px" }}>
                  {profilePhotoError}
                </p>
              )}
            </div>
          </div>
        </div>

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

        {/* DOCUMENT PREFERENCES */}
        <div style={{ ...cardStyle, borderLeft: "4px solid var(--section-border)" }}>
          <h2 style={sectionHeaderStyle}>
            <FileText size={18} />
            Document Preferences
          </h2>
          <PreferenceToggle
            {...toggleProps("documents", "showJobCardIndicators")}
            title="Show document indicators on job cards"
            detail="Display resume and cover letter counts next to the View button."
          />
        </div>

        {savedMessage && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--color-accent, #046A97)",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            <Save size={16} />
            {savedMessage}
          </div>
        )}

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
