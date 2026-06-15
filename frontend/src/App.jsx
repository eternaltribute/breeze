import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, useAuth, useUser } from "@clerk/clerk-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";

const clerkEnabled = import.meta.env.VITE_CLERK_ENABLED !== "false";

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
  }, [isSignedIn, user?.id]);

  if (clerkEnabled && !isLoaded) {
    return <div>Loading...</div>;
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
            </Routes>
          </SignedOut>

          <SignedIn>
            <div style={{ display: "flex" }}>
              <Sidebar />

              <div style={{ marginLeft: "260px", flex: 1, minHeight: "100vh" }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Routes>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
