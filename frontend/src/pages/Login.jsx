import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import breezeLogo from "../assets/breeze-logo-icon.png";

function Login() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!isLoaded) return;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({
          session: result.createdSessionId,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#ffffff" }}>
      {/* LEFT SIDE */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src={breezeLogo}
              alt=""
              aria-hidden="true"
              style={{ width: "58px", height: "58px", borderRadius: "14px", objectFit: "cover" }}
            />
            <span style={{ color: "#003C78", fontSize: "34px", fontWeight: 800, lineHeight: 1 }}>
              Breeze
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              style={{
                color: "#003C78",
                fontSize: "2rem",
                fontWeight: "700",
              }}
            >
              Welcome Back
            </h2>

            <p className="text-gray-500 mt-2">Sign in to continue to your account.</p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 p-3 rounded"
              style={{
                backgroundColor: "#fee2e2",
                color: "#991b1b",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: "#003C78",
                  fontWeight: "600",
                }}
              >
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg p-3"
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label
                className="block mb-2"
                style={{
                  color: "#003C78",
                  fontWeight: "600",
                }}
              >
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  placeholder="Enter password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg p-3 pr-10"
                />

                <button
                  type="button"
                  className="absolute right-3 top-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="mb-6 text-right">
              <Link
                to="/forgot-password"
                className="text-sm hover:underline"
                style={{ color: "#FF6113" }}
              >
                Forgot Password?
              </Link>
            </div>
            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-white"
              style={{
                background: "linear-gradient(135deg,#003C78,#046A97)",
              }}
            >
              {loading ? (
                "Signing In..."
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 text-center text-gray-400">─── or continue with ───</div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="w-full border rounded-lg p-3 flex items-center justify-center gap-3 hover:bg-gray-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20H24v8h11.3C33.6 33.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.4-7.7 19.4-20 0-1.3-.1-2.7-.4-4z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 6.5 29.2 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.1 0 9.8-1.9 13.4-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3.4-11.2-8.1l-6.5 5C9.5 39.5 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.2 5.2C41.1 35.6 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"
              />
            </svg>
            Sign in with Google
          </button>
          <div className="mt-6 text-center">
            <span className="text-gray-600">Don't have an account?</span>{" "}
            <Link
              to="/signup"
              className="font-semibold hover:underline"
              style={{ color: "#FF6113" }}
            >
              Sign up for free
            </Link>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center"
        style={{
          background: "linear-gradient(135deg,#003C78,#046A97)",
        }}
      >
        <div className="text-center max-w-md p-10">
          <h2 className="text-4xl font-bold mb-6" style={{ color: "white" }}>
            Track Your Applications Smarter
          </h2>

          <p className="text-lg leading-relaxed" style={{ color: "rgba(255, 255, 255, 0.92)" }}>
            Organize resumes, monitor job applications, manage documents, and stay on top of every
            opportunity with Breeze.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
