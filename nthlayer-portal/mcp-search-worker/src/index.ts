/**
 * Inflexion MCP Search Server
 * Cloudflare Worker exposing Brave Search as an MCP tool for Claude Managed Agents.
 *
 * MCP protocol: https://modelcontextprotocol.io/docs/concepts/transports#http-with-sse
 * The Claude Agents API calls this server when an agent uses the brave_web_search tool.
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

// ─── MCP Protocol ─────────────────────────────────────────────

const MCP_TOOL_DEFINITION = {
  name: "brave_web_search",
  description: "Search the web using Brave Search. Use this to research companies, competitors, market trends, pricing, recent news, job postings, and any other live information needed for strategic analysis. Always search before making claims about market conditions, competitor activity, or industry trends.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query. Be specific. Include company names, dates, and relevant qualifiers. Example: 'Nth Layer strategic advisory Cardiff UK 2025' or 'UK boutique strategy consulting market size 2025' or 'competitor.com pricing funding 2025'.",
      },
      count: {
        type: "number",
        description: "Number of results to return. Default 10, max 20.",
      },
    },
    required: ["query"],
  },
};

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
      return Response.json({ ok: true, service: "inflexion-mcp-search" });
    }

    // MCP endpoint — all requests go to /mcp
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
        serverInfo: { name: "inflexion-mcp-search", version: "1.0.0" },
      });
    }

    if (method === "tools/list") {
      return jsonrpc(id, { tools: [MCP_TOOL_DEFINITION] });
    }

    if (method === "tools/call") {
      const toolName = (params?.name as string) ?? "";
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

      if (toolName !== "brave_web_search") {
        return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
      }

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

    // Notifications — no response needed
    if (method.startsWith("notifications/")) {
      return new Response(null, { status: 204 });
    }

    return jsonrpcError(id, -32601, `Method not found: ${method}`);
  },
};
