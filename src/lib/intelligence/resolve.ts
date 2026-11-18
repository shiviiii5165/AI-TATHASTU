import "server-only";

import { AUTO_ID, getProfile, getVersion, listProfiles } from "./rankings";
import type { RankingDefinition } from "./types";

export interface ResolvedRanking {
  id: string;
  name: string;
  /** "auto" (derived default), "published" (latest published version) or "draft" (unpublished working copy, preview only). */
  mode: "auto" | "published" | "draft";
  version: number;
  definition: RankingDefinition | null;
  storageAvailable: boolean;
  options: { id: string; name: string; status: string; version: number }[];
}

/** Which definition a page should run: a published version wins over the draft; drafts are previews. */
export async function resolveRanking(id: string | undefined, preferDraft = false): Promise<ResolvedRanking> {
  const state = await listProfiles();
  const options = state.profiles.map((p) => ({ id: p.id, name: p.name, status: p.status, version: p.publishedVersion }));
  const base = { storageAvailable: state.available, options };
  if (!id || id === AUTO_ID) return { id: AUTO_ID, name: "Auto · all available evidence", mode: "auto", version: 0, definition: null, ...base };
  const profile = await getProfile(id);
  if (!profile) return { id: AUTO_ID, name: "Auto · all available evidence", mode: "auto", version: 0, definition: null, ...base };
  if (profile.publishedVersion > 0 && !preferDraft) {
    const v = await getVersion(profile.id, profile.publishedVersion);
    if (v) return { id: profile.id, name: profile.name, mode: "published", version: v.version, definition: v.definition, ...base };
  }
  return { id: profile.id, name: profile.name, mode: "draft", version: profile.publishedVersion, definition: profile.definition, ...base };
}
