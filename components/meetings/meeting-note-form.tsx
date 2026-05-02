"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PartnerPicker, type PartnerOption } from "@/components/meetings/partner-picker";
import { AttendeePicker, type UserOption } from "@/components/meetings/attendee-picker";
import { EventPicker, type EventOption } from "@/components/meetings/event-picker";
import Link from "next/link";
import type { ActionState } from "@/lib/validation/meeting-notes";

interface MeetingNoteFormProps {
  partners: PartnerOption[];
  users: UserOption[];
  events: EventOption[];
  currentUserId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  // Pre-populated values for edit mode
  defaultValues?: {
    title?: string;
    meetingDate?: string;
    summary?: string;
    content?: string;
    source?: "upload" | "paste";
    originalFilename?: string;
    partnerIds?: string[];
    biztechAttendeeIds?: string[];
    eventIds?: string[];
  };
  cancelHref: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save note"}
    </Button>
  );
}

export function MeetingNoteForm({
  partners,
  users,
  events,
  currentUserId,
  action,
  defaultValues,
  cancelHref,
}: MeetingNoteFormProps) {
  const [state, formAction] = useActionState(action, null);

  const defaultSource = defaultValues?.source ?? "paste";
  const [activeTab, setActiveTab] = useState<"upload" | "paste">(defaultSource);

  // Paste path state
  const [pasteContent, setPasteContent] = useState(
    defaultSource === "paste" ? (defaultValues?.content ?? "") : ""
  );

  // Upload path state
  const [uploadContent, setUploadContent] = useState(
    defaultSource === "upload" ? (defaultValues?.content ?? "") : ""
  );
  const [uploadFilename, setUploadFilename] = useState(defaultValues?.originalFilename ?? "");
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Picker state
  const [partnerIds, setPartnerIds] = useState<string[]>(defaultValues?.partnerIds ?? []);
  const [biztechAttendeeIds, setBiztechAttendeeIds] = useState<string[]>(
    defaultValues?.biztechAttendeeIds ?? (currentUserId ? [currentUserId] : [])
  );
  const [eventIds, setEventIds] = useState<string[]>(defaultValues?.eventIds ?? []);

  // Dirty tracking for beforeunload
  const isDirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const markDirty = () => { isDirty.current = true; };

  const handleTabChange = (tab: string) => {
    const currentContent = activeTab === "paste" ? pasteContent : uploadContent;
    if (currentContent) {
      const ok = confirm("Switching tabs will clear your current content. Continue?");
      if (!ok) return;
    }
    setPasteContent("");
    setUploadContent("");
    setUploadFilename("");
    if (fileRef.current) fileRef.current.value = "";
    setActiveTab(tab as "upload" | "paste");
    markDirty();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      setFileError("Only .txt files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("File must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }

    setUploadFilename(file.name);
    markDirty();

    const reader = new FileReader();
    reader.onload = (evt) => {
      setUploadContent((evt.target?.result as string) ?? "");
    };
    reader.readAsText(file);
  };

  const activeContent = activeTab === "paste" ? pasteContent : uploadContent;

  // Today formatted as YYYY-MM-DD for date input default
  const today = new Date().toISOString().split("T")[0];

  return (
    <form
      action={formAction}
      onChange={markDirty}
      className="flex flex-col gap-6"
    >
      {/* Hidden fields for picker values */}
      {partnerIds.map((id) => (
        <input key={id} type="hidden" name="partnerIds" value={id} />
      ))}
      {biztechAttendeeIds.map((id) => (
        <input key={id} type="hidden" name="biztechAttendeeIds" value={id} />
      ))}
      {eventIds.map((id) => (
        <input key={id} type="hidden" name="eventIds" value={id} />
      ))}
      <input type="hidden" name="source" value={activeTab} />
      <input type="hidden" name="content" value={activeContent} />
      {activeTab === "upload" && (
        <input type="hidden" name="originalFilename" value={uploadFilename} />
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-neutral-900">
          Title <span className="text-red-500">*</span>
        </label>
        <Input
          id="title"
          name="title"
          maxLength={200}
          defaultValue={defaultValues?.title ?? ""}
          placeholder="e.g. Intro call with Accenture"
          required
        />
        {state?.errors?.title && (
          <p className="text-sm text-red-600">{state.errors.title[0]}</p>
        )}
      </div>

      {/* Meeting Date */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="meetingDate" className="text-sm font-medium text-neutral-900">
          Meeting Date <span className="text-red-500">*</span>
        </label>
        <input
          id="meetingDate"
          name="meetingDate"
          type="date"
          max={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
          defaultValue={defaultValues?.meetingDate ? defaultValues.meetingDate.split("T")[0] : today}
          required
          className="h-9 w-48 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        {state?.errors?.meetingDate && (
          <p className="text-sm text-red-600">{state.errors.meetingDate[0]}</p>
        )}
      </div>

      {/* Content tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="upload">Upload .txt</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3 flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="text-sm text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1 file:text-sm file:font-medium file:text-neutral-900 file:hover:bg-neutral-50"
          />
          {fileError && <p className="text-sm text-red-600">{fileError}</p>}
          {uploadContent && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 text-xs text-neutral-400">Preview</p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700">
                {uploadContent.slice(0, 300)}
                {uploadContent.length > 300 && "…"}
              </pre>
            </div>
          )}
          {state?.errors?.content && (
            <p className="text-sm text-red-600">{state.errors.content[0]}</p>
          )}
        </TabsContent>

        <TabsContent value="paste" className="mt-3">
          <Textarea
            placeholder="Paste your meeting notes here…"
            value={pasteContent}
            onChange={(e) => { setPasteContent(e.target.value); markDirty(); }}
            className="min-h-48 font-mono text-sm"
          />
          {state?.errors?.content && (
            <p className="mt-1 text-sm text-red-600">{state.errors.content[0]}</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="summary" className="text-sm font-medium text-neutral-900">
            Summary <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <span className="text-xs text-neutral-400">
            {/* We read the textarea value from state below */}
          </span>
        </div>
        <SummaryTextarea
          defaultValue={defaultValues?.summary ?? ""}
          error={state?.errors?.summary?.[0]}
        />
      </div>

      {/* Partner Attendees */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">
          Partner Attendees <span className="text-red-500">*</span>
        </label>
        <PartnerPicker
          partners={partners}
          value={partnerIds}
          onChange={setPartnerIds}
          error={state?.errors?.partnerIds?.[0]}
        />
      </div>

      {/* BizTech Team */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">
          BizTech Team <span className="text-red-500">*</span>
        </label>
        <AttendeePicker
          users={users}
          currentUserId={currentUserId}
          value={biztechAttendeeIds}
          onChange={setBiztechAttendeeIds}
          error={state?.errors?.biztechAttendeeIds?.[0]}
        />
      </div>

      {/* Events */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">Events</label>
        <EventPicker
          events={events}
          value={eventIds}
          onChange={setEventIds}
        />
      </div>

      {/* Global error */}
      {state?.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
        <Link href={cancelHref}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

// Separate component to track summary character count
function SummaryTextarea({
  defaultValue,
  error,
}: {
  defaultValue: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Textarea
          id="summary"
          name="summary"
          maxLength={500}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Optional TL;DR shown in list view…"
          className="min-h-20"
        />
        <span className="absolute bottom-2 right-3 text-xs text-neutral-400">
          {value.length}/500
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
