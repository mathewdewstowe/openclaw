/**
 * Inflexion MCP Search + Fetch Server
 * Cloudflare Worker exposing two tools for Claude Managed Agents:
 *
 *   1. brave_web_search  — search the web, get result titles/URLs/snippets
 *   2. fetch_url         — fetch a URL and return its readable text content
 *
 * MCP protocol: https://modelcontextprotocol.io/docs/concepts/transports#http-with-sse
 */

interface Env {
  BRAVE_API_KEY: string;
}

// ─── Brave Search ─────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveResponse {
  web?: {
    results?: BraveResult[];
  };
}

async function braveSearch(query: string, apiKey: string, count = 10): Promise<BraveResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("freshness", "py"); // past year

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as BraveResponse;
  return data.web?.results ?? [];
}

function formatResults(results: BraveResult[]): string {
  if (results.length === 0) return "No results found.";
  return results.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}${r.age ? `\nDate: ${r.age}` : ""}`
  ).join("\n\n");
}

// ─── URL Fetch ────────────────────────────────────────────────

/**
 * Strip HTML tags and boilerplate, returning readable page text.
 * Removes: scripts, styles, nav, footer, header, aside, forms, SVG.
 * Collapses whitespace. Truncates to maxChars.
 */
function stripHtml(html: string, maxChars = 12000): string {
  // Remove non-content elements entirely
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
    .replace(/<!--[\s\S]*?-->/g, "");

  // Preserve line breaks at block-level elements
  text = text
    .replace(/<\/?(h[1-6]|p|div|section|article|li|tr|br|blockquote)[^>]*>/gi, "\n")
    .replace(/<\/?(th|td)[^>]*>/gi, "\t");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

  // Collapse whitespace
  text = text
    .replace(/\t+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= maxChars) return text;

  // Truncate cleanly at a sentence boundary if possible
  const truncated = text.slice(0, maxChars);
  const lastSentence = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf(".\n"),
  );
  return (lastSentence > maxChars * 0.8 ? truncated.slice(0, lastSentence + 1) : truncated) +
    "\n\n[Content truncated]";
}

async function fetchUrl(url: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Only HTTP/HTTPS URLs are supported`);
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Inflexion/1.0; +https://inflexion.io)",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    // Follow redirects (default in Cloudflare Workers)
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Plain text — return directly
  if (contentType.includes("text/plain")) {
    const text = await res.text();
    return text.slice(0, 12000);
  }

  // JSON — return as-is (useful for APIs)
  if (contentType.includes("application/json")) {
    const text = await res.text();
    return text.slice(0, 12000);
  }

  // HTML — strip and clean
  if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
    const html = await res.text();
    return stripHtml(html);
  }

  // PDF, binary, etc. — not supported
  throw new Error(`Unsupported content type: ${contentType}`);
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
        description: "The search query. Be specific. Include company names, dates, and relevant qualifiers. Example: 'Nth Layer strategic advisory Cardiff UK 2025' or 'competitor.com pricing funding 2025'.",
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
  description: `Fetch the full text content of a URL. Use this to read actual page content after finding URLs via brave_web_search.

Best uses:
- Company homepage and About page (understand how they describe themselves)
- Company product/platform pages (features, positioning language)
- Company pricing page (packaging, tiers)
- Company customer/case-study pages (ICP signals, use cases)
- Competitor homepages (hero copy, positioning statements)
- G2 profile pages (category, ratings, review excerpts)
- LinkedIn company pages (headcount, recent posts)
- Analyst summaries (Gartner, Forrester excerpts)
- News articles (funding rounds, launches, leadership changes)

Returns cleaned readable text (up to 12,000 characters). Not suitable for PDFs or binary files.`,
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
    // CORS preflight
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

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "inflexion-mcp-search", tools: ["brave_web_search", "fetch_url"] });
    }

    // MCP endpoint
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

    // ── MCP methods ──────────────────────────────────────────

    if (method === "initialize") {
      return jsonrpc(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "inflexion-mcp-search", version: "2.0.0" },
      });
    }

    if (method === "tools/list") {
      return jsonrpc(id, { tools: [SEARCH_TOOL, FETCH_TOOL] });
    }

    if (method === "tools/call") {
      const toolName = (params?.name as string) ?? "";
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

      // ── brave_web_search ────────────────────────────────────
      if (toolName === "brave_web_search") {
        const query = String(toolArgs.query ?? "");
        const count = Math.min(Number(toolArgs.count ?? 10), 20);

        if (!query) {
          return jsonrpcError(id, -32602, "query is required");
        }

        try {
          const results = await braveSearch(query, env.BRAVE_API_KEY, count);
          const text = formatResults(results);
          return jsonrpc(id, {
            content: [{ type: "text", text: `Search results for: "${query}"\n\n${text}` }],
          });
        } catch (err) {
          return jsonrpcError(id, -32603, `Search failed: ${String(err)}`);
        }
      }

      // ── fetch_url ───────────────────────────────────────────
      if (toolName === "fetch_url") {
        const targetUrl = String(toolArgs.url ?? "");

        if (!targetUrl) {
          return jsonrpcError(id, -32602, "url is required");
        }

        try {
          const text = await fetchUrl(targetUrl);
          return jsonrpc(id, {
            content: [{ type: "text", text: `Content of ${targetUrl}:\n\n${text}` }],
          });
        } catch (err) {
          return jsonrpcError(id, -32603, `Fetch failed: ${String(err)}`);
        }
      }

      return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
    }

    // Notifications — no response needed
    if (method.startsWith("notifications/")) {
      return new Response(null, { status: 204 });
    }

    return jsonrpcError(id, -32601, `Method not found: ${method}`);
  },
};
