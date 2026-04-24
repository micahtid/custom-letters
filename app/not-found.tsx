import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="missing-page">
      <div className="missing-card">
        <h1>This note is no longer here.</h1>
        <p>
          The link may be incomplete, or the temporary storage was reset.
        </p>
        <Link href="/" className="ghost-link">
          Create a new letter
        </Link>
      </div>
    </main>
  );
}
