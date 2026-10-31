import { eq, ilike, or, sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { similarPeople } from "@/lib/people";
import { hitRateLimit } from "@/lib/rate-limit";
import {
  learningResources,
  opportunities,
  profileViews,
  roadmaps,
  skillEvidence,
  users,
} from "@/db/schema";

export type YoraIntent =
  | "opportunities"
  | "people"
  | "roadmap"
  | "skills"
  | "profile"
  | "hello"
  | "fallback";

export function parseIntent(message: string): YoraIntent {
  const text = (message || "").toLowerCase().trim();

  // 1. Opportunities: job, internship, opportunity, work, research, grant, opening
  if (
    /\b(job|jobs|internship|internships|opportunity|opportunities|work|hiring|opening|openings|grant|grants)\b/i.test(
      text
    )
  ) {
    return "opportunities";
  }

  // 2. People & Connections: match, network, connect, peer, mentor, collab
  if (
    /\b(match|matches|network|connect|connection|connections|peer|peers|mentor|mentors|collab|collaborate|collaborator|collaborators|who should i know)\b/i.test(
      text
    )
  ) {
    return "people";
  }

  // 3. Roadmap: roadmap, plan, career, next, milestone, stage
  if (
    /\b(roadmap|roadmaps|career plan|plan|planning|milestone|milestones|stage|next step|next steps)\b/i.test(
      text
    )
  ) {
    return "roadmap";
  }

  // 4. Skills: gap, skill, learn, course, study, training
  if (
    /\b(gap|gaps|skill|skills|learn|learning|course|courses|study|training|curriculum)\b/i.test(
      text
    )
  ) {
    return "skills";
  }

  // 5. Profile: profile, resume, stats, summary, cv, completeness
  if (
    /\b(profile|resume|stats|summary|cv|completeness|score|verified)\b/i.test(
      text
    )
  ) {
    return "profile";
  }

  // 6. Greetings: hi, hello, hey, greetings, howdy
  if (
    /\b(hi|hello|hey|greetings|howdy|good morning|good afternoon|good evening|yo)\b/i.test(
      text
    )
  ) {
    return "hello";
  }

  // 7. Research fallback to opportunities if not matched under people
  if (/\b(research)\b/i.test(text)) {
    return "opportunities";
  }

  return "fallback";
}

const MAX_MESSAGE_CHARS = 2000;

export async function POST(req: Request) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const limited = await hitRateLimit(`yora:${userId}`, { limit: 30, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many messages. Wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  try {
    const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";

    if (!userMessage || userMessage.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch user basic identity for personalized responses
    const [userRow] = await db
      .select({ name: users.name, role: users.role, university: users.university, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow || userRow.deletedAt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userName = userRow.name?.trim() || session.user.name?.trim() || "Scholar";
    const firstName = userName.split(/\s+/)[0] || "Scholar";

    const intent = parseIntent(userMessage);
    let reply = "";

    switch (intent) {
      case "opportunities": {
        // Fetch from opportunities table
        // Not ranked against the user's profile, so don't say it is.
        const opps = await db
          .select({ title: opportunities.title, organization: opportunities.organization })
          .from(opportunities)
          .limit(3);
        if (opps.length > 0) {
          const listStr = opps
            .map((o) => `"${o.title}" at ${o.organization}`)
            .join(", ");
          reply = `Here are some opportunities: ${listStr}. Check the Opportunities section on your dashboard to apply!`;
        } else {
          reply = "I don't have any opportunities to show right now. Check the Opportunities section later for new postings.";
        }
        break;
      }

      case "people": {
        // Same rules as /people: only people this user may discover
        // (mentor_discovery consent), ranked by embedding similarity.
        const viewer = userRow ? { id: userId, role: userRow.role } : null;
        const [top] = viewer ? await similarPeople(viewer, 1) : [];

        if (top && top.similarity !== null) {
          const peerName = top.name || "an AI Tathastu member";
          const peerWork = top.summary
            ? ` who works on ${top.summary.slice(0, 80).replace(/\.$/, "")}`
            : top.department
              ? ` in ${top.department}`
              : "";
          reply = `You have a ${Math.round(top.similarity * 100)}% match with ${peerName}${peerWork}. See People & Network to learn more.`;
        } else {
          reply =
            "I don't have a match for you yet. Matches appear once your profile has been processed and people who have chosen to be discoverable fit your goals.";
        }
        break;
      }

      case "roadmap": {
        // Fetch from roadmaps table
        const [roadmapRow] = await db
          .select({ currentStage: roadmaps.currentStage, shortTerm: roadmaps.shortTerm })
          .from(roadmaps)
          .where(eq(roadmaps.userId, userId))
          .limit(1);

        const shortTerm = roadmapRow?.shortTerm as { milestones?: string[]; focus?: string } | null | undefined;
        const milestone = shortTerm?.milestones?.[0] || shortTerm?.focus;
        if (roadmapRow?.currentStage && milestone) {
          reply = `Your current stage is ${roadmapRow.currentStage}. Your next short-term milestone is: ${milestone}.`;
        } else {
          reply = "Your roadmap isn't ready yet. It appears once your profile has been processed; confirming your details and connecting your sources gives it more to work with.";
        }
        break;
      }

      case "skills": {
        // Fetch from profile_views and learning_resources
        const [pvRow] = await db
          .select()
          .from(profileViews)
          .where(eq(profileViews.userId, userId))
          .limit(1);

        interface ProfileViewSubset {
          completeness?: { overall?: number };
          skills?: Array<{ name?: string }>;
          skillGapsAndPaths?: {
            gaps?: Array<{ skill?: string }>;
          };
        }

        const profileView = (pvRow?.view || {}) as ProfileViewSubset;
        const gaps = profileView.skillGapsAndPaths?.gaps || [];
        const focusSkill = gaps[0]?.skill || profileView.skills?.[0]?.name;
        if (!focusSkill) {
          reply = "I can't point to a skill gap yet. Gaps appear once your profile has been processed.";
          break;
        }

        // Escape LIKE wildcards: the skill name is data, not a pattern.
        const pattern = `%${focusSkill.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const [course] = await db
          .select({ title: learningResources.title, provider: learningResources.provider })
          .from(learningResources)
          .where(or(ilike(learningResources.title, pattern), ilike(learningResources.description, pattern)))
          .limit(1);

        reply = course
          ? `You should focus on ${focusSkill}. I recommend this course: "${course.title}" by ${course.provider}. Check your Learning Paths section to start learning!`
          : `You should focus on ${focusSkill}. I don't have a course that matches it yet; check your Learning Paths section for what's available.`;
        break;
      }

      case "profile": {
        // Fetch profile_views stats
        const [pvRow] = await db
          .select()
          .from(profileViews)
          .where(eq(profileViews.userId, userId))
          .limit(1);

        interface ProfileStatsSubset {
          completeness?: { overall?: number };
          skills?: Array<{ name?: string }>;
        }

        const profileView = (pvRow?.view || {}) as ProfileStatsSubset;
        const completeness = profileView.completeness?.overall ?? null;
        const skillsList = profileView.skills || [];
        let skillsCount = Array.isArray(skillsList) ? skillsList.length : 0;

        if (skillsCount === 0) {
          // One row per (skill, fact): count skills, not pieces of evidence.
          const [skillCountRow] = await db
            .select({ count: sql<number>`count(distinct ${skillEvidence.skillId})::int` })
            .from(skillEvidence)
            .where(eq(skillEvidence.userId, userId));
          skillsCount = skillCountRow?.count || 0;
        }

        // These come from the user's own facts and connected sources; nothing here verifies them.
        const skillsLine = `You have ${skillsCount} ${skillsCount === 1 ? "skill" : "skills"} on your profile.`;
        reply =
          completeness === null
            ? `${skillsLine} Your completeness score appears once your profile has been processed.`
            : `Your profile is ${completeness}% complete. ${skillsLine}`;
        break;
      }

      case "hello": {
        reply = `Hello ${firstName}! I'm Yora, your AI career companion. I can help you find jobs, review your roadmap, or find peers. What would you like to do?`;
        break;
      }

      case "fallback":
      default: {
        reply =
          "I'm still learning! Please try asking about 'opportunities', 'my roadmap', 'skill gaps', or 'people to connect with'.";
        break;
      }
    }

    return NextResponse.json({ response: reply });
  } catch (error) {
    // A real failure, not "I'm still learning": the chat shows its own retry message.
    console.error("Error in /api/yora/chat:", error);
    return NextResponse.json({ error: "Yora is unavailable right now." }, { status: 503 });
  }
}
