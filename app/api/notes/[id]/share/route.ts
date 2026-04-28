import { NextRequest, NextResponse } from "next/server";
import { getNote, getSharedLetter, shareNote, unshareNote } from "@/lib/store";
import type { Attachment, PaperStyle } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  const { id } = await context.params;

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  const note = await getNote(id);
  if (!note || note.profileId !== profileId) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  if (!note.lastSharedLetterId) {
    return NextResponse.json({ letter: null });
  }

  const letter = await getSharedLetter(note.lastSharedLetterId);
  return NextResponse.json({ letter });
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json()) as {
    profileId?: string;
    paperStyle?: PaperStyle;
    paperColor?: string;
    attachments?: Attachment[];
  };
  const { id } = await context.params;

  if (!body.profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await shareNote(body.profileId, id, {
      paperStyle: body.paperStyle,
      paperColor: body.paperColor,
      attachments: body.attachments
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to share note." }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  const { id } = await context.params;

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  try {
    const note = await unshareNote(profileId, id);
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
}
