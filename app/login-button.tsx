"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn("google")}
      style={{
        background: "#111827",
        color: "#ffffff",
        border: "none",
        borderRadius: 12,
        padding: "12px 18px",
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Sign in with Google
    </button>
  );
}