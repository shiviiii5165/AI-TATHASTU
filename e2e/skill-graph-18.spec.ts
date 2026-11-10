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
  // /skills draws every engine node with the dashboard's Skills Intelligence network.
  await page.goto("/skills");
  await expect(page.getByTestId("skill-network").locator("[data-node]")).toHaveCount(18);
  return { context, page };
}

function measure(page: Page) {
  return page.getByTestId("skill-graph").evaluate((card) => {
    const box = card.getBoundingClientRect();
    const svg = card.querySelector("[data-testid=skill-network] svg") as SVGSVGElement;
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const nodes = [...svg.querySelectorAll("[data-node]")].map((n) => {
      const c = n.querySelector("circle[data-main]")!;
      return { id: n.getAttribute("data-node")!, title: n.querySelector("title")?.textContent ?? "", circle: c.getBoundingClientRect(), fill: c.getAttribute("fill") ?? "" };
    });
    const pairs: string[] = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].circle, b = nodes[j].circle;
      if (Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < a.width / 2 + b.width / 2) pairs.push(`${nodes[i].id}/${nodes[j].id}`);
    }
    return {
      scale,
      pairs,
      outside: nodes.filter(({ circle: r }) => r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom).map((n) => n.id),
      smallTargets: nodes.filter((n) => n.circle.width < 24).map((n) => n.id),
      // Suggestions are white with a coloured dashed ring; every other node uses the palette gradient.
      flat: nodes.filter((n) => n.fill.startsWith("var(")).map((n) => n.id),
      gradients: nodes.filter((n) => n.fill.startsWith("url(")).length,
      titles: nodes.map((n) => n.title),
      fontPx: Number(getComputedStyle(svg.querySelector("text")!).fontSize.replace("px", "")) * scale,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const [label, width] of [["390 mobile", 390], ["tablet", 768], ["1024 laptop", 1024], ["1280 desktop", 1280], ["1440 desktop", 1440]] as const) {
  test(`18 skills at ${label}: colourful, readable, separate, inside the card`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Graph ${width}`, width);
    const m = await measure(page);
    expect(m.outside, "outside the card").toEqual([]);
    expect(m.pairs, "overlapping").toEqual([]);
    expect(m.smallTargets, "targets under 24px").toEqual([]);
    expect(m.flat, "nodes drawn in theme colours instead of the palette").toEqual([]);
    expect(m.gradients).toBe(NAMES.filter((_, i) => status(i) !== "inferred").length);
    expect(m.scale).toBeCloseTo(1, 1);
    expect(m.fontPx, "drawn label size").toBeGreaterThanOrEqual(10.5);
    expect(m.pageOverflow).toBeLessThanOrEqual(0);
    expect(m.titles).toEqual(expect.arrayContaining(NAMES));
    await page.getByTestId("skill-graph").screenshot({ path: test.info().outputPath(`graph-${width}.png`) });
    await context.close();
  });
}

test("every node opens its evidence from the keyboard and focus returns to it", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph keys", 1280);
  const nodes = page.getByTestId("skill-network").locator("[data-node]");
  for (const i of [0, 9, 17]) {
    const node = nodes.nth(i);
    const id = (await node.getAttribute("data-node"))!;
    await node.focus();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("region", { name: `${id} evidence` });
    await expect(detail.getByRole("heading", { name: id })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(node).toBeFocused();
  }
  await context.close();
});

test("the list view has the same skills and statuses as the graph", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph list", 390);
  const card = page.getByTestId("skill-graph");
  const fromGraph = await card.getByTestId("skill-network").locator("[data-node]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  await card.getByRole("button", { name: "List" }).click();
  const rows = card.getByRole("list", { name: "Skills" }).getByRole("listitem");
  await expect(rows.filter({ has: page.getByRole("button") })).toHaveCount(18);
  const fromList = await rows.allInnerTexts();
  for (let i = 0; i < 18; i++) {
    const [name, rest] = fromGraph[i].split(": ");
    expect(fromList[i]).toContain(name);
    expect(fromList[i]).toContain(rest.split(",")[0]);
  }
  await rows.nth(1).getByRole("button").click();
  await expect(card.getByRole("region", { name: /evidence$/ })).toBeVisible();
  await context.close();
});

test("a node is clickable by touch position, with no neighbour stealing the tap", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Graph tap", 390);
  const network = page.getByTestId("skill-network");
  for (const name of [NAMES[1], NAMES[10], NAMES[17]]) {
    await network.locator(`[data-node="${name}"] circle[data-main]`).click();
    await expect(page.getByRole("region", { name: `${name} evidence` })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await context.close();
});
