import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AddJob from "./pages/AddJob";
import EditJob from "./pages/EditJob";
import JobDetail from "./pages/JobDetail";
import Analytics from "./pages/Analytics";
import ResumeHelper from "./pages/ResumeHelper";
import CoverLetterHelper from "./pages/CoverLetterHelper";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";

const clerkEnabled = import.meta.env.VITE_CLERK_ENABLED !== "false";

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg, #F8FAFC)",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid var(--color-border-default, #e5e7eb)",
          borderTop: "3px solid var(--color-heading, #003C78)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "var(--color-subtext, #6b7280)", fontSize: "14px" }}>Loading Breeze...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const sync = async () => {
      try {
        const token = await getToken({ skipCache: true });
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress ?? "",
            first_name: user.firstName ?? "",
            last_name: user.lastName ?? "",
          }),
        });
      } catch (err) {
        console.error("User sync failed:", err);
      }
    };

    sync();
  }, [isSignedIn, user, getToken]);

  if (clerkEnabled && !isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      {clerkEnabled ? (
        <>
          <SignedOut>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signUp" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </SignedOut>

          <SignedIn>
            <div style={{ display: "flex" }}>
              <Sidebar />
              <div style={{ marginLeft: "260px", flex: 1, minHeight: "100vh" }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/jobs/new" element={<AddJob />} />
                  <Route path="/jobs/:id" element={<JobDetail />} />
                  <Route path="/jobs/:id/edit" element={<EditJob />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/resume-helper" element={<ResumeHelper />} />
                  <Route path="/cover-letter-helper" element={<CoverLetterHelper />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="/signUp" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </SignedIn>
        </>
      ) : (
        <div style={{ display: "flex" }}>
          <Sidebar />
          <div style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--bg, #F8FAFC)" }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/library" element={<Library />} />
              <Route path="/resume-helper" element={<ResumeHelper />} />
              <Route path="/cover-letter-helper" element={<CoverLetterHelper />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
