import { DiscordSDK } from "@discord/embedded-app-sdk";

// Returns the authenticated Discord user, or null when running outside
// Discord (plain browser dev mode).
export async function setupDiscord() {
  const isEmbedded = new URLSearchParams(window.location.search).has("frame_id");
  if (!isEmbedded) return null;

  const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

  await discordSdk.ready();

  // Authorize with the Discord client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  // Exchange the code for an access_token via our backend
  const response = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const { access_token } = await response.json();

  // Authenticate with the Discord client
  const auth = await discordSdk.commands.authenticate({ access_token });
  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
  return auth.user;
}

export function avatarUrl(user) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
