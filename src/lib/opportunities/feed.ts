/**
 * Parses an official source's RSS 2.0 / Atom or JSON Feed 1.1 document into raw entries.
 * Only fields the source actually published are returned; nothing is inferred. A feed entry is a
 * candidate listing, not proof of an open vacancy: ingest.ts decides its status.
 */
export interface FeedEntry {
  externalId: string | null;
  title: string;
  url: string | null;
  description: string | null;
  publishedAt: Date | null;
}

const MAX_ENTRIES = 200;
const MAX_TEXT = 4000;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? decode(m[1]!) : null;
};

const date = (s: string | null | undefined) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clip = (s: string | null) => (s ? s.slice(0, MAX_TEXT) : null);

export function parseFeed(body: string, contentType = ""): FeedEntry[] {
  const trimmed = body.trim();
  if (contentType.includes("json") || trimmed.startsWith("{")) {
    let doc: unknown;
    try {
      doc = JSON.parse(trimmed);
    } catch {
      throw new Error("FEED_INVALID_JSON");
    }
    const items = (doc as { items?: unknown[] })?.items;
    if (!Array.isArray(items)) throw new Error("FEED_NOT_JSON_FEED");
    return items.slice(0, MAX_ENTRIES).flatMap((raw) => {
      const it = raw as Record<string, unknown>;
      const title = typeof it.title === "string" ? decode(it.title) : "";
      if (!title) return [];
      const text = typeof it.content_text === "string" ? it.content_text : typeof it.summary === "string" ? it.summary : typeof it.content_html === "string" ? decode(it.content_html) : null;
      return [{
        externalId: typeof it.id === "string" ? it.id : null,
        title,
        url: typeof it.url === "string" ? it.url : null,
        description: clip(text ? decode(text) : null),
        publishedAt: date((it.date_modified as string) || (it.date_published as string)),
      }];
    });
  }

  const isAtom = /<feed[\s>]/i.test(trimmed);
  const blocks = trimmed.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi);
  if (!blocks) {
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(trimmed)) throw new Error("FEED_UNRECOGNISED");
    return [];
  }
  return blocks.slice(0, MAX_ENTRIES).flatMap((b) => {
    const title = tag(b, "title") ?? "";
    if (!title) return [];
    const atomLink = /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? null;
    return [{
      externalId: tag(b, "guid") ?? tag(b, "id"),
      title,
      url: isAtom ? atomLink : tag(b, "link"),
      description: clip(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content")),
      publishedAt: date(tag(b, "pubDate") ?? tag(b, "updated") ?? tag(b, "published") ?? tag(b, "dc:date")),
    }];
  });
}
