import { NextResponse } from "next/server";
import { createNote } from "@/lib/store";

type SaveLetterBody = {
  profileId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SaveLetterBody;

  if (!body.profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  const note = await createNote(body.profileId);
  return NextResponse.json({ note });
}
