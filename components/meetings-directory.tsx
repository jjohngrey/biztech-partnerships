"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type MeetingsDirectoryProps = {
  initialMeetingId?: string;
};

export function MeetingsDirectory({ initialMeetingId }: MeetingsDirectoryProps) {
  const router = useRouter();

  useEffect(() => {
    const activity = initialMeetingId ? `?activity=${encodeURIComponent(`meeting:${initialMeetingId}`)}` : "";
    router.replace(`/contact-log${activity}`);
  }, [initialMeetingId, router]);

  return null;
}
