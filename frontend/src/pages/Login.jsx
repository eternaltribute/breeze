import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

function Login() {
  const { signIn, setActive } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#FF6113" }}
            >
              <span className="text-white font-bold">B</span>
            </div>

            <h1
              style={{
                color: "#003C78",
                fontWeight: "800",
                fontSize: "1.75rem",
              }}
            >
              Breeze
            </h1>
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
            className="w-full border rounded-lg p-3 hover:bg-gray-50"
          >
            Sign in with Google
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center"
        style={{
          background: "linear-gradient(135deg,#003C78,#046A97)",
        }}
      >
        <div className="text-white max-w-md p-10">
          <h2 className="text-4xl font-bold mb-6">Track Your Applications Smarter</h2>

          <p className="text-lg opacity-90">
            Organize resumes, monitor job applications, manage documents, and stay on top of every
            opportunity with Breeze.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
