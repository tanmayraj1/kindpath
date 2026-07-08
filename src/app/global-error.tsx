"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/monitoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        url: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          margin: 0,
          background: "#f1f5f9",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#64748b", marginTop: 8 }}>
            A critical error occurred. Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: "#4f46e5",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
