import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { similarPeople, viewerFor } from "@/lib/people";

const ROLE_LABEL = { student: "Student", faculty: "Faculty / Mentor", alumni: "Alumni" } as const;

export async function GET() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const viewer = await viewerFor(session.user.id);
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only discoverable people (mentor_discovery consent), ranked by embedding similarity.
    const people = await similarPeople(viewer, 5);
    const matches = people
      .filter((p) => p.similarity !== null)
      .map((p) => ({
        id: p.id,
        name: p.name || "AI Tathastu member",
        role: ROLE_LABEL[p.role],
        institution: p.institution,
        department: p.department,
        matchPercentage: Math.round((p.similarity ?? 0) * 100),
        reason: "Similar skills, projects and goals",
        initials: (p.name || "AT")
          .split(/\s+/)
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color: "bg-blue-100 text-blue-700",
      }));
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Error in GET /api/collaboration/matches:", error);
    return NextResponse.json({ error: "Couldn't load matches." }, { status: 500 });
  }
}
