/**
 * Inflexion MCP Search + Fetch Server
 * Cloudflare Worker exposing two tools for Claude Managed Agents:
 *
 *   1. brave_web_search  — search the web, get result titles/URLs/snippets
 *   2. fetch_url         — fetch a URL and return full readable text content
 *                          Uses Firecrawl (handles JS rendering + bot protection)
 *                          Falls back to direct fetch for simple static pages
 *
 * MCP protocol: https://modelcontextprotocol.io/docs/concepts/transports#http-with-sse
 */

interface Env {
  BRAVE_API_KEY: string;
  FIRECRAWL_API_KEY: string;
}

// ─── Brave Search ─────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

async function braveSearch(query: string, apiKey: string, count = 10): Promise<BraveResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("freshness", "py");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) throw new Error(`Brave API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as BraveResponse;
  return data.web?.results ?? [];
}

function formatResults(results: BraveResult[]): string {
  if (results.length === 0) return "No results found.";
  return results.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}${r.age ? `\nDate: ${r.age}` : ""}`
  ).join("\n\n");
}

// ─── Firecrawl Fetch ──────────────────────────────────────────

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
    metadata?: { title?: string; description?: string };
  };
  error?: string;
}

async function firecrawlFetch(url: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,   // strips nav, footer, cookie banners
      waitFor: 2000,           // wait 2s for JS to render
      timeout: 20000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as FirecrawlResponse;

  if (!data.success) {
    throw new Error(`Firecrawl failed: ${data.error ?? "unknown error"}`);
  }

  const text = data.data?.markdown ?? data.data?.content ?? "";
  if (!text.trim()) throw new Error("Firecrawl returned empty content");

  // Truncate to 12k chars — enough for most pages, keeps context manageable
  if (text.length <= 12000) return text;
  const truncated = text.slice(0, 12000);
  const lastSentence = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"));
  return (lastSentence > 9600 ? truncated.slice(0, lastSentence + 1) : truncated) + "\n\n[Content truncated at 12,000 characters]";
}

// ─── Direct fetch fallback (for simple static pages) ──────────

function stripHtml(html: string, maxChars = 12000): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(h[1-6]|p|div|section|article|li|tr|br|blockquote)[^>]*>/gi, "\n")
    .replace(/<\/?(th|td)[^>]*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/\t+/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSentence = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(".\n"));
  return (lastSentence > maxChars * 0.8 ? truncated.slice(0, lastSentence + 1) : truncated) + "\n\n[Content truncated]";
}

async function directFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Inflexion/1.0)",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (contentType.includes("text/plain") || contentType.includes("application/json")) {
    return text.slice(0, 12000);
  }
  return stripHtml(text);
}

// ─── Main fetch_url: Firecrawl first, direct fallback ─────────

async function fetchUrl(url: string, firecrawlApiKey: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }

  // Try Firecrawl first — handles JS rendering, bot protection, paywalls
  try {
    return await firecrawlFetch(url, firecrawlApiKey);
  } catch (firecrawlErr) {
    // Fall back to direct fetch for simple static pages
    try {
      const text = await directFetch(url);
      // If direct fetch returns very little content, it's probably JS-rendered — report it
      if (text.trim().length < 200) {
        throw new Error(`Page appears to require JavaScript rendering and Firecrawl also failed: ${String(firecrawlErr)}`);
      }
      return text;
    } catch (directErr) {
      throw new Error(`Firecrawl: ${String(firecrawlErr)} | Direct: ${String(directErr)}`);
    }
  }
}

// ─── MCP Tool Definitions ─────────────────────────────────────

const SEARCH_TOOL = {
  name: "brave_web_search",
  description: "Search the web using Brave Search. Returns titles, URLs, and short snippets. Use this first to discover relevant URLs, then use fetch_url to read the full content of specific pages.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query. Be specific. Include company names, dates, and relevant qualifiers.",
      },
      count: {
        type: "number",
        description: "Number of results to return. Default 10, max 20.",
      },
    },
    required: ["query"],
  },
};

const FETCH_TOOL = {
  name: "fetch_url",
  description: `Fetch the full text content of any URL. Uses Firecrawl to handle JavaScript-rendered pages, bot protection, and modern SaaS sites. Falls back to direct fetch for simple static pages.

Best uses:
- Company homepage, /about, /product, /pricing, /customers pages
- Competitor homepages — read actual hero copy and positioning language
- G2 and TrustRadius profile pages — actual review text
- Glassdoor company pages — ratings and review themes
- LinkedIn company pages — headcount, posts
- News articles about funding, launches, leadership changes
- Crunchbase profiles — funding history
- Analyst summaries — Gartner, Forrester excerpts
- SaaS benchmark blog posts — SaaS Capital, OpenView, Benchmarkit

Returns cleaned markdown text (up to 12,000 characters).`,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to fetch. Must be http:// or https://.",
      },
    },
    required: ["url"],
  },
};

// ─── MCP Protocol ─────────────────────────────────────────────

function jsonrpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ─── Handler ──────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "inflexion-mcp-search", version: "3.0.0", tools: ["brave_web_search", "fetch_url"] });
    }

    if (url.pathname !== "/mcp" && url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return jsonrpcError(null, -32700, "Parse error");
    }

    const { id, method, params } = body;

    if (method === "initialize") {
      return jsonrpc(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "inflexion-mcp-search", version: "3.0.0" },
      });
    }

    if (method === "tools/list") {
      return jsonrpc(id, { tools: [SEARCH_TOOL, FETCH_TOOL] });
    }

    if (method === "tools/call") {
      const toolName = (params?.name as string) ?? "";
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

      if (toolName === "brave_web_search") {
        const query = String(toolArgs.query ?? "");
        const count = Math.min(Number(toolArgs.count ?? 10), 20);
        if (!query) return jsonrpcError(id, -32602, "query is required");
        try {
          const results = await braveSearch(query, env.BRAVE_API_KEY, count);
          return jsonrpc(id, {
            content: [{ type: "text", text: `Search results for: "${query}"\n\n${formatResults(results)}` }],
          });
        } catch (err) {
          return jsonrpcError(id, -32603, `Search failed: ${String(err)}`);
        }
      }

      if (toolName === "fetch_url") {
        const targetUrl = String(toolArgs.url ?? "");
        if (!targetUrl) return jsonrpcError(id, -32602, "url is required");
        try {
          const text = await fetchUrl(targetUrl, env.FIRECRAWL_API_KEY);
          return jsonrpc(id, {
            content: [{ type: "text", text: `Content of ${targetUrl}:\n\n${text}` }],
          });
        } catch (err) {
          return jsonrpcError(id, -32603, `Fetch failed: ${String(err)}`);
        }
      }

      return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
    }

    if (method.startsWith("notifications/")) {
      return new Response(null, { status: 204 });
    }

    return jsonrpcError(id, -32601, `Method not found: ${method}`);
  },
};
