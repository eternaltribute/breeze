import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";

function ForgotPassword() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [resetStarted, setResetStarted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getErrorMessage = (err) => {
    const code = err.errors?.[0]?.code;

    switch (code) {
      case "form_identifier_not_found":
        return "No account was found with that email address.";

      case "form_code_incorrect":
        return "The verification code is incorrect. Please check your email and try again.";

      case "verification_expired":
        return "Your verification code has expired. Request a new one.";

      case "form_password_too_short":
        return "Your password must be at least 8 characters long.";

      case "form_password_pwned":
        return "This password has appeared in a known data breach. Please choose a stronger password.";

      default:
        return err.errors?.[0]?.message || "Something went wrong. Please try again.";
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      setSuccess(
        "A verification code has been sent to your email. Check your inbox and enter the code below."
      );

      setResetStarted(true);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });

      if (result.status === "complete") {
        setSuccess("Password updated successfully. Redirecting to your dashboard...");

        await setActive({
          session: result.createdSessionId,
        });

        setTimeout(() => {
          navigate("/");
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
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

          {!resetStarted ? (
            <>
              <div className="mb-8">
                <h2
                  style={{
                    color: "#003C78",
                    fontSize: "2rem",
                    fontWeight: "700",
                  }}
                >
                  Reset Password
                </h2>

                <p className="text-gray-500 mt-2">
                  Enter your email and we'll send you a verification code.
                </p>
              </div>

              {error && (
                <div
                  className="mb-5 rounded-lg border p-4"
                  style={{
                    backgroundColor: "#FEF2F2",
                    borderColor: "#FCA5A5",
                  }}
                >
                  <p
                    style={{
                      color: "#991B1B",
                      fontWeight: "700",
                    }}
                  >
                    Unable to Continue
                  </p>

                  <p className="mt-1" style={{ color: "#991B1B" }}>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div
                  className="mb-5 rounded-lg border p-4"
                  style={{
                    backgroundColor: "#ECFDF5",
                    borderColor: "#6EE7B7",
                  }}
                >
                  <p
                    style={{
                      color: "#065F46",
                      fontWeight: "700",
                    }}
                  >
                    Success
                  </p>

                  <p className="mt-1" style={{ color: "#065F46" }}>
                    {success}
                  </p>
                </div>
              )}

              <form onSubmit={handleSendCode}>
                <div className="mb-6">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white rounded-lg py-3"
                  style={{
                    background: "linear-gradient(135deg,#003C78,#046A97)",
                  }}
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2
                  style={{
                    color: "#003C78",
                    fontSize: "2rem",
                    fontWeight: "700",
                  }}
                >
                  Create New Password
                </h2>

                <p className="text-gray-500 mt-2">
                  Enter the verification code from your email and choose a new password.
                </p>
              </div>

              {error && (
                <div
                  className="mb-5 rounded-lg border p-4"
                  style={{
                    backgroundColor: "#FEF2F2",
                    borderColor: "#FCA5A5",
                  }}
                >
                  <p style={{ color: "#991B1B", fontWeight: "700" }}>Unable to Continue</p>

                  <p className="mt-1" style={{ color: "#991B1B" }}>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div
                  className="mb-5 rounded-lg border p-4"
                  style={{
                    backgroundColor: "#ECFDF5",
                    borderColor: "#6EE7B7",
                  }}
                >
                  <p style={{ color: "#065F46", fontWeight: "700" }}>Success</p>

                  <p className="mt-1" style={{ color: "#065F46" }}>
                    {success}
                  </p>
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label
                    className="block mb-2"
                    style={{
                      color: "#003C78",
                      fontWeight: "600",
                    }}
                  >
                    Verification Code
                  </label>

                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full border rounded-lg p-3"
                  />
                </div>

                <div className="mb-2">
                  <label
                    className="block mb-2"
                    style={{
                      color: "#003C78",
                      fontWeight: "600",
                    }}
                  >
                    New Password
                  </label>

                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border rounded-lg p-3"
                  />

                  <p className="text-sm text-gray-500 mt-2">
                    Password must be at least 8 characters long and should be unique.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 text-white rounded-lg py-3"
                  style={{
                    background: "linear-gradient(135deg,#003C78,#046A97)",
                  }}
                >
                  {loading ? "Updating..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="font-semibold hover:underline"
              style={{ color: "#FF6113" }}
            >
              Back to Login
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
        <div className="text-white max-w-md p-10">
          <h2 className="text-4xl font-bold mb-6">Get Back Into Your Account</h2>

          <p className="text-lg opacity-90">
            Securely reset your password and continue tracking applications, managing documents, and
            staying organized with Breeze.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
