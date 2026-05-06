import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeetingNoteById } from "@/lib/partnerships/repository";
import { createClient } from "@/lib/supabase/server";
import { DeleteNoteButton } from "@/components/meetings/delete-note-button";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MeetingNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [note, supabase] = await Promise.all([
    getMeetingNoteById(id),
    createClient(),
  ]);

  if (!note) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isCreator = user?.id === note.createdBy;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Back link */}
      <Link
        href="/meetings"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Meeting Notes
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-neutral-900">{note.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{formatDate(note.meetingDate)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {note.source === "upload"
              ? `Uploaded from ${note.originalFilename ?? "file.txt"}`
              : "Pasted manually"}
          </Badge>
        </div>

        <p className="mt-2 text-sm text-neutral-500">
          {note.creator
            ? `${note.creator.firstName} ${note.creator.lastName} · `
            : "Former member · "}
          {formatDateTime(note.createdAt)}
        </p>
      </div>

      {/* Tags */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        {/* Partner Attendees */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Partner Attendees
          </p>
          {note.partnersByCompany.length === 0 && note.noCompanyPartners.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            <div className="flex flex-col gap-3">
              {note.partnersByCompany.map((company) => (
                <div key={company.id}>
                  <Badge className="mb-1" variant="outline">
                    {company.name}
                  </Badge>
                  <div className="ml-2 flex flex-wrap gap-1">
                    {company.partners.map((p) => (
                      <Badge key={p.id} variant="secondary">
                        {p.firstName} {p.lastName}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {note.noCompanyPartners.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.noCompanyPartners.map((p) => (
                    <Badge key={p.id} variant="secondary">
                      {p.firstName} {p.lastName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BizTech Team */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            BizTech Team
          </p>
          {note.attendees.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {note.attendees.map((a) => (
                <Badge key={a.userId} variant="secondary">
                  {a.firstName} {a.lastName}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        {note.events.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Events
            </p>
            <div className="flex flex-wrap gap-1">
              {note.events.map((e) => (
                <Badge key={e.eventId} variant="secondary">
                  {e.eventName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {note.summary && (
        <div className="mb-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Summary
          </p>
          <p className="text-sm text-neutral-700">{note.summary}</p>
        </div>
      )}

      <hr className="mb-6 border-neutral-200" />

      {/* Content */}
      <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-800">
        {note.content}
      </pre>

      {/* Footer actions */}
      {isCreator && (
        <div className="mt-10 flex gap-3">
          <Link href={`/meetings/${note.id}/edit`}>
            <button className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 cursor-pointer">
              Edit
            </button>
          </Link>
          <DeleteNoteButton noteId={note.id} />
        </div>
      )}
    </div>
  );
}
