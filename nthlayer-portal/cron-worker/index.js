export default {
  async scheduled(event, env, ctx) {
    const secret = env.INTERNAL_SECRET;
    const base = "https://nthlayer-portal.matthewdewstowe.workers.dev";
    const headers = {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    };

    // Every minute: advance pipeline scans
    ctx.waitUntil(
      env.PORTAL.fetch(`${base}/api/cron/advance-scans`, { method: "POST", headers })
        .then((r) => r.json())
        .then((d) => console.log("advance-scans:", JSON.stringify(d)))
        .catch((err) => console.error("advance-scans failed:", err))
    );

    // Daily at 7am UTC: fetch competitor news
    // cron = "0 7 * * *" → scheduledTime will be at 7:00
    const isDaily = event.cron === "0 7 * * *";
    if (isDaily) {
      ctx.waitUntil(
        env.PORTAL.fetch(`${base}/api/cron/fetch-news`, { method: "POST", headers })
          .then((r) => r.json())
          .then((d) => console.log("fetch-news:", JSON.stringify(d)))
          .catch((err) => console.error("fetch-news failed:", err))
      );
    }
  },
};
