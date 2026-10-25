"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";

export interface PeerCardItem {
  id: string;
  name: string;
  role: string;
  institution: string;
  department: string;
  matchPercentage: number;
  summary: string;
  initials: string;
}

export function PeopleListClient({ initialPeers }: { initialPeers: PeerCardItem[] }) {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  function toggleConnect(id: string) {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        const isConnected = connectedIds.has(peer.id);

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

                <span className="shrink-0 rounded-full bg-[#19C58A]/10 border border-[#19C58A]/30 px-2.5 py-0.5 text-xs font-bold text-[#107C55]">
                  {peer.matchPercentage}% Match
                </span>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                <p className="font-medium text-slate-900">{peer.institution}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{peer.department}</p>
              </div>

              <p className="mt-3 text-xs text-[#617493] line-clamp-2">
                {peer.summary}
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#F0F2F7]">
              <button
                type="button"
                onClick={() => toggleConnect(peer.id)}
                className={`w-full min-h-[40px] py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${
                  isConnected
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-[#2878F0] text-white hover:bg-[#2063CC] shadow-xs active:scale-95"
                }`}
              >
                {isConnected ? (
                  <>
                    <Check className="size-3.5" />
                    <span>Connection Requested</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
