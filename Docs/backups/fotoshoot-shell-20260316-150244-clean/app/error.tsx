"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#090b0f",
        color: "#eef2f7",
        fontFamily: '"SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: "560px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "24px" }}>FotoShoot hit an error</h1>
        <p style={{ margin: "0 0 20px", color: "#8f98ab", lineHeight: 1.6 }}>
          {error.message || "Something went wrong while rendering the workspace."}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "40px",
            padding: "0 16px",
            borderRadius: "999px",
            border: "1px solid rgba(208, 170, 111, 0.22)",
            background: "linear-gradient(135deg, rgba(208, 170, 111, 0.18), rgba(208, 170, 111, 0.06))",
            color: "#f7ecd8",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
