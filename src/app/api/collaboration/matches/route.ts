import { eq } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { collaborationEmbeddings, users } from "@/db/schema";
import { relevanceReason, summarySkills } from "@/lib/people-preview";
import { similarPeople, viewerFor } from "@/lib/people";
import { hitRateLimit } from "@/lib/rate-limit";

const ROLE_LABEL = { student: "Student", faculty: "Faculty / Mentor", alumni: "Alumni" } as const;

/** The dashboard's "People you may know" preview shows at most this many; full discovery is Collaborate's. */
const PREVIEW_LIMIT = 3;

export async function GET() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vector search per call.
  const limited = await hitRateLimit(`matches:${session.user.id}`, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  try {
    const viewer = await viewerFor(session.user.id);
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only discoverable people: mentors, students with mentor_discovery consent (for mentors), and members who turned on
    // "Show me in Collaborate discovery". Ranked by embedding similarity; people the matcher can't rank yet (no
    // embedding on either side) are still listed after them, so an incomplete profile never empties the card.
    const [people, [me]] = await Promise.all([
      similarPeople(viewer, PREVIEW_LIMIT, { peers: true, includeUnmatched: true }),
      db
        .select({ summary: collaborationEmbeddings.profileSummary, institution: users.university })
        .from(users)
        .leftJoin(collaborationEmbeddings, eq(collaborationEmbeddings.userId, users.id))
        .where(eq(users.id, viewer.id)),
    ]);
    const mine = { skills: summarySkills(me?.summary), institution: me?.institution ?? null };
    const matches = people
      .slice(0, PREVIEW_LIMIT)
      .map((p) => ({
        id: p.id,
        name: p.name || "AI Tathastu member",
        role: ROLE_LABEL[p.role],
        institution: p.institution,
        department: p.department,
        // One real reason, from what discoverable people agreed to share (skills, university). No percentages.
        reason: relevanceReason(mine, { skills: summarySkills(p.summary), institution: p.institution }, { ranked: p.similarity !== null }),
        initials: (p.name || "AT")
          .split(/\s+/)
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }));
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Error in GET /api/collaboration/matches:", error);
    return NextResponse.json({ error: "Couldn't load matches." }, { status: 500 });
  }
}
