import Link from "next/link";

export default function MeetingNoteNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-neutral-600">
      <h1 className="text-xl font-semibold text-neutral-900">Note not found</h1>
      <p className="text-sm">This meeting note doesn&apos;t exist or has been deleted.</p>
      <Link
        href="/meetings"
        className="text-sm font-medium text-neutral-900 underline underline-offset-2"
      >
        Back to meeting notes
      </Link>
    </div>
  );
}
