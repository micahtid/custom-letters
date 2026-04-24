"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

const PROFILE_KEY = "paper-thread-profile";

type UseProfileResult = {
  profile: Profile | null;
  loading: boolean;
  setProfile: Dispatch<SetStateAction<Profile | null>>;
};

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const existingId = window.localStorage.getItem(PROFILE_KEY);
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existingId ? { id: existingId } : {})
      });
      const data = (await response.json()) as { profile: Profile };
      window.localStorage.setItem(PROFILE_KEY, data.profile.id);
      setProfile(data.profile);
      setLoading(false);
    })();
  }, []);

  return { profile, loading, setProfile };
}
