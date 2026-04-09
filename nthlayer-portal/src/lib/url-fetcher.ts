/**
 * Fetches a company's website and its main nav pages, extracting clean text
 * content to feed into LLM prompts. This avoids relying on search indices
 * (Brave) which miss small/new sites.
 */

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; NthLayerBot/1.0; +https://nthlayer.co.uk)",
  "Accept": "text/html,application/xhtml+xml",
};

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
  return {
    title: titleMatch?.[1]?.trim() || "",
    description: metaDescMatch?.[1]?.trim() || "",
    ogDescription: ogDescMatch?.[1]?.trim() || "",
  };
}

/**
 * Extract main nav links from the header area of HTML.
 * Heuristic: links inside <nav>, <header>, or with role="navigation".
 * Falls back to all <a> tags in the first 3000 chars if no <nav> found.
 */
function extractNavLinks(html: string, baseUrl: URL): string[] {
  const links = new Set<string>();

  // Try <nav> blocks first
  const navBlocks = html.match(/<nav\b[\s\S]*?<\/nav>/gi) || [];
  const headerBlocks = html.match(/<header\b[\s\S]*?<\/header>/gi) || [];
  const roleNavBlocks = html.match(/<[^>]*role=["']navigation["'][\s\S]*?<\/[a-z]+>/gi) || [];

  const scanBlocks = [...navBlocks, ...headerBlocks, ...roleNavBlocks];
  const searchText = scanBlocks.length > 0 ? scanBlocks.join(" ") : html.slice(0, 5000);

  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = linkRegex.exec(searchText)) !== null) {
    const href = m[1];
    try {
      const resolved = new URL(href, baseUrl);
      // Only same-origin
      if (resolved.hostname !== baseUrl.hostname) continue;
      // Skip fragments, mailto, tel, media
      if (resolved.pathname === "/" || resolved.pathname === baseUrl.pathname) continue;
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|mp4|zip|css|js|ico)$/i.test(resolved.pathname)) continue;
      // Strip query + fragment
      const clean = `${resolved.origin}${resolved.pathname}`.replace(/\/$/, "");
      links.add(clean);
    } catch {
      /* bad URL */
    }
  }

  return Array.from(links).slice(0, 6); // top 6 nav links
}

/**
 * Crawl a company's homepage + main nav pages and return a consolidated
 * text block suitable for injecting into an LLM prompt.
 */
export async function crawlCompanySite(
  url: string,
  opts: { maxPerPageChars?: number; totalMaxChars?: number } = {}
): Promise<{ content: string; reachable: boolean; pagesFetched: string[]; error?: string }> {
  const maxPerPage = opts.maxPerPageChars ?? 2500;
  const totalMax = opts.totalMaxChars ?? 12000;

  try {
    const normalised = url.startsWith("http") ? url : `https://${url}`;
    const baseUrl = new URL(normalised);

    // 1. Fetch homepage
    const homepageHtml = await fetchHtml(normalised);
    if (!homepageHtml) {
      return {
        content: "",
        reachable: false,
        pagesFetched: [],
        error: "Homepage fetch failed",
      };
    }

    // 2. Extract nav links
    const navLinks = extractNavLinks(homepageHtml, baseUrl);

    // 3. Fetch nav pages in parallel (with short timeout each)
    const navPagesResults = await Promise.all(
      navLinks.map(async (link) => {
        const html = await fetchHtml(link, 6000);
        return { url: link, html };
      })
    );

    // 4. Build consolidated text
    const parts: string[] = [];
    const pagesFetched: string[] = [normalised];

    const homeMeta = extractMeta(homepageHtml);
    const homeText = stripHtml(homepageHtml).slice(0, maxPerPage);
    parts.push(`=== HOMEPAGE: ${normalised} ===`);
    if (homeMeta.title) parts.push(`Title: ${homeMeta.title}`);
    if (homeMeta.description) parts.push(`Meta description: ${homeMeta.description}`);
    if (homeMeta.ogDescription && homeMeta.ogDescription !== homeMeta.description) {
      parts.push(`OG description: ${homeMeta.ogDescription}`);
    }
    parts.push(`\n${homeText}`);

    for (const { url: linkUrl, html } of navPagesResults) {
      if (!html) continue;
      const meta = extractMeta(html);
      const text = stripHtml(html).slice(0, maxPerPage);
      parts.push(`\n=== ${linkUrl} ===`);
      if (meta.title) parts.push(`Title: ${meta.title}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      parts.push(text);
      pagesFetched.push(linkUrl);
    }

    let content = parts.join("\n");
    if (content.length > totalMax) content = content.slice(0, totalMax) + "\n[truncated]";

    return { content, reachable: true, pagesFetched };
  } catch (err) {
    return {
      content: "",
      reachable: false,
      pagesFetched: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
