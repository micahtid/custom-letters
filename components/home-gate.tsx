"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotesDashboard } from "@/components/notes-dashboard";
import { useProfile } from "@/hooks/use-profile";

export function HomeGate() {
  const { profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && Object.keys(profile.glyphs).length === 0) {
      router.replace("/characters");
    }
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (Object.keys(profile.glyphs).length === 0) {
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
