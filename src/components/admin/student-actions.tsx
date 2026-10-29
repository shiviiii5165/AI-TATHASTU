"use client";

import { AlertCircle, CheckCircle2, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  executeStudentDeletionAction,
  revokeStudentSessionsAction,
} from "@/app/admin/students/actions";

interface StudentActionsProps {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
  isDeleted: boolean;
  sessionsCount: number;
}

export function StudentActions({
  userId,
  userName,
  userEmail,
  isAdmin,
  isDeleted,
  sessionsCount,
}: StudentActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const handleRevokeSessions = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await revokeStudentSessionsAction(userId);
      if (res.ok) {
        setMessage({
          text: `Successfully revoked active database sessions (${res.revokedCount} invalidated).`,
          type: "success",
        });
      } else {
        setMessage({ text: res.error || "Failed to revoke sessions", type: "error" });
      }
    });
  };

  const handleDeleteWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason.trim()) return;
    setMessage(null);

    startTransition(async () => {
      const res = await executeStudentDeletionAction(userId, deleteReason.trim());
      if (res.ok) {
        setMessage({ text: res.message || "Account deletion workflow completed.", type: "success" });
        setShowDeleteModal(false);
      } else {
        setMessage({ text: res.error || "Failed to delete account", type: "error" });
      }
    });
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Security & Session Operations
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isPending || sessionsCount === 0}
            onClick={handleRevokeSessions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-foreground text-xs font-semibold hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            <KeyRound className="size-3.5 text-primary" />
            <span>Revoke Active Sessions ({sessionsCount})</span>
          </button>

          {!isAdmin && !isDeleted && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="size-3.5" />
              <span>Initiate Tombstone Deletion</span>
            </button>
          )}
        </div>
      </div>

      {/* Two-Step Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Account Deletion</h3>
                <p className="text-xs text-muted-foreground">This operation applies a compliance soft-tombstone.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Target account: <strong className="text-foreground">{userEmail}</strong> ({userName || "Student"}).
              Active sessions will be immediately invalidated and linked external connectors unlinked.
            </p>

            <form onSubmit={handleDeleteWorkflow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Documented Deletion Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. GDPR Right-to-be-forgotten request #2841"
                  className="w-full bg-muted/50 border border-border text-xs rounded-xl p-3 outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !deleteReason.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
                >
                  {isPending ? "Processing..." : "Confirm & Tombstone Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

