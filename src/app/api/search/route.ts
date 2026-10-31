import { and, eq, ilike, or, sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { codeRepositories, skills, unifiedProjects, users } from "@/db/schema";
import { discoverableBy } from "@/lib/discovery";
import { viewerFor } from "@/lib/people";
import { hitRateLimit } from "@/lib/rate-limit";

const CURATED_OPPORTUNITIES = [
  { title: "Advanced LLMs: From Foundations to Agents", category: "Learning", url: "/learning" },
  { title: "MLOps for Real-World AI", category: "Learning", url: "/learning" },
  { title: "AI in Healthcare & Clinical Diagnostics", category: "Learning", url: "/learning" },
  { title: "IIT Delhi · LLM-based Intelligent Systems", category: "Research", url: "/research" },
  { title: "IIT Bombay · Agentic AI Research Fellowship", category: "Research", url: "/research" },
];

export async function GET(req: Request) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);

  if (q.length < 2) {
    return NextResponse.json({
      results: { people: [], skills: [], projects: [], opportunities: [] },
    });
  }

  // Each search scans several tables with leading-wildcard patterns.
  const limited = await hitRateLimit(`search:${session.user.id}`, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many searches. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  // Escape LIKE wildcards so "%" or "_" in the query match literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  try {
    const viewer = await viewerFor(session.user.id);
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [peopleRows, skillRows, projectRows, repoRows] = await Promise.all([
      // 1. People: only those this user may discover (mentor_discovery consent).
      db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          university: users.university,
          department: users.department,
        })
        .from(users)
        .where(
          and(
            discoverableBy(viewer),
            or(
              ilike(users.name, pattern),
              ilike(users.university, pattern),
              ilike(users.department, pattern),
              // role is an enum; ILIKE needs text.
              ilike(sql`${users.role}::text`, pattern),
            ),
          ),
        )
        .limit(4),

      // 2. Skills search
      db
        .select({
          id: skills.id,
          name: skills.canonicalName,
          category: skills.category,
        })
        .from(skills)
        .where(ilike(skills.canonicalName, pattern))
        .limit(5),

      // 3–4. Projects and repositories: the signed-in user's own only.
      db
        .select({
          id: unifiedProjects.id,
          title: unifiedProjects.canonicalTitle,
          technologies: unifiedProjects.technologies,
        })
        .from(unifiedProjects)
        .where(and(eq(unifiedProjects.userId, viewer.id), ilike(unifiedProjects.canonicalTitle, pattern)))
        .limit(4),

      db
        .select({
          id: codeRepositories.id,
          title: codeRepositories.repoName,
          url: codeRepositories.url,
        })
        .from(codeRepositories)
        .where(and(eq(codeRepositories.userId, viewer.id), ilike(codeRepositories.repoName, pattern)))
        .limit(4),
    ]);

    // Format people
    const people = peopleRows.map((p) => ({
      id: p.id,
      title: p.name || "Peer Scholar",
      subtitle: [p.role, p.university || p.department].filter(Boolean).join(" · ") || "Scholar",
      url: "/people",
    }));

    // Format skills
    const skillList = skillRows.map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: s.category || "Skill",
      url: `/skills?q=${encodeURIComponent(s.name)}`,
    }));

    // Format projects
    const allProjectsMap = new Map<string, { id: string; title: string; subtitle: string; url: string }>();
    projectRows.forEach((p) => {
      allProjectsMap.set(p.title.toLowerCase(), {
        id: p.id,
        title: p.title,
        subtitle: (p.technologies || []).slice(0, 3).join(", ") || "Project",
        url: "/projects",
      });
    });
    repoRows.forEach((r) => {
      if (!allProjectsMap.has(r.title.toLowerCase())) {
        allProjectsMap.set(r.title.toLowerCase(), {
          id: String(r.id),
          title: r.title,
          subtitle: "GitHub Repository",
          url: "/projects",
        });
      }
    });
    const projects = Array.from(allProjectsMap.values()).slice(0, 4);

    // Format matching opportunities
    const opportunities = CURATED_OPPORTUNITIES.filter(
      (o) => o.title.toLowerCase().includes(q.toLowerCase()) || o.category.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 3);

    return NextResponse.json({
      results: {
        people,
        skills: skillList,
        projects,
        opportunities,
      },
    });
  } catch (err) {
    // Not an empty result: "no matches" would be untrue when the search never ran.
    console.error("Global search error:", err);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 503 });
  }
}
