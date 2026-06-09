"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, FileDown, HelpCircle, Plus, X } from "lucide-react";
import {
  archiveEmailTemplateAction,
  createEmailCampaignDraftAction,
  createEmailTemplateAction,
  enqueueEmailCampaignAction,
  updateEmailTemplateAction,
} from "@/lib/partnerships/actions";
import type {
  CrmEventSummary,
  CrmUserSummary,
  EmailCampaignRecord,
  EmailRecipientRecord,
  EmailSyncSummary,
  EmailTemplateRecord,
  PaginatedResult,
} from "@/lib/partnerships/types";
import { Pagination } from "@/components/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OutreachDirectoryProps = {
  templates: EmailTemplateRecord[];
  recipientsResult: PaginatedResult<EmailRecipientRecord>;
  campaigns: EmailCampaignRecord[];
  events: CrmEventSummary[];
  users: CrmUserSummary[];
  syncSummary: EmailSyncSummary;
  syncIngestUrl: string;
};

type TemplateForm = {
  id: string | null;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
};

type OutreachTab = "compose" | "templates" | "sync";

const mergeTokens = [
  "company_name",
  "contact_name",
  "recipient_first_name",
  "recipient_last_name",
  "recipient_full_name",
  "recipient_email",
  "sender_first_name",
  "sender_last_name",
  "sender_full_name",
  "sender_email",
  "event_name",
  "event_year",
];

function blankTemplate(): TemplateForm {
  return {
    id: null,
    name: "",
    description: "",
    subjectTemplate: "",
    bodyTemplate: "",
  };
}

function inputClass(extra = "") {
  return [
    "h-9 w-full min-w-0 max-w-full rounded-md border border-white/9 bg-[#0d0e11] px-3 text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400/70 focus:ring-2 focus:ring-zinc-400/15",
    extra,
  ].join(" ");
}

function labelClass() {
  return "grid min-w-0 max-w-full gap-1.5 text-[12px] font-medium text-zinc-400";
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    fullName: parts.join(" "),
  };
}

function extractMergeTokens(template: string) {
  const tokens = new Set<string>();
  const pattern = /{{\s*([a-z0-9_]+)\s*}}/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    tokens.add(String(match[1] ?? "").toLowerCase());
  }
  return [...tokens];
}

function renderMergeTemplate(
  template: string,
  values: Record<string, string>,
  options?: { preserveMissing?: boolean },
) {
  return template.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, rawToken) => {
    const token = String(rawToken ?? "").toLowerCase();
    const value = values[token] ?? "";
    if (!value && options?.preserveMissing) return `{{${token}}}`;
    return value;
  });
}

