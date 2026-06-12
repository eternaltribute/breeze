function Settings() {
  const cardStyle = {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };
  return (
    <div className="min-h-screen p-6 space-y-8" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Page Header */}
      <section className="space-y-2">
        <h1
          style={{
            color: "#003C78",
            marginBottom: "12px",
            fontSize: "36px",
            lineHeight: "1.2",
            fontWeight: 700,
          }}
        >
          Settings
        </h1>

        <p className="text-sm text-gray-600">
          Manage your account preferences and application settings.
        </p>
      </section>

      {/* Account Information */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#046A97" }}>
          Account Information
        </h2>

        <div style={{ ...cardStyle, borderLeft: "4px solid #046A97" }}>
          <div>
            <p className="font-medium text-gray-900">Name</p>
            <p className="text-sm text-gray-600">User Name Placeholder</p>
          </div>

          <div>
            <p className="font-medium text-gray-900">Email</p>
            <p className="text-sm text-gray-600">user@example.com</p>
          </div>

          <div>
            <p className="font-medium text-gray-900">Authentication Provider</p>
            <p className="text-sm text-gray-600">Clerk</p>
          </div>
        </div>
      </section>

      {/* Profile Completion */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#046A97" }}>
          Profile Completion
        </h2>

        <div style={{ ...cardStyle, borderLeft: "4px solid #046A97" }}>
          <div>
            <p className="font-medium text-gray-900">Profile Status</p>
            <p className="text-sm text-gray-600">80% Complete</p>
          </div>

          <ul className="text-sm space-y-1">
            <li style={{ color: "#046A97" }}>✓ Skills Added</li>
            <li style={{ color: "#046A97" }}>✓ Education Added</li>
            <li style={{ color: "#FF6138" }}>○ Certifications Pending</li>
          </ul>
        </div>
      </section>

      {/* Document Preferences */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#046A97" }}>
          Document Preferences
        </h2>

        <div style={{ ...cardStyle, borderLeft: "4px solid #046A97" }}>
          <p className="font-medium text-gray-900">Default Resume</p>
          <p className="text-sm text-gray-600">Resume_v1.pdf</p>
        </div>
      </section>

      {/* Application Preferences */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#046A97" }}>
          Application Preferences
        </h2>

        <div style={{ ...cardStyle, borderLeft: "4px solid #046A97" }}>
          <div>
            <p className="font-medium text-gray-900">Follow-Up Reminders</p>
            <p className="text-sm text-gray-600">Coming Soon</p>
          </div>

          <div>
            <p className="font-medium text-gray-900">Notification Preferences</p>
            <p className="text-sm text-gray-600">Coming Soon</p>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "#046A97" }}>
          Security
        </h2>

        <div className="border-l-4" style={{ ...cardStyle, borderLeft: "4px solid #FF6138" }}>
          <div>
            <p className="font-medium text-gray-900">Password Management</p>
            <p className="text-sm text-gray-600">Managed by Clerk</p>
          </div>

          <div>
            <p className="font-medium text-gray-900">Two-Factor Authentication</p>
            <p className="text-sm text-gray-600">Coming Soon</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Settings;
