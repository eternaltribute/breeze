import { useUser } from "@clerk/clerk-react";
function Dashboard() {
  const { user } = useUser();
  const activityCards = [
    {
      title: "Application Updated",
      description: "Software Engineer application status changed.",
    },
    {
      title: "Interview Scheduled",
      description: "Frontend Developer interview scheduled.",
    },
  ];

  const statusCards = [
    {
      title: "Software Engineer",
      status: "Applied",
    },
    {
      title: "Frontend Developer",
      status: "Interview",
    },
  ];

  const documentCards = [
    {
      title: "Resume.pdf",
      description: "Updated 2 days ago",
    },
    {
      title: "CoverLetter.pdf",
      description: "Updated 5 days ago",
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Hero Section */}
      <section
        className="rounded-2xl p-8 text-white shadow-sm"
        style={{
          background: "linear-gradient(135deg, #003C78 0%, #046A97 100%)",
        }}
      >
        <h1 className="text-4xl font-bold">
          Welcome Back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>

        <p className="mt-3 text-white/90">
          Track applications, manage documents, and stay on top of your career journey.
        </p>

        <button
          className="mt-6 rounded-lg px-5 py-2 font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: "#FF6138" }}
        >
          Upload Resume
        </button>
      </section>

      {/* Recent Activity */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" style={{ color: "#046A97" }}>
          Recent Activity
        </h2>

        <div className="grid gap-4">
          {activityCards.map((card, index) => (
            <div
              key={index}
              className="rounded-xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
              style={{
                borderTop: "4px solid #046A97",
              }}
            >
              <h3 className="font-semibold text-gray-900">{card.title}</h3>

              <p className="mt-2 text-sm text-gray-600">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Application Status */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" style={{ color: "#046A97" }}>
          Application Status
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {statusCards.map((card, index) => (
            <div
              key={index}
              className="rounded-xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
              style={{
                borderTop: "4px solid #003C78",
              }}
            >
              <h3 className="font-semibold text-gray-900">{card.title}</h3>

              <div className="mt-3">
                <span
                  className="rounded-full px-3 py-1 text-sm font-medium text-white"
                  style={{
                    backgroundColor: card.status === "Interview" ? "#FF6138" : "#046A97",
                  }}
                >
                  {card.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Document Updates */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" style={{ color: "#046A97" }}>
          Document Updates
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {documentCards.map((card, index) => (
            <div
              key={index}
              className="rounded-xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
              style={{
                borderTop: "4px solid #FF6138",
              }}
            >
              <h3 className="font-semibold text-gray-900">{card.title}</h3>

              <p className="mt-2 text-sm text-gray-600">{card.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
