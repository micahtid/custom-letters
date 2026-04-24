import { notFound } from "next/navigation";
import { EnvelopeReveal } from "@/components/envelope-reveal";
import { getSharedLetter } from "@/lib/store";

type LetterPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LetterPage({ params }: LetterPageProps) {
  const { id } = await params;
  const letter = await getSharedLetter(id);

  if (!letter) {
    notFound();
  }

  return <EnvelopeReveal letter={letter} />;
}
