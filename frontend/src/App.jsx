import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

const clerkEnabled = import.meta.env.VITE_CLERK_ENABLED !== "false"; // "true" for Log in ON or "false" for OFF

function App() {
  return (
    <BrowserRouter>
      {clerkEnabled ? (
        <>
          <SignedOut>
            <SignIn />
          </SignedOut>
          <SignedIn>
            <div style={{ display: "flex" }}>
              <Sidebar />
              <div style={{ padding: "20px", flex: 1 }}>
                <UserButton />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </div>
          </SignedIn>
        </>
      ) : (
        <div style={{ display: "flex" }}>
          <Sidebar />
          <div style={{ padding: "20px", flex: 1 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
