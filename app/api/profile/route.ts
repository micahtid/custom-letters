import { NextResponse } from "next/server";
import { ensureProfile, getProfile } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const profile = body.id ? await getProfile(body.id) : null;
  const resolved = profile ?? (await ensureProfile());

  return NextResponse.json({ profile: resolved });
}
