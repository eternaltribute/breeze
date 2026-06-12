import { useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";

function Signup() {
  const { signUp, isLoaded } = useSignUp();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (err) {
      console.error(err);

      setError(err.errors?.[0]?.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        navigate("/login");
      }
    } catch (err) {
      console.error(err);

      setError(err.errors?.[0]?.message || "Verification failed.");
    }
  };

  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md px-6">
          <h1 className="text-3xl font-bold mb-4" style={{ color: "#003C78" }}>
            Verify Your Email
          </h1>

          <p className="text-gray-500 mb-6">
            Enter the verification code sent to your email address.
          </p>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

          <form onSubmit={handleVerification}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification Code"
              className="w-full border rounded-lg p-3 mb-4"
              required
            />

            <button
              type="submit"
              className="w-full text-white rounded-lg p-3"
              style={{
                background: "linear-gradient(135deg,#003C78,#046A97)",
              }}
            >
              Verify Email
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#003C78" }}>
            Create Account
          </h1>

          <p className="text-gray-500 mb-8">Join Breeze and start tracking applications.</p>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

          <form onSubmit={handleSignup}>
            <div className="mb-4">
              <label className="block mb-2 font-medium">First Name</label>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border rounded-lg p-3"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Last Name</label>

              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border rounded-lg p-3"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Email</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg p-3"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2 font-medium">Password</label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg p-3"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white rounded-lg p-3"
              style={{
                background: "linear-gradient(135deg,#003C78,#046A97)",
              }}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold" style={{ color: "#FF6113" }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center"
        style={{
          background: "linear-gradient(135deg,#003C78,#046A97)",
        }}
      >
        <div className="text-white max-w-md">
          <h2 className="text-4xl font-bold mb-6">Start Your Career Journey</h2>

          <p>
            Create an account to organize applications, resumes, and opportunities in one place.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
