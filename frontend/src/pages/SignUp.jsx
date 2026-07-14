import { useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";
import breezeLogo from "../assets/breeze-logo-icon.png";

function SignUp() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword] = useState(false);

  const [success, setSuccess] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const getPasswordStrength = () => {
    if (password.length < 8) return "Weak";

    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (hasLetter && hasNumber && password.length >= 10) {
      return "Strong";
    }

    return "Medium";
  };
  const getSignupError = (err) => {
    const code = err.errors?.[0]?.code;

    switch (code) {
      case "form_identifier_exists":
        return "An account already exists with this email address.";

      case "form_password_too_short":
        return "Password must be at least 8 characters long.";

      case "form_password_pwned":
        return "This password has appeared in a known data breach. Please choose another password.";

      default:
        return err.errors?.[0]?.message || "Unable to create account.";
    }
  };
  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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
      setSuccess("Verification code sent. Check your email to complete registration.");
      setPendingVerification(true);
    } catch (err) {
      console.error(err);
      setError(getSignupError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });

        // send user straight into app
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      setError(err.errors?.[0]?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };
  {
    success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>;
  }
  if (pendingVerification) {
    {
      success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>;
    }
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
              disabled={loading}
              className="w-full text-white rounded-lg p-3"
              style={{
                background: "linear-gradient(135deg,#003C78,#046A97)",
              }}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#ffffff" }}>
      {/* Left Side */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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

          <h1 className="text-4xl font-bold mb-2" style={{ color: "#003C78" }}>
            Create Account
          </h1>

          <p className="text-gray-500 mb-8">Join Breeze and start tracking applications.</p>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

          <form onSubmit={handleSignup}>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4"
              required
            />

            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4"
              required
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-3 mb-6"
              required
            />
            <p className="text-sm text-gray-500 mt-2 mb-2">
              Password must be at least 8 characters and contain a mix of letters and numbers.
            </p>
            {password && (
              <p className="mt-2 text-sm text-gray-600">
                Password Strength: <strong>{getPasswordStrength()}</strong>
              </p>
            )}
            <div className="mb-6">
              <label className="block mb-2 font-medium">Confirm Password</label>

              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border rounded-lg p-3"
                required
              />

              {confirmPassword && (
                <p
                  className="mt-2 text-sm"
                  style={{
                    color: password === confirmPassword ? "#065F46" : "#991B1B",
                  }}
                >
                  {password === confirmPassword ? "✓ Passwords match" : "Passwords do not match"}
                </p>
              )}
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
        style={{ background: "linear-gradient(135deg,#003C78,#046A97)" }}
      >
        <div className="max-w-md" style={{ color: "white" }}>
          <h2 className="text-4xl font-bold mb-6" style={{ color: "white" }}>
            Start Your Career Journey
          </h2>
          <p>
            Create an account to organize applications, resumes, and opportunities in one place.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;

