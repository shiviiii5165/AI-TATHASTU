"use client";

import { CheckCircle2, Play, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { triggerOutboxDeliveryAction } from "@/app/admin/emails/actions";

export function OutboxControls() {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleProcess = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerOutboxDeliveryAction();
      if (res.ok && "processed" in res) {
        setFeedback(`Processed ${res.processed} items (Sent: ${res.sent}, Failed: ${res.failed})`);
      } else {
        setFeedback(("error" in res && res.error) ? res.error : "Failed to trigger outbox");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      {feedback && (
        <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-md">
          {feedback}
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleProcess}
        className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
        <span>{isPending ? "Processing Outbox..." : "Process Due Deliveries"}</span>
      </button>
    </div>
  );
}
