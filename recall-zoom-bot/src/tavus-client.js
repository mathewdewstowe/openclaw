/**
 * Tavus CVI (Conversational Video Interface) client.
 * Creates and manages Tavus avatar conversation sessions.
 *
 * The conversation_url returned is a Daily WebRTC room URL.
 * Embed via Daily JS SDK, iframe, or load in a browser tab.
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
   *
   * Returns:
   *   conversation_id    — unique ID
   *   conversation_url   — Daily WebRTC room URL (embed or load in browser)
   *   conversation_name  — human-readable name
   *   status             — "active" or "ended"
   *   meeting_token      — JWT (only when is_private: true)
   *
   * Note: conversation times out after 4 min if nobody joins.
   *
   * @param {object} opts
   * @param {string} opts.replicaId - Tavus replica ID (visual avatar)
   * @param {string} opts.personaId - Tavus persona ID (behavior, prompt, pipeline)
   * @param {string} [opts.conversationName] - Human-readable name
   * @param {string} [opts.customGreeting] - What the replica says when participant joins
   * @param {string} [opts.context] - Session-specific context appended to persona's base
   * @param {string} [opts.callbackUrl] - URL for webhook events (replica_joined, shutdown, etc.)
   * @param {string} [opts.language] - Full language name e.g. "Spanish" (30+ supported)
   * @param {boolean} [opts.isPrivate] - If true, returns a meeting_token required to join
   * @param {number} [opts.maxParticipants] - Max participants (min 2, replica counts as 1)
   */
  createConversation({
    replicaId,
    personaId,
    conversationName,
    customGreeting,
    context,
    callbackUrl,
    language,
    isPrivate,
    maxParticipants,
  }) {
    const body = {};
    if (replicaId) body.replica_id = replicaId;
    if (personaId) body.persona_id = personaId;
    if (conversationName) body.conversation_name = conversationName;
    if (customGreeting) body.custom_greeting = customGreeting;
    if (context) body.conversational_context = context;
    if (callbackUrl) body.callback_url = callbackUrl;
    if (language) body.properties = { language };
    if (isPrivate) body.is_private = true;
    if (maxParticipants) body.max_participants = maxParticipants;

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
