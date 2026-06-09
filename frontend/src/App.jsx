import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
