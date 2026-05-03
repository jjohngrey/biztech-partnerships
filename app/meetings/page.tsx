import { redirect } from "next/navigation";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ meetingId?: string }>;
}) {
  const params = await searchParams;
  const activity = params?.meetingId ? `?activity=${encodeURIComponent(`meeting:${params.meetingId}`)}` : "";
  redirect(`/contact-log${activity}`);
}
