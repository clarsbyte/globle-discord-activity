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

    // Everything else: static game assets from client/dist
    return env.ASSETS.fetch(request);
  },
};
