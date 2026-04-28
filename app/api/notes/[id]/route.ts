import { NextRequest, NextResponse } from "next/server";
import { deleteNote, getNote, updateNote } from "@/lib/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  const { id } = await context.params;
  const note = await getNote(id);

  if (!note || (profileId && note.profileId !== profileId)) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json()) as {
    profileId?: string;
    title?: string;
    message?: string;
  };
  const { id } = await context.params;

  if (!body.profileId || body.title === undefined || body.message === undefined) {
    return NextResponse.json(
      { error: "profileId, title, and message are required." },
      { status: 400 }
    );
  }

  try {
    const note = await updateNote(body.profileId, id, {
      title: body.title,
      message: body.message
    });

    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
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
    await deleteNote(profileId, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
}
