export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // OAuth2 code exchange (same role as server/server.js in local dev)
    if (url.pathname === "/api/token") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      const { code } = await request.json();
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.VITE_DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
        }),
      });
      const { access_token } = await response.json();
      return Response.json({ access_token });
    }

    // Post the player's result to the channel as the bot
    if (url.pathname === "/api/share-result") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      const { channel_id, content } = await request.json();
      if (
        typeof channel_id !== "string" ||
        !/^\d+$/.test(channel_id) ||
        typeof content !== "string" ||
        content.length === 0 ||
        content.length > 300
      ) {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      });
      return new Response(await r.text(), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Everything else: static game assets from client/dist
    return env.ASSETS.fetch(request);
  },
};
