import { NoteEditor } from "@/components/note-editor";

type NoteEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoteEditorPage({ params }: NoteEditorPageProps) {
  const { id } = await params;

  return <NoteEditor noteId={id} />;
}
