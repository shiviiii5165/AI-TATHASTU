"use client";

import { UserPlus } from "lucide-react";

export interface PeerCardItem {
  id: string;
  name: string;
  role: string;
  institution: string | null;
  department: string | null;
  /** Embedding similarity; null until both profiles have been computed. */
  matchPercentage: number | null;
  summary: string | null;
  initials: string;
}

export function PeopleListClient({ initialPeers }: { initialPeers: PeerCardItem[] }) {
  if (initialPeers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-12 text-center max-w-lg mx-auto">
        <div className="size-12 rounded-full bg-blue-50 text-[#2878F0] flex items-center justify-center mx-auto mb-3">
          <UserPlus className="size-6" />
        </div>
        <h2 className="font-sans text-base font-bold text-slate-900">No Collaborators Matched Yet</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Confirm your skills, connect GitHub, or upload a resume to calculate vector embeddings and discover matching peers.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {initialPeers.map((peer) => {
        return (
          <div
            key={peer.id}
            className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-tr from-[#EDF5FF] to-[#F4F1FD] border border-[#2878F0]/20 text-[#2878F0] font-bold text-xs shrink-0 shadow-2xs">
                    {peer.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-sans text-sm font-bold text-[#11182B] leading-tight truncate" title={peer.name}>
                      {peer.name}
                    </h2>
                    <p className="text-[11px] font-medium text-[#617493] mt-0.5 truncate">
                      {peer.role}
                    </p>
                  </div>
                </div>

                {peer.matchPercentage !== null && (
                  <span className="shrink-0 rounded-full bg-[#19C58A]/10 border border-[#19C58A]/30 px-2.5 py-0.5 text-xs font-bold text-[#107C55]">
                    {peer.matchPercentage}% Match
                  </span>
                )}
              </div>

              {(peer.institution || peer.department) && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                  {peer.institution && <p className="font-medium text-slate-900">{peer.institution}</p>}
                  {peer.department && <p className="text-[11px] text-slate-500 mt-0.5">{peer.department}</p>}
                </div>
              )}

              {peer.summary && <p className="mt-3 text-xs text-[#617493] line-clamp-2">{peer.summary}</p>}
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#F0F2F7]">
              {/* No connection backend exists yet: nothing would be sent, so the
                  button doesn't pretend to send a request. */}
              <button
                type="button"
                disabled
                className="w-full min-h-[40px] py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
              >
                <UserPlus aria-hidden className="size-3.5" />
                <span>Connect · coming soon</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
