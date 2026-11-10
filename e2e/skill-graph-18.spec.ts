/**
 * The Skill Graph at its real maximum of 18 skills, on real pages, with worst-case names and a
 * dense set of links. Measures geometry rather than trusting a screenshot.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

import { createUser, seedComputedProfile, signIn, sql } from "./support/fixtures";

const NAMES = [
  "Python", "Retrieval-Augmented Generation", "Hugging Face Transformers", "Natural Language Processing", "Machine Learning", "Deep Learning",
  "PyTorch", "TensorFlow", "scikit-learn", "Data Structures and Algorithms", "Convolutional Neural Networks", "Docker",
  "Kubernetes", "SQL", "AWS", "Large Language Models", "Prompt Engineering", "Vector Databases",
];
const status = (i: number) => (i % 7 === 6 ? "inferred" : i % 3 === 2 ? "claimed" : "verified");

function graph() {
  const nodes = NAMES.map((name, i) => {
    const s = status(i);
    const scored = s === "verified";
    return {
      id: name, name, category: "other", status: s, level: scored ? "Working" : "Not assessed", proficiency: scored ? 25 + (i * 7) % 70 : null,
      confidence: scored ? 0.6 : 0.2, evidenceCount: scored ? 1 : 0, inferredFrom: s === "inferred" ? ["Python"] : [],
      evidence: scored ? [{ kind: "repository", source: "github", label: `demo/${i}`, ref: `https://github.com/demo/${i}`, at: null }] : [],
    };
  });
  // A worst case: one repository evidencing nearly everything gives a clique.
  const edges = [];
  for (let i = 0; i < NAMES.length; i++) for (let j = i + 1; j < NAMES.length; j++) {
    edges.push({ source: NAMES[i], target: NAMES[j], relationship: "used_together", basis: (i + j) % 2 ? "evidence" : "ontology", evidence: ["demo/all"], weight: 1 });
  }
  return { nodes, edges, totalSkills: 25 };
}

async function setUp(browser: Browser, name: string, width: number, height = 900) {
  const user = await createUser(name, "done");
  await seedComputedProfile(user.id);
  await sql.query("UPDATE profile_views SET view = jsonb_set(view, '{intelligence,graph}', $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify(graph())]);
  const context = await browser.newContext({ viewport: { width, height } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  // The full skill graph lives on /skills; the dashboard shows the compact clustered view (dashboard-intelligence.spec.ts).
  await page.goto("/skills");
  await expect(page.getByTestId("skill-graph-canvas").locator("[data-node]")).toHaveCount(18);
  return { context, page };
}

function measure(page: Page) {
  return page.getByTestId("skill-graph").evaluate((card) => {
    const box = card.getBoundingClientRect();
    const svg = card.querySelector("[data-testid=skill-graph-canvas]") as SVGSVGElement;
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const nodes = [...svg.querySelectorAll("[data-node]")].map((n) => ({
      id: n.getAttribute("data-node")!,
      hit: n.querySelector("[data-hit]")!.getBoundingClientRect(),
      text: n.querySelector("text")!.getBoundingClientRect(),
      circle: n.querySelector("circle")!.getBoundingClientRect(),
    }));
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const pairs: string[] = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if (overlap(nodes[i].text, nodes[j].text) || overlap(nodes[i].circle, nodes[j].circle) || overlap(nodes[i].hit, nodes[j].hit)) pairs.push(`${nodes[i].id}/${nodes[j].id}`);
    }
    const outside = nodes.filter(({ hit, text }) => [hit, text].some((r) => r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom)).map((n) => n.id);
    return {
      scale,
      pairs,
      outside,
      smallTargets: nodes.filter((n) => n.hit.width < 24 || n.hit.height < 24).map((n) => n.id),
      fontPx: Number(getComputedStyle(svg.querySelector("text")!).fontSize.replace("px", "")) * scale,
      lines: svg.querySelectorAll("line").length,
      clippedByCard: card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1,
      innerScroll: [...card.querySelectorAll("*")].some((el) => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      labelLines: [...svg.querySelectorAll("tspan")].map((t) => t.textContent ?? ""),
    };
  });
}

for (const [label, width] of [["360 mobile", 360], ["390 mobile", 390], ["tablet", 768], ["1366 desktop", 1366], ["1920 desktop", 1920]] as const) {
  test(`18 skills at ${label}: all visible, readable, separate, no inner scrolling`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Graph ${width}`, width);
    const m = await measure(page);
    expect(m.outside, "outside the card").toEqual([]);
    expect(m.pairs, "overlapping").toEqual([]);
    expect(m.smallTargets, "targets under 24px").toEqual([]);
    expect(m.scale).toBeCloseTo(1, 1);
    expect(m.fontPx, "drawn label size").toBeGreaterThanOrEqual(11.5);
    expect(m.clippedByCard).toBe(false);
    expect(m.innerScroll).toBe(false);
    expect(m.pageOverflow).toBeLessThanOrEqual(0);
    expect(m.lines, "a clique must not be drawn whole").toBeLessThanOrEqual(30);
    // Whole lines: a name must wrap between words, never inside one.
    expect(m.labelLines).toEqual(expect.arrayContaining(["Retrieval-Augmented", "Generation", "Convolutional Neural", "Networks"]));
    expect(m.labelLines.filter((line) => line.endsWith("…"))).toEqual([]);
    await page.getByTestId("skill-graph").screenshot({ path: test.info().outputPath(`graph-${width}.png`) });
    await context.close();
  });
}

test("every node works from the keyboard, focus returns to it, and the dialog traps Tab", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph keys", 1366);
  const nodes = page.getByTestId("skill-graph-canvas").getByRole("button");
  await expect(nodes).toHaveCount(18);
  for (const i of [0, 9, 17]) {
    const node = nodes.nth(i);
    await node.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: NAMES[i] })).toBeVisible();
    for (let tab = 0; tab < 25; tab++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(node).toBeFocused();
  }
  await context.close();
});

test("the list view has the same skills, statuses and link counts as the graph", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph list", 390);
  const card = page.getByTestId("skill-graph");
  const fromGraph = await card.getByTestId("skill-graph-canvas").getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  await card.getByRole("button", { name: "list" }).click();
  const rows = card.getByRole("list", { name: "Skills" }).getByRole("listitem");
  await expect(rows).toHaveCount(18);
  const fromList = await rows.allInnerTexts();
  for (let i = 0; i < 18; i++) {
    expect(fromList[i]).toContain(NAMES[i]);
    const statusWord = fromGraph[i].split(": ")[1].split(",")[0];
    expect(fromList[i]).toContain(statusWord);
    expect(fromList[i]).toContain("17 links");
    expect(fromGraph[i]).toContain("17 links");
  }
  await rows.nth(1).getByRole("button").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: NAMES[1] })).toBeVisible();
  await context.close();
});

test("a node is clickable by touch position, with no neighbour stealing the tap", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph tap", 360);
  const canvas = page.getByTestId("skill-graph-canvas");
  for (const name of [NAMES[1], NAMES[10], NAMES[17]]) {
    await canvas.locator(`[data-node="${name}"] circle`).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await context.close();
});
