/**
 * Tavus CVI (Conversational Video Interface) client.
 * Creates and manages Tavus avatar conversation sessions.
 *
 * Docs: https://docs.tavus.io
 * API:  https://tavusapi.com/v2/conversations
 */
class TavusClient {
  constructor(apiKey) {
    if (!apiKey) throw new Error("TAVUS_API_KEY is required");
    this.apiKey = apiKey;
    this.baseUrl = "https://tavusapi.com/v2";
  }

  async request(method, path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Tavus API ${method} ${path}: ${res.status} ${text}`);
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) return null;
    return res.json();
  }

  /**
   * Create a new conversation session.
   * Returns { conversation_id, conversation_url, status }
   *
   * The conversation_url is a WebRTC-based video page showing the Tavus avatar.
   * Load this in a browser to connect — the avatar will see/hear/respond.
   */
  createConversation({ replicaId, personaId, conversationName, customGreeting, context }) {
    const body = {
      replica_id: replicaId,
      persona_id: personaId,
    };
    if (conversationName) body.conversation_name = conversationName;
    if (customGreeting) body.custom_greeting = customGreeting;
    if (context) body.conversational_context = context;

    return this.request("POST", "/conversations", body);
  }

  /** Get conversation status and details */
  getConversation(conversationId) {
    return this.request("GET", `/conversations/${conversationId}`);
  }

  /** End a conversation */
  endConversation(conversationId) {
    return this.request("POST", `/conversations/${conversationId}/end`);
  }

  /** List available replicas */
  listReplicas() {
    return this.request("GET", "/replicas");
  }

  /** List available personas */
  listPersonas() {
    return this.request("GET", "/personas");
  }
}

module.exports = { TavusClient };
