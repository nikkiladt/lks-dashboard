import { auth } from "@/auth";
import DashboardClient from "./dashboard-client";
import LoginButton from "./login-button";

export default async function Page() {
  const session = await auth();

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f8fb",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 32,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginTop: 0 }}>LKS Dashboard</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>
            Sign in with your Google Workspace account to continue.
          </p>
          <LoginButton />
        </div>
      </div>
    );
  }

  return <DashboardClient />;
}