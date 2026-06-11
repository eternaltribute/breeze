function Settings() {
  return (
    <div className="min-h-screen p-6 space-y-8" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Page Header */}
      <section>
        <h1 className="text-3xl font-bold" style={{ color: "#003C78" }}>
          Settings
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Manage your account preferences and application settings.
        </p>
      </section>

      {/* Account Information */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Account Information
        </h2>

        <div
          className="rounded-xl bg-white p-6 shadow-sm border-l-4"
          style={{ borderColor: "#046A97" }}
        >
          <p className="font-medium text-gray-900">Name</p>
          <p className="text-sm text-gray-600">User Name Placeholder</p>

          <div className="mt-4">
            <p className="font-medium text-gray-900">Email</p>
            <p className="text-sm text-gray-600">user@example.com</p>
          </div>

          <div className="mt-4">
            <p className="font-medium text-gray-900">Authentication Provider</p>
            <p className="text-sm text-gray-600">Clerk</p>
          </div>
        </div>
      </section>

      {/* Profile Completion */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Profile Completion
        </h2>

        <div
          className="rounded-xl bg-white p-6 shadow-sm border-l-4"
          style={{ borderColor: "#003C78" }}
        >
          <p className="font-medium text-gray-900">Profile Status</p>

          <p className="text-sm text-gray-600">80% Complete</p>

          <ul className="mt-4 text-sm space-y-2">
            <li style={{ color: "#046A97" }}>✓ Skills Added</li>
            <li style={{ color: "#046A97" }}>✓ Education Added</li>
            <li style={{ color: "#FF6138" }}>○ Certifications Pending</li>
          </ul>
        </div>
      </section>

      {/* Document Preferences */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Document Preferences
        </h2>

        <div
          className="rounded-xl bg-white p-6 shadow-sm border-l-4"
          style={{ borderColor: "#046A97" }}
        >
          <p className="font-medium text-gray-900">Default Resume</p>
          <p className="text-sm text-gray-600">Resume_v1.pdf</p>
        </div>
      </section>

      {/* Application Preferences */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Application Preferences
        </h2>

        <div
          className="rounded-xl bg-white p-6 shadow-sm border-l-4"
          style={{ borderColor: "#003C78" }}
        >
          <p className="font-medium text-gray-900">Follow-Up Reminders</p>
          <p className="text-sm text-gray-600">Coming Soon</p>

          <div className="mt-4">
            <p className="font-medium text-gray-900">Notification Preferences</p>
            <p className="text-sm text-gray-600">Coming Soon</p>
          </div>
        </div>
      </section>

      {/* Security */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Security
        </h2>

        <div
          className="rounded-xl bg-white p-6 shadow-sm border-l-4"
          style={{ borderColor: "#FF6138" }}
        >
          <p className="font-medium text-gray-900">Password Management</p>
          <p className="text-sm text-gray-600">Managed by Clerk</p>

          <div className="mt-4">
            <p className="font-medium text-gray-900">Two-Factor Authentication</p>
            <p className="text-sm text-gray-600">Coming Soon</p>
          </div>
        </div>
      </section>

      {/* Account Actions */}
      <section>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "#046A97" }}>
          Account Actions
        </h2>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex gap-4">
            <button
              className="rounded-lg px-4 py-2 text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: "#003C78" }}
            >
              Sign Out
            </button>

            <button
              className="rounded-lg border px-4 py-2 font-medium"
              style={{
                borderColor: "#FF6138",
                color: "#FF6138",
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Settings;
