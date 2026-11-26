"use client";

/* Error in the root layout itself: replaces the whole document, so plain styles only (no app CSS guaranteed). */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f7fb", color: "#1a2257", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center", padding: 16 }}>
        <main>
          <p style={{ fontSize: 44, fontWeight: 800, color: "#ff5757", margin: 0 }}>Oops!</p>
          <h1 style={{ fontSize: 22 }}>Une erreur est survenue · Something went wrong</h1>
          <p style={{ color: "#5b6385" }}>Réessayez dans un instant. · Try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 8, height: 48, padding: "0 24px", borderRadius: 16, border: 0, background: "#364fab", color: "#fff", fontWeight: 600, fontSize: 16 }}>
            Réessayer · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
