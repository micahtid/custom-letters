"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotesDashboard } from "@/components/notes-dashboard";
import { useProfile } from "@/hooks/use-profile";

export function HomeGate() {
  const { profile, loading } = useProfile();
  const router = useRouter();

  if (loading || !profile) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  return <NotesDashboard profile={profile} />;
}
