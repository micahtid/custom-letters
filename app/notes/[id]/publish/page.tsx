import { PublishView } from "@/components/publish-view";

type PublishPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PublishPage({ params }: PublishPageProps) {
  const { id } = await params;

  return <PublishView noteId={id} />;
}
