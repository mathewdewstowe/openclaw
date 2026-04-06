import { db } from "./db";

interface ParsedNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: Date | null;
  summary: string;
}

function parseRSSItems(xml: string): ParsedNewsItem[] {
  const items: ParsedNewsItem[] = [];
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of matches) {
    const itemXml = match[1];

    const titleMatch =
      itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const descMatch =
      itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      itemXml.match(/<description>([\s\S]*?)<\/description>/);

    const title = titleMatch?.[1]?.trim() || "";
    const url = linkMatch?.[1]?.trim() || "";

    if (!title || !url) continue;

    const pubDate = pubDateMatch?.[1]?.trim();
    const source = sourceMatch?.[1]?.trim() || "";
    const rawDesc = descMatch?.[1]?.trim() || "";
    const summary = rawDesc.replace(/<[^>]+>/g, "").trim().slice(0, 300);

    items.push({
      title,
      url,
      source,
      publishedAt: pubDate ? new Date(pubDate) : null,
      summary,
    });
  }

  return items;
}

export async function fetchAndStoreNewsForUser(userId: string, force = false): Promise<number> {
  // Get all unique competed companies this user has scanned
  const scans = await db.scan.findMany({
    where: { userId, type: "COMPETITOR_TEARDOWN", status: "COMPLETED" },
    select: { companyName: true, companyUrl: true },
    distinct: ["companyUrl"],
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!scans.length) return 0;

  const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
  let stored = 0;

  for (const scan of scans) {
    const companyName = scan.companyName || new URL(scan.companyUrl).hostname;

    // Skip if already fetched in last 23h for this company
    const lastItem = await db.competitorNewsItem.findFirst({
      where: { userId, companyUrl: scan.companyUrl },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });

    if (!force && lastItem && lastItem.fetchedAt > twentyThreeHoursAgo) continue;

    try {
      const query = encodeURIComponent(`"${companyName}"`);
      const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-GB&gl=GB&ceid=GB:en`;

      const response = await fetch(rssUrl, {
        signal: AbortSignal.timeout(12000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NthLayer/1.0)" },
      });

      if (!response.ok) continue;

      const xml = await response.text();
      const items = parseRSSItems(xml).slice(0, 15);

      for (const item of items) {
        try {
          await db.competitorNewsItem.upsert({
            where: { userId_url: { userId, url: item.url } },
            create: {
              userId,
              companyName,
              companyUrl: scan.companyUrl,
              title: item.title,
              url: item.url,
              source: item.source || null,
              summary: item.summary || null,
              publishedAt: item.publishedAt,
            },
            update: {
              title: item.title,
              source: item.source || null,
              summary: item.summary || null,
            },
          });
          stored++;
        } catch {
          // Skip duplicates / constraint errors
        }
      }
    } catch {
      // Skip on network error — try next company
    }
  }

  return stored;
}
