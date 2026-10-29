"use client";

import {
  AlertCircle,
  CheckCircle2,
  Code,
  Eye,
  History,
  Mail,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import type { EmailTemplate, EmailTemplateVersion } from "@/db/schema";
import { saveTemplateVersionAction, sendTestEmailAction } from "@/app/admin/emails/actions";
import { APPROVED_VARIABLES, renderTemplateContent } from "@/lib/admin/email-template-utils";

interface TemplateEditorProps {
  template: EmailTemplate;
  versions: EmailTemplateVersion[];
  adminEmail: string;
}

export function TemplateEditor({ template, versions, adminEmail }: TemplateEditorProps) {
  const [subject, setSubject] = useState(template.subject);
  const [preheader, setPreheader] = useState(template.preheader || "");
  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const [textBody, setTextBody] = useState(template.textBody);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">("preview");
  const [testEmail, setTestEmail] = useState(adminEmail);
  const [changeNotes, setChangeNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sample data dictionary for real-time live preview
  const sampleData = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of APPROVED_VARIABLES) {
      map[v.key] = v.sample;
    }
    return map;
  }, []);

  const renderedHtmlPreview = useMemo(() => {
    return renderTemplateContent(htmlBody, sampleData);
  }, [htmlBody, sampleData]);

  const renderedSubjectPreview = useMemo(() => {
    return renderTemplateContent(subject, sampleData);
  }, [subject, sampleData]);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await saveTemplateVersionAction(
        template.id,
        template.slug,
        subject,
        htmlBody,
        textBody,
        preheader || null,
        changeNotes.trim() || `Updated template version`
      );

      if (res.ok) {
        setFeedback({ text: `Version ${res.version} successfully published!`, type: "success" });
        setChangeNotes("");
      } else {
        setFeedback({ text: res.error || "Failed to publish template", type: "error" });
      }
    });
  };

  const handleSendTest = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendTestEmailAction(
        template.slug,
        testEmail,
        subject,
        htmlBody,
        textBody
      );

      if (res.ok) {
        setFeedback({
          text: `Test email queued for ${testEmail}. Check outbox for delivery status.`,
          type: "success",
        });
      } else {
        setFeedback({ text: res.error || "Failed to dispatch test email", type: "error" });
      }
    });
  };

  const insertVariable = (varKey: string) => {
    setHtmlBody((prev) => `${prev}{{${varKey}}}`);
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Editor Controls & Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "preview"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Eye className="size-3.5" />
            <span>Split Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "edit"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Code className="size-3.5" />
            <span>HTML & Text Source</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <History className="size-3.5" />
            <span>Version History ({versions.length})</span>
          </button>
        </div>

        {/* Device toggles for preview */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setPreviewDevice("desktop")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              previewDevice === "desktop" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            Desktop (600px)
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice("mobile")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
              previewDevice === "mobile" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            <Smartphone className="size-3" />
            <span>Mobile</span>
          </button>
        </div>
      </div>

      {activeTab === "history" ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-foreground">Immutable Version Ledger</h2>
          <div className="divide-y divide-border/60">
            {versions.map((v) => (
              <div key={v.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span className="font-mono px-2 py-0.5 rounded bg-muted">v{v.versionNumber}</span>
                    <span>{v.subject}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{v.changeNotes || "No notes documented"}</p>
                </div>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {new Date(v.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Form Fields & HTML Code */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Preheader Text</label>
                <input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="Summary text previewed in mailbox list..."
                  className="w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary"
                />
              </div>

              {/* Dynamic Variable Chips */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Insert Approved Dynamic Variable</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {APPROVED_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      title={`${v.description} (e.g. ${v.sample})`}
                      className="px-2 py-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-[10px] font-mono text-muted-foreground transition-colors"
                    >
                      +{v.key}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">HTML Template Body</label>
                <textarea
                  rows={14}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="w-full bg-muted/30 border border-border font-mono text-xs rounded-xl p-3 outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Plain Text Alternative</label>
                <textarea
                  rows={4}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  className="w-full bg-muted/30 border border-border font-mono text-xs rounded-xl p-3 outline-none focus:border-primary"
                />
              </div>

              {/* Publishing Controls */}
              <div className="pt-3 border-t border-border space-y-3">
                <input
                  type="text"
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="Document version change notes (e.g. Added button styling)..."
                  className="w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-1.5 outline-none focus:border-primary"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Creates immutable v{template.version + 1}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handlePublish}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {isPending ? "Publishing..." : `Publish New Version`}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Send Card */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-foreground">Send Test Preview Email</label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@domain.com"
                  className="flex-1 bg-muted/40 border border-border text-xs rounded-lg px-3 py-1.5 outline-none focus:border-primary"
                />
                <button
                  type="button"
                  disabled={isPending || !testEmail}
                  onClick={handleSendTest}
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="size-3" />
                  <span>Send Test</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Rendered Device Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>Live Rendered Client Preview</span>
              <span className="font-mono text-[10px]">Zero-eval Safe Escaping</span>
            </div>

            <div className="rounded-2xl border border-border bg-slate-100 dark:bg-slate-900/80 p-4 sm:p-6 flex justify-center shadow-inner overflow-hidden min-h-[500px]">
              <div
                className={`bg-white text-slate-900 rounded-xl shadow-xl transition-all overflow-hidden flex flex-col ${
                  previewDevice === "mobile" ? "w-[360px]" : "w-[600px] max-w-full"
                }`}
              >
                {/* Mock Email Client Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 text-sm">{renderedSubjectPreview}</div>
                  <div className="text-[11px] text-slate-500">From: AI Tathastu &lt;support.aitathastu@gmail.com&gt;</div>
                  <div className="text-[11px] text-slate-500">To: Alex Morgan &lt;alex@university.edu&gt;</div>
                </div>

                {/* Rendered HTML Body */}
                <div
                  className="p-4 overflow-y-auto max-h-[600px]"
                  dangerouslySetInnerHTML={{ __html: renderedHtmlPreview }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
