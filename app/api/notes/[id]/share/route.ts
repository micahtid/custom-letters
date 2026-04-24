import { NextResponse } from "next/server";
import { shareNote } from "@/lib/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json()) as { profileId?: string };
  const { id } = await context.params;

  if (!body.profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await shareNote(body.profileId, id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unable to share note." }, { status: 404 });
  }
}
