import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const clerkEnabled = import.meta.env.VITE_CLERK_ENABLED !== "false"; // "true" for Log in ON or "false" for OFF

function App() {
  return (
    <BrowserRouter>
      {clerkEnabled ? (
        <>
         <SignedOut>
  <Routes>
    <Route path="/" element={<Login />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
  </Routes>
</SignedOut>
          <SignedIn>
            <div style={{ display: "flex" }}>
              <Sidebar />
              <div style={{ marginLeft: "260px", padding: "20px", flex: 1 }}>
                <UserButton />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/analytics" element={<Analytics />} />
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
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
