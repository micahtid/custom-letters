import { NextRequest, NextResponse } from "next/server";
import { createNote, getNotes } from "@/lib/store";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  const notes = await getNotes(profileId);
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { profileId?: string };

  if (!body.profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  const note = await createNote(body.profileId);
  return NextResponse.json({ note });
}