function mergeValues({
  recipient,
  sender,
  event,
}: {
  recipient: EmailRecipientRecord | null;
  sender: CrmUserSummary | null;
  event: CrmEventSummary | null;
}): Record<string, string> {
  const recipientName = splitName(recipient?.contactName ?? "");
  const senderName = splitName(sender?.name ?? "");
  return {
    company_name: recipient?.companyName ?? "",
    contact_name: recipient?.contactName ?? "",
    recipient_first_name: recipientName.firstName,
    recipient_last_name: recipientName.lastName,
    recipient_full_name: recipientName.fullName,
    recipient_email: recipient?.email ?? "",
    sender_first_name: senderName.firstName,
    sender_last_name: senderName.lastName,
    sender_full_name: senderName.fullName,
    sender_email: sender?.email ?? "",
    event_name: event?.name ?? "",
    event_year: event?.year ? String(event.year) : "",
  };
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSyncTime(value: string | null) {
  if (!value) return "No synced email yet";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toIsoFromDateTimeLocal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function pickEventForTemplate(
  events: CrmEventSummary[],
  template: {
    name?: string | null;
    description?: string | null;
    subjectTemplate?: string | null;
    bodyTemplate?: string | null;
  } | null,
) {
  if (!template) return null;
  const text = [
    template.name,
    template.description,
    template.subjectTemplate,
    template.bodyTemplate,
  ].filter(Boolean).join(" ").toLowerCase();

  return events.find((event) => {
    const eventWords = event.name
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !/^\d+$/.test(word));
    return eventWords.some((word) => text.includes(word));
  }) ?? null;
}

export function OutreachDirectory({
  templates,
  recipientsResult,
  campaigns,
  events,
  users,
  syncSummary,
  syncIngestUrl,
}: OutreachDirectoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipients = recipientsResult.data;
  const initialTemplate = templates[0] ?? null;
  const initialEvent = pickEventForTemplate(events, initialTemplate) ?? events[0] ?? null;
  const [templateQuery, setTemplateQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [activeTab, setActiveTab] = useState<OutreachTab>("compose");
  const [templateForm, setTemplateForm] = useState<TemplateForm>(blankTemplate);
  const [templateView, setTemplateView] = useState<"edit" | "preview">("edit");
  const [composerTemplateId, setComposerTemplateId] = useState(initialTemplate?.id ?? "");
  const [composerSubject, setComposerSubject] = useState(initialTemplate?.subjectTemplate ?? "");
  const [composerBody, setComposerBody] = useState(initialTemplate?.bodyTemplate ?? "");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [eventId, setEventId] = useState(initialEvent?.id ?? "");
  const [senderUserId, setSenderUserId] = useState(users[0]?.id ?? "");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [syncHelpOpen, setSyncHelpOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  function pushToast(toastMessage: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message: toastMessage }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return templates.filter((template) =>
      [template.name, template.description, template.subjectTemplate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [templateQuery, templates]);

  // Recipients are server-filtered; push search changes to URL with debounce
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (recipientQuery.trim() === current) return;
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("search", recipientQuery.trim());
      url.searchParams.set("page", "1");
      router.push(url.pathname + url.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [recipientQuery, router, searchParams]);

  // Clear selection when the loaded page changes
  useEffect(() => {
    setSelectedRecipientIds([]);
  }, [recipientsResult.page]);

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedRecipientIds.includes(recipient.id)),
    [recipients, selectedRecipientIds],
  );
  const previewRecipient = selectedRecipients[0] ?? null;
  const selectedEvent = events.find((event) => event.id === eventId) ?? null;
  const selectedSender = users.find((user) => user.id === senderUserId) ?? null;
  const previewValues = mergeValues({
    recipient: previewRecipient,
    sender: selectedSender,
    event: selectedEvent,
  });
  const usedMergeTokens = useMemo(
    () => Array.from(new Set([...extractMergeTokens(composerSubject), ...extractMergeTokens(composerBody)])),
    [composerSubject, composerBody],
  );
  const knownMergeTokenSet = useMemo(() => new Set(mergeTokens), []);
  const unknownMergeTokens = useMemo(
    () => usedMergeTokens.filter((token) => !knownMergeTokenSet.has(token)),
    [knownMergeTokenSet, usedMergeTokens],
  );
  const missingMergeTokens = useMemo(() => {
    if (!selectedRecipients.length || !usedMergeTokens.length) return [];
    const missing = new Set<string>();
    for (const recipient of selectedRecipients) {
      const values = mergeValues({
        recipient,
        sender: selectedSender,
        event: selectedEvent,
      });
      for (const token of usedMergeTokens) {
        if (knownMergeTokenSet.has(token) && !values[token]?.trim()) missing.add(token);
      }
    }
    return [...missing];
  }, [knownMergeTokenSet, selectedEvent, selectedRecipients, selectedSender, usedMergeTokens]);
  const mergeIssueTokens = [...unknownMergeTokens, ...missingMergeTokens];
  const previewSubject = previewRecipient
    ? renderMergeTemplate(composerSubject, previewValues, { preserveMissing: true })
    : composerSubject;
  const previewBody = previewRecipient
    ? renderMergeTemplate(composerBody, previewValues, { preserveMissing: true })
    : composerBody;
  const templatePreviewSubject = renderMergeTemplate(
    templateForm.subjectTemplate,
    previewValues,
    { preserveMissing: true },
  );
  const templatePreviewBody = renderMergeTemplate(
    templateForm.bodyTemplate,
    previewValues,
    { preserveMissing: true },
  );
  const canCreateDraft =
    selectedRecipientIds.length > 0 &&
    composerSubject.trim().length > 0 &&
    composerBody.trim().length > 0 &&
    mergeIssueTokens.length === 0;
  const syncScriptTemplate = `const INGEST_URL = "${syncIngestUrl}";
const INGEST_SECRET = "paste-secret-here";

function syncPartnershipEmails() {
  const threads = GmailApp.search("newer_than:14d");
  const messages = [];

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      messages.push({
        actorEmail: Session.getActiveUser().getEmail(),
        partnerEmail: message.getFrom(),
        subject: message.getSubject(),
        summary: message.getPlainBody().slice(0, 1200),
        direction: "inbound",
        occurredAt: message.getDate().toISOString(),
        messageId: message.getId(),
        threadId: thread.getId()
      });
    });
  });

  UrlFetchApp.fetch(INGEST_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "x-crm-ingest-secret": INGEST_SECRET },
    payload: JSON.stringify({ messages })
  });
}`;

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);
    setMessage(successMessage);
  }

  function loadTemplate(template: EmailTemplateRecord) {
    setActiveTab("templates");
    setTemplateView("edit");
    setTemplateForm({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
    });
  }

  function applyComposerTemplate(templateId: string) {
    setComposerTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setComposerSubject("");
      setComposerBody("");
      return;
    }
    setComposerSubject(template.subjectTemplate);
    setComposerBody(template.bodyTemplate);
    const matchedEvent = pickEventForTemplate(events, template);
    if (matchedEvent) setEventId(matchedEvent.id);
  }

  function composeWithTemplate(template: { id: string; subjectTemplate: string; bodyTemplate: string }) {
    setComposerTemplateId(template.id);
    setComposerSubject(template.subjectTemplate);
    setComposerBody(template.bodyTemplate);
    setActiveTab("compose");
    setMessage(null);
    setError(null);
    setConsentUrl(null);
  }

  function appendToken(token: string) {
    const value = `{{${token}}}`;
    setTemplateForm((current) => ({
      ...current,
      bodyTemplate: current.bodyTemplate ? `${current.bodyTemplate} ${value}` : value,
    }));
  }

  function toggleRecipient(recipientId: string) {
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId],
    );
  }

  function selectFilteredRecipients() {
    setSelectedRecipientIds(recipients.map((recipient) => recipient.id));
  }

  function clearSelectedRecipients() {
    setSelectedRecipientIds([]);
  }

  function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setConsentUrl(null);
    startTransition(async () => {
      try {
        if (templateForm.id) {
          await updateEmailTemplateAction({
            id: templateForm.id,
            name: templateForm.name,
            description: templateForm.description,
            subjectTemplate: templateForm.subjectTemplate,
            bodyTemplate: templateForm.bodyTemplate,
          });
          pushToast("Template updated.");
        } else {
          const created = await createEmailTemplateAction({
            name: templateForm.name,
            description: templateForm.description,
            subjectTemplate: templateForm.subjectTemplate,
            bodyTemplate: templateForm.bodyTemplate,
          });
          setTemplateForm({
            id: created.id,
            name: created.name,
            description: created.description ?? "",
            subjectTemplate: created.subjectTemplate,
            bodyTemplate: created.bodyTemplate,
          });
          pushToast("Template created.");
        }
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save template.");
      }
    });
  }

  function archiveTemplate() {
    if (!templateForm.id) return;
    setError(null);
    setMessage(null);
    setConsentUrl(null);
    startTransition(async () => {
      await archiveEmailTemplateAction(templateForm.id!, true);
      setTemplateView("edit");
      setTemplateForm(blankTemplate());
      pushToast("Template archived.");
      router.refresh();
    });
  }

  function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setConsentUrl(null);
    startTransition(async () => {
      try {
        await createEmailCampaignDraftAction({
          templateId: composerTemplateId || undefined,
          eventId: eventId || undefined,
          senderUserId: senderUserId || undefined,
          subject: composerSubject,
          body: composerBody,
          recipientIds: selectedRecipientIds,
          scheduledAtIso: toIsoFromDateTimeLocal(scheduledAtLocal),
        });
        setMessage(`Outreach draft saved for ${selectedRecipientIds.length} recipients.`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save outreach draft.");
      }
    });
  }

  function sendCampaign(campaignId: string, scheduledAtIso?: string | null) {
    if (
      !window.confirm(
        "This will send the rendered email to every queued recipient in this outreach draft from your connected Gmail account.",
      )
    ) return;
    setError(null);
    setMessage(null);
    setConsentUrl(null);
    startTransition(async () => {
      try {
        const result = await enqueueEmailCampaignAction({
          campaignId,
          scheduledAtIso: scheduledAtIso ?? undefined,
        });
        if (result.kind === "needs-consent") {
          setConsentUrl(result.consentUrl);
          setMessage("Gmail access is needed before queueing this campaign.");
          return;
        }
        const scheduleMessage = result.scheduledAtIso
          ? ` Scheduled for ${new Date(result.scheduledAtIso).toLocaleString("en-CA")}.`
          : "";
        setMessage(`Queued ${result.queuedRecipientCount} recipients for background send.${scheduleMessage}`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not queue outreach draft.");
      }
    });
  }

  function exportPreview() {
    const rows = [
      ["company", "contact", "email", "subject", "body"],
      ...selectedRecipients.map((recipient) => {
        const values = mergeValues({
          recipient,
          sender: selectedSender,
          event: selectedEvent,
        });
        return [
          recipient.companyName,
          recipient.contactName,
          recipient.email,
          renderMergeTemplate(composerSubject, values),
          renderMergeTemplate(composerBody, values),
        ];
      }),
    ];
    downloadCsv("mail-merge-preview.csv", rows);
  }

  const tabs: Array<{ id: OutreachTab; label: string; count?: number }> = [
    { id: "compose", label: "Compose" },
    { id: "templates", label: "Templates", count: templates.length },
    { id: "sync", label: "Sync" },
  ];

  return (
    <div className="max-h-screen w-full max-w-full overflow-x-hidden bg-[#0d0d0f] px-3 py-4 text-zinc-100 sm:px-5 sm:py-5">
      <div className="border-b border-white/8 pb-3">
        <div className="flex min-w-0 flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="min-w-0 truncate text-[15px] font-medium text-zinc-100">Outreach</h2>
          <a
            href="/api/partnerships/export"
            className="inline-flex h-8 w-fit shrink-0 items-center justify-center gap-2 rounded-md border border-white/9 px-3 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100"
          >
            <FileDown className="size-4" strokeWidth={1.8} />
            Export CRM CSV
          </a>
        </div>
        <div className="-mx-3 mt-3 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OutreachTab)} className="min-w-max">
            <TabsList variant="row">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="cursor-pointer">
                  {tab.label}
                  {typeof tab.count === "number" && (
                    <span className="rounded bg-black/25 px-1 py-0.5 text-[11px] text-zinc-400 sm:px-1.5">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {(message || error || consentUrl) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-white/8 bg-[#111113] px-3 py-2">
          {message && <p className="text-[13px] text-zinc-400">{message}</p>}
          {error && <p className="text-[13px] text-red-300">{error}</p>}
          {consentUrl && (
            <a href={consentUrl} className="text-[13px] text-zinc-200 underline decoration-zinc-500 underline-offset-4">
              Connect Gmail
            </a>
          )}
        </div>
      )}

      {activeTab === "compose" && (
        <form onSubmit={submitCampaign} className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-md border border-white/9 bg-[#111113]">
            <div className="border-b border-white/8 px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Draft email</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                <label className={labelClass()}>
                  Template
                  <select value={composerTemplateId} onChange={(event) => applyComposerTemplate(event.target.value)} className={inputClass()}>
                    <option value="">Manual</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass()}>
                  Event
                  <select value={eventId} onChange={(event) => setEventId(event.target.value)} className={inputClass()}>
                    <option value="">No event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass()}>
                  BizTech Director
                  <select value={senderUserId} onChange={(event) => setSenderUserId(event.target.value)} className={inputClass()}>
                    <option value="">No BizTech Director</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={labelClass()}>
                Schedule send (optional)
                <input
                  type="datetime-local"
                  value={scheduledAtLocal}
                  onChange={(event) => setScheduledAtLocal(event.target.value)}
                  className={inputClass()}
                />
              </label>
              <div className="grid min-w-0 gap-2 rounded-md border border-white/8 bg-[#0d0e11] px-3 py-2 xl:hidden">
                <p className="text-[12px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{selectedRecipientIds.length}</span> recipients selected
                </p>
                <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:items-center">
                  <button type="button" onClick={selectFilteredRecipients} className="h-7 min-w-0 truncate rounded-md border border-white/8 px-2 text-[12px] text-zinc-500 transition hover:bg-white/5.5 hover:text-zinc-200 sm:border-0 cursor-pointer">
                    Select visible
                  </button>
                  <button type="button" onClick={clearSelectedRecipients} className="h-7 min-w-0 truncate rounded-md border border-white/8 px-2 text-[12px] text-zinc-500 transition hover:bg-white/5.5 hover:text-zinc-200 sm:border-0 cursor-pointer">
                    Clear
                  </button>
                </div>
                {previewRecipient && (
                  <div className="min-w-0 border-t border-white/8 pt-2">
                    <p className="truncate text-[12px] text-zinc-500">
                      Previewing {previewRecipient.contactName} · {previewRecipient.companyName}
                    </p>
                    <p className="mt-1 truncate text-[12px] font-medium text-zinc-200">
                      {previewSubject || "No subject"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        disabled={isPending || !canCreateDraft}
                        className="h-8 rounded-md bg-zinc-700 px-2 text-[12px] font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                        Save draft
                      </button>
                      <button
                        type="button"
                        disabled={!canCreateDraft}
                        onClick={exportPreview}
                        className="h-8 rounded-md border border-white/9 px-2 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <label className={labelClass()}>
                Subject
                <input value={composerSubject} onChange={(event) => setComposerSubject(event.target.value)} required className={inputClass()} />
              </label>
              <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <label className={labelClass()}>
                  Body
                  <textarea value={composerBody} onChange={(event) => setComposerBody(event.target.value)} required rows={12} className={inputClass("h-auto py-2")} />
                </label>
                <div className="min-w-0 rounded-md border border-white/8 bg-[#0d0e11] p-4">
                  <div className="grid min-w-0 gap-1">
                    <p className="text-[13px] font-medium text-zinc-200">Preview</p>
                    <p className="min-w-0 max-w-full truncate text-[12px] text-zinc-500">{previewRecipient ? previewRecipient.email : "No recipient selected"}</p>
                  </div>
                  <p className="mt-3 truncate text-[13px] font-medium text-zinc-100">{previewSubject || "No subject"}</p>
                  <pre className="mt-3 max-h-90 overflow-auto whitespace-pre-wrap rounded-md bg-white/[0.035] p-3 text-[12px] leading-5 text-zinc-400">{previewBody || (previewRecipient ? "No body" : "Choose a template or write a draft to preview it.")}</pre>
                  {mergeIssueTokens.length > 0 && selectedRecipientIds.length > 0 && (
                    <div className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-[12px] leading-5 text-amber-100">
                      Missing merge values: {mergeIssueTokens.join(", ")}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={isPending || !canCreateDraft}
                  title={mergeIssueTokens.length ? "Resolve missing merge values before creating a draft." : undefined}
                  className="h-9 rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                  Save outreach draft
                </button>
                <button
                  type="button"
                  disabled={!canCreateDraft}
                  title={mergeIssueTokens.length ? "Resolve missing merge values before exporting." : undefined}
                  onClick={exportPreview}
                  className="h-9 rounded-md border border-white/9 px-3 text-[13px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                  Export preview CSV
                </button>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-white/9 bg-[#111113]">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-200">Recipients</p>
                <p className="mt-0.5 text-[12px] text-zinc-500">{selectedRecipientIds.length} selected</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={selectFilteredRecipients} className="h-7 rounded-md px-2 text-[12px] text-zinc-500 transition hover:bg-white/5.5 hover:text-zinc-200 cursor-pointer">
                  Select visible
                </button>
                <button type="button" onClick={clearSelectedRecipients} className="h-7 rounded-md px-2 text-[12px] text-zinc-500 transition hover:bg-white/5.5 hover:text-zinc-200 cursor-pointer">
                  Clear
                </button>
              </div>
            </div>
            <div className="p-4">
              <input
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                className={inputClass("w-full")}
                placeholder="Search contacts..."
              />
              <div className="mt-3 max-h-105 overflow-auto rounded-md border border-white/8 xl:max-h-[calc(100dvh-260px)]">
                {recipients.map((recipient) => (
                  <label key={recipient.id} className="flex cursor-pointer items-start gap-3 border-b border-white/6 px-3 py-3 transition hover:bg-white/[0.035]">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.includes(recipient.id)}
                      onChange={() => toggleRecipient(recipient.id)}
                      className="mt-0.5 size-4 accent-zinc-300"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-100">{recipient.contactName}</span>
                      <span className="block truncate text-[12px] text-zinc-500">{recipient.companyName} · {recipient.email}</span>
                    </span>
                  </label>
                ))}
                {!recipients.length && <p className="px-3 py-4 text-[13px] text-zinc-500">No email-ready contacts.</p>}
              </div>
              <Pagination
                {...recipientsResult}
                onPageChange={(p) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("page", String(p));
                  router.push(url.pathname + url.search);
                }}
              />
            </div>
          </section>
        </form>
      )}

      {activeTab === "templates" && (
        <section className="mt-4 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="min-w-0 rounded-md border border-white/9 bg-[#111113]">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">Templates</p>
              <button
                type="button"
                onClick={() => {
                  setTemplateView("edit");
                  setTemplateForm(blankTemplate());
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-zinc-400 transition hover:bg-white/5.5 hover:text-zinc-100 cursor-pointer"
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
                New
              </button>
            </div>
            <div className="border-b border-white/8 p-3">
              <input
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                className={inputClass("w-full")}
                placeholder="Search templates..."
              />
            </div>
            <div className="max-h-[calc(100dvh-230px)] overflow-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => loadTemplate(template)}
                  className={["block w-full border-b border-white/6 px-4 py-3 text-left transition hover:bg-white/[0.035] cursor-pointer",
                    templateForm.id === template.id ? "bg-white/5.5" : "",
                  ].join(" ")}
                >
                  <span className="block truncate text-[13px] font-medium text-zinc-100">{template.name}</span>
                  <span className="mt-1 block truncate text-[12px] text-zinc-500">{template.subjectTemplate}</span>
                </button>
              ))}
              {!filteredTemplates.length && (
                <p className="px-4 py-4 text-[13px] text-zinc-500">No templates yet.</p>
              )}
            </div>
          </div>

          <form onSubmit={submitTemplate} className="min-w-0 rounded-md border border-white/9 bg-[#111113]">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
              <p className="text-[13px] font-medium text-zinc-200">{templateForm.id ? "Edit template" : "New template"}</p>
              <div className="flex items-center gap-1 rounded-md border border-white/9 p-0.5">
                <button
                  type="button"
                  onClick={() => setTemplateView("edit")}
                  className={[
                    "h-7 rounded-[5px] px-2.5 text-[12px] font-medium transition cursor-pointer",
                    templateView === "edit"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:bg-white/4.5 hover:text-zinc-100",
                  ].join(" ")}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateView("preview")}
                  className={[
                    "h-7 rounded-[5px] px-2.5 text-[12px] font-medium transition cursor-pointer",
                    templateView === "preview"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:bg-white/4.5 hover:text-zinc-100",
                  ].join(" ")}
                >
                  Preview
                </button>
              </div>
            </div>
            {templateView === "edit" ? (
            <div className="space-y-3 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass()}>
                  Name
                  <input
                    value={templateForm.name}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    className={inputClass()}
                  />
                </label>
                <label className={labelClass()}>
                  Description
                  <input
                    value={templateForm.description}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))}
                    className={inputClass()}
                  />
                </label>
              </div>
              <label className={labelClass()}>
                Subject
                <input
                  value={templateForm.subjectTemplate}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, subjectTemplate: event.target.value }))}
                  required
                  className={inputClass()}
                />
              </label>
              <label className={labelClass()}>
                Body
                <textarea
                  value={templateForm.bodyTemplate}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, bodyTemplate: event.target.value }))}
                  required
                  rows={13}
                  className={inputClass("h-auto py-2")}
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {mergeTokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => appendToken(token)}
                    className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/4.5 hover:text-zinc-200"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  disabled={isPending}
                  className="h-8 rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600 disabled:opacity-60 cursor-pointer">
                  {templateForm.id ? "Save template" : "Create template"}
                </button>
                {templateForm.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!templateForm.id) return;
                      composeWithTemplate({
                        id: templateForm.id,
                        subjectTemplate: templateForm.subjectTemplate,
                        bodyTemplate: templateForm.bodyTemplate,
                      });
                    }}
                    className="h-8 rounded-md border border-white/9 px-3 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
                  >
                    Use in draft
                  </button>
                )}
                {templateForm.id && (
                  <button
                    type="button"
                    onClick={archiveTemplate}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 cursor-pointer">
                    <Archive className="size-3.5" strokeWidth={1.8} />
                    Archive
                  </button>
                )}
              </div>
            </div>
            ) : (
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Subject</p>
                <p className="mt-1 text-[13px] text-zinc-100">
                  {templatePreviewSubject || <span className="text-zinc-600">No subject yet</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Body</p>
                {templateForm.bodyTemplate ? (
                  <pre className="mt-1 whitespace-pre-wrap wrap-break-word font-sans text-[13px] text-zinc-200">
                    {templatePreviewBody}
                  </pre>
                ) : (
                  <p className="mt-1 text-[13px] text-zinc-600">No body yet</p>
                )}
              </div>
              {previewRecipient ? (
                <p className="text-[12px] text-zinc-500">
                  Previewing for <span className="text-zinc-300">{previewRecipient.contactName || previewRecipient.email}</span>
                  {previewRecipient.companyName ? ` · ${previewRecipient.companyName}` : ""}
                  {selectedEvent ? ` · ${selectedEvent.name}` : ""}
                </p>
              ) : (
                <p className="text-[12px] text-zinc-500">
                  Select a recipient on the Compose tab to see merged values. Unresolved tokens are shown as <code className="rounded bg-white/6 px-1 py-0.5 text-zinc-300">{`{{token}}`}</code>.
                </p>
              )}
            </div>
            )}
          </form>
        </section>
      )}

      {activeTab === "compose" && campaigns.length > 0 && (
        <section className="mt-4 rounded-md border border-white/9 bg-[#111113]">
          <div className="border-b border-white/8 px-4 py-3">
            <p className="text-[13px] font-medium text-zinc-200">Outreach drafts</p>
          </div>
          <div className="divide-y divide-white/6">
            {campaigns.map((campaign) => {
              const sentCount = campaign.sends.filter((send) => send.status === "sent").length;
              const failedCount = campaign.sends.filter((send) => send.status === "failed").length;
              const skippedCount = campaign.sends.filter((send) => send.status === "skipped").length;
              const queuedCount = campaign.sends.filter((send) => send.status === "queued").length;
              const total = campaign.sends.length;
              const inFlight = campaign.status === "queued" || campaign.status === "sending";
              const terminal = campaign.status === "sent" || campaign.status === "partial";
              const buttonLabel = inFlight
                ? campaign.status === "queued"
                  ? "Queued"
                  : "Sending…"
                : terminal
                  ? "Done"
                  : "Queue send";
              return (
                <div key={campaign.id} className="grid gap-3 px-4 py-3 text-[13px] text-zinc-400 md:grid-cols-[minmax(0,1fr)_140px_110px_90px_100px] md:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-100">{campaign.subject}</span>
                    <span className="block truncate text-[12px] text-zinc-500">
                      {campaign.eventName ?? "No event"} · {campaign.senderName ?? "No BizTech Director"}
                      {campaign.scheduledAtIso
                        ? ` · scheduled ${new Date(campaign.scheduledAtIso).toLocaleString("en-CA")}`
                        : ""}
                    </span>
                  </span>
                  <span className="text-[12px]">
                    {sentCount} of {total} sent
                    {queuedCount > 0 ? ` · ${queuedCount} queued` : ""}
                    {failedCount > 0 ? (
                      <span className="block text-red-300">{failedCount} failed</span>
                    ) : null}
                    {skippedCount > 0 ? (
                      <span className="block text-zinc-500">{skippedCount} skipped</span>
                    ) : null}
                  </span>
                  <span>{new Date(campaign.createdAtIso).toLocaleDateString("en-CA")}</span>
                  <span className="rounded-md bg-white/5.5 px-2 py-1 text-center text-[12px] capitalize text-zinc-300">{campaign.status}</span>
                  <button
                    type="button"
                    disabled={isPending || inFlight || terminal || queuedCount === 0}
                    onClick={() => {
                      if (!window.confirm(`Queue this outreach draft for ${queuedCount} recipient${queuedCount === 1 ? "" : "s"}?`)) return;
                      sendCampaign(campaign.id, campaign.scheduledAtIso);
                    }}
                    className="h-8 rounded-md border border-white/9 px-2.5 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    {buttonLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "sync" && (
        <section className="mt-4 rounded-md border border-white/9 bg-[#111113]">
          <div className="flex min-w-0 flex-col gap-2 border-b border-white/8 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-zinc-200">Gmail sync</p>
              <p className="mt-0.5 text-[12px] text-zinc-500">Turns email replies into contact history when the company or person already exists.</p>
            </div>
            <button
              type="button"
              onClick={() => setSyncHelpOpen(true)}
              className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-md border border-white/9 px-3 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
            >
              <HelpCircle className="size-3.5" strokeWidth={1.8} />
              How to sync
            </button>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <div className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
              <p className="text-[12px] text-zinc-500">Last email</p>
              <p className="mt-2 truncate text-[13px] font-medium text-zinc-100">
                {formatSyncTime(syncSummary.lastSyncedAtIso)}
              </p>
            </div>
            <div className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
              <p className="text-[12px] text-zinc-500">Logged emails</p>
              <p className="mt-2 text-[13px] font-medium text-zinc-100">{syncSummary.syncedMessageCount}</p>
            </div>
            <div className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
              <p className="text-[12px] text-zinc-500">Matched records</p>
              <p className="mt-2 text-[13px] font-medium text-zinc-100">
                {syncSummary.linkedCompanyCount} companies · {syncSummary.linkedPartnerCount} people
              </p>
            </div>
          </div>
          <div className="grid gap-3 border-t border-white/8 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <label className={labelClass()}>
              Webhook URL
              <input readOnly value={syncIngestUrl} className={inputClass("w-full")} />
            </label>
            <button
              type="button"
              onClick={() => copyText(syncIngestUrl, "Webhook URL copied.")}
              className="h-9 rounded-md border border-white/9 px-3 text-[13px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
            >
              Copy URL
            </button>
            <button
              type="button"
              onClick={() => copyText(syncScriptTemplate, "Apps Script copied.")}
              className="h-9 rounded-md bg-zinc-700 px-3 text-[13px] font-medium text-white transition hover:bg-zinc-600 cursor-pointer"
            >
              Copy script
            </button>
          </div>
        </section>
      )}

      {syncHelpOpen && (
        <div className="fixed inset-0 z-50 grid min-w-0 place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="flex h-[calc(100dvh-132px)] w-[calc(100dvw-32px)] max-w-140 flex-col overflow-hidden rounded-md border border-white/10 bg-[#111113] shadow-2xl shadow-black/50">
            <div className="flex min-w-0 shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-zinc-100">Sync Gmail contact history</p>
                <p className="mt-0.5 wrap-break-word text-[12px] text-zinc-500">Syncs outreach replies into contact history when Gmail can match the people involved.</p>
              </div>
              <button
                type="button"
                aria-label="Close sync help"
                onClick={() => setSyncHelpOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/5.5 hover:text-zinc-100 cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 [&_code]:break-all">
              <p className="text-[13px] leading-5 text-zinc-500">
                Use this when directors want Gmail replies to show up in contact history. The sync only attaches emails to existing companies, people, and directors.
              </p>

              <ol className="space-y-3 text-[13px] leading-5 text-zinc-400">
                <li className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
                  <span className="font-medium text-zinc-200">1. Copy the webhook URL.</span>
                  <p className="mt-1 text-zinc-500">Paste it into the script where <code className="rounded bg-white/6 px-1 text-zinc-300">INGEST_URL</code> appears.</p>
                </li>
                <li className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
                  <span className="font-medium text-zinc-200">2. Copy the Apps Script.</span>
                  <p className="mt-1 text-zinc-500">Open Google Apps Script from the Gmail account being synced, paste the script, then save it.</p>
                </li>
                <li className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
                  <span className="font-medium text-zinc-200">3. Add the ingest secret.</span>
                  <p className="mt-1 text-zinc-500">Replace <code className="rounded bg-white/6 px-1 text-zinc-300">paste-secret-here</code> with the app&apos;s <code className="rounded bg-white/6 px-1 text-zinc-300">PARTNERSHIPS_EMAIL_INGEST_SECRET</code>.</p>
                </li>
                <li className="rounded-md border border-white/8 bg-[#0d0e11] p-3">
                  <span className="font-medium text-zinc-200">4. Run once, then schedule.</span>
                  <p className="mt-1 text-zinc-500">Run <code className="rounded bg-white/6 px-1 text-zinc-300">syncPartnershipEmails</code> manually first. If the expected contact history appears, add a time-based trigger.</p>
                </li>
              </ol>

              <label className={labelClass()}>
                Apps Script
                <textarea
                  readOnly
                  value={syncScriptTemplate}
                  rows={10}
                  className={inputClass("h-auto min-h-55 w-full font-mono text-[12px] leading-5")}
                />
              </label>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/8 px-4 py-3">
              <button
                type="button"
                onClick={() => copyText(syncIngestUrl, "Webhook URL copied.")}
                className="h-8 rounded-md border border-white/9 px-3 text-[12px] font-medium text-zinc-400 transition hover:bg-white/4.5 hover:text-zinc-100 cursor-pointer"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => copyText(syncScriptTemplate, "Apps Script copied.")}
                className="h-8 rounded-md bg-zinc-700 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-600 cursor-pointer"
              >
                Copy script
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto rounded-md border border-white/10 bg-[#111113] px-3 py-2 text-[13px] text-zinc-200 shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
