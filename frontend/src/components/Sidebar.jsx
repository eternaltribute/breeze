import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import {
  LayoutDashboard,
  BarChart2,
  BookOpen,
  FileText,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronUp,
  Mail,
} from "lucide-react";
import { fetchProfilePhoto, PROFILE_PHOTO_UPDATED_EVENT } from "../utils/profilePhoto";

const BASE = import.meta.env.VITE_API_BASE_URL;

const navGroups = [
  {
    label: "Jobs",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Analytics", path: "/analytics", icon: BarChart2 },
      { label: "Library", path: "/library", icon: BookOpen },
    ],
  },
  {
    // AI-powered tools
    label: "Tools",
    items: [
      { label: "Resume Helper", path: "/resume-helper", icon: FileText },
      { label: "Cover Letter Helper", path: "/cover-letter-helper", icon: Mail },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", path: "/profile", icon: User },
      { label: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

function Sidebar() {
  const location = useLocation();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [popupOpen, setPopupOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const syncProfilePhoto = async () => {
      try {
        const photoUrl = await fetchProfilePhoto(BASE, getToken);
        setProfilePhoto(photoUrl);
      } catch (err) {
        console.error("Failed to load sidebar profile photo:", err);
      }
    };

    syncProfilePhoto();
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, syncProfilePhoto);

    return () => {
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, syncProfilePhoto);
    };
  }, [getToken]);

  const displayedProfilePhoto = profilePhoto || user?.imageUrl || "";

  return (
    <div
      style={{
        width: "260px",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        backgroundColor: "var(--bg-sidebar, #ffffff)",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px 24px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "#003C78",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "800",
            fontSize: "16px",
          }}
        >
          B
        </div>
        <span style={{ fontWeight: "700", fontSize: "18px", color: "var(--text-h, #003C78)" }}>
          Breeze
        </span>
      </div>

      {/* Nav Groups */}
      <nav style={{ flex: 1 }}>
        {navGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "24px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--color-subtext, #9ca3af)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0 12px",
                marginBottom: "4px",
              }}
            >
              {group.label}
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {group.items.map(({ label, path, icon: Icon }) => {
                const isActive = location.pathname === path;
                return (
                  <li key={path}>
                    <Link
                      to={path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontSize: "14px",
                        fontWeight: isActive ? "600" : "400",
                        color: isActive ? "#1b68b6" : "var(--text-h, #6b7280)",
                        backgroundColor: isActive
                          ? "var(--brand-ocean-muted, #EFF6FF)"
                          : "transparent",
                        transition: "background-color 0.15s, color 0.15s",
                      }}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Popup Menu */}
      {popupOpen && (
        <>
          {/* Backdrop to close popup */}
          <div
            onClick={() => setPopupOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10 }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "90px",
              left: "12px",
              right: "12px",
              backgroundColor: "var(--bg-sidebar, white)",
              border: "1px solid var(--color-border-default, #e5e7eb)",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            {/* Dark Mode Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--color-border-default, #f3f4f6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "14px",
                  color: "var(--text-h, #374151)",
                }}
              >
                {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                Dark mode
              </div>
              <button
                onClick={() => {
                  const next = !darkMode;
                  setDarkMode(next);
                  document.documentElement.classList.toggle("dark", next);
                }}
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "999px",
                  backgroundColor: darkMode ? "#003C78" : "#d1d5db",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: "white",
                    position: "absolute",
                    top: "3px",
                    left: darkMode ? "19px" : "3px",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>

            {/* Settings */}
            <Link
              to="/settings"
              onClick={() => setPopupOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                fontSize: "14px",
                color: "var(--text-h, #374151)",
                textDecoration: "none",
                borderBottom: "1px solid var(--color-border-default, #f3f4f6)",
              }}
            >
              <Settings size={16} />
              Settings
            </Link>

            {/* Log Out */}
            <button
              onClick={() => signOut()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                fontSize: "14px",
                color: "#ef4444",
                background: "none",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </>
      )}

      {/* User Card */}
      <div
        style={{ borderTop: "1px solid var(--color-border-default, #e5e7eb)", paddingTop: "12px" }}
      >
        <div
          onClick={() => setPopupOpen(!popupOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "var(--bg-sidebar, #f9fafb)",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent, #046A97)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {displayedProfilePhoto ? (
              <img
                src={displayedProfilePhoto}
                alt={user?.fullName ?? "Profile"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (user?.firstName?.[0] ?? "U")
            )}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-h, #111827)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.fullName ?? "User"}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "var(--color-subtext, #6b7280)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
          </div>
          <ChevronUp
            size={14}
            style={{
              color: "#9ca3af",
              transform: popupOpen ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
