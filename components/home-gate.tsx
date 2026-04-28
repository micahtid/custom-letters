"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { NotesDashboard } from "@/components/notes-dashboard";

export function HomeGate() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  if (isLoading) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="simple-shell">
        <section className="empty-state sign-in-card">
          <h1>Handwritten Letters</h1>
          <p className="muted-copy">
            Sign in to capture your handwriting and send notes only you could
            have written.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => void signIn("google")}
          >
            Continue with Google
          </button>
        </section>
      </main>
    );
  }

  return <NotesDashboard />;
}
