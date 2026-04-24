import { NextResponse } from "next/server";
import { clearGlyphs, saveGlyph } from "@/lib/store";

type SaveGlyphBody = {
  profileId?: string;
  character?: string;
  dataUrl?: string;
};

export async function PUT(request: Request) {
  const body = (await request.json()) as SaveGlyphBody;

  if (!body.profileId || !body.character || !body.dataUrl) {
    return NextResponse.json(
      { error: "profileId, character, and dataUrl are required." },
      { status: 400 }
    );
  }

  const profile = await saveGlyph(body.profileId, body.character, body.dataUrl);
  return NextResponse.json({ profile });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required." }, { status: 400 });
  }

  const profile = await clearGlyphs(profileId);
  return NextResponse.json({ profile });
}
