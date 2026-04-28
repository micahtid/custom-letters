import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import type { LetterId } from "@/lib/types";

type LetterPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LetterPage({ params }: LetterPageProps) {
  const { id } = await params;

  let letter;
  try {
    letter = await fetchQuery(api.letters.getPublic, { id: id as LetterId });
  } catch {
    notFound();
  }

  if (!letter) {
    notFound();
  }

  return <EnvelopeReveal letter={letter} />;
}
