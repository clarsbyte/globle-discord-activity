# Globle — Discord Activity

A Discord Activity version of [Globle](https://globle-game.com): guess the mystery
country, and every guess is painted onto a realistic 3D satellite earth colored by
proximity (cold → hot). The scene is set in space — twinkling stars, shooting stars,
and the moon drifting by. There's a **daily** country (UTC date-seeded, so everyone
in the channel gets the same one) and a **free play** mode.

Built with the [Embedded App SDK](https://discord.com/developers/docs/developer-tools/embedded-app-sdk),
Vite, [three.js](https://threejs.org) (textured sphere; countries are drawn onto the
equirectangular texture with D3), and a small Express backend for the OAuth2 token exchange.

## Project structure

```
├── client/            the Activity frontend (Vite + vanilla JS + D3)
│   └── src/assets/    country GeoJSON + name aliases
├── server/            Express backend (POST /api/token), port 3001
├── example.env        copy to .env and fill in your app's credentials
└── README.md
```

## Setup

### 1. Create & configure the Discord app

1. Create an app in the [developer portal](https://discord.com/developers/applications?new_application=true).
2. **Installation** page: enable both **User Install** and **Guild Install**.
3. **OAuth2** page: add `https://127.0.0.1` under **Redirects** (placeholder; the SDK handles the real flow).
4. Still on **OAuth2**: copy the **Client ID** and **Client Secret** into a new `.env` file
   in the project root (`cp example.env .env`):
   - `VITE_DISCORD_CLIENT_ID` = Client ID
   - `DISCORD_CLIENT_SECRET` = Client Secret (keep it secret, never commit it)

### 2. Install & run

```bash
# backend (OAuth token exchange) — terminal 1
cd server
npm install
npm run dev

# frontend (the Activity) — terminal 2
cd client
npm install
npm run dev
```

The game now runs at <http://localhost:5173> in "dev / browser mode" (no Discord
auth) — handy for development.

### 3. Expose it & enable the Activity

1. Start a tunnel to the client (terminal 3):

   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```

   (ngrok works too.) Copy the generated public URL.

2. In the developer portal go to **Activities → URL Mappings** and add:

   | PREFIX | TARGET                                   |
   | ------ | ---------------------------------------- |
   | `/`    | `your-tunnel-host.trycloudflare.com`     |

3. Go to **Activities → Settings** and tick **Enable Activities**.
4. In Discord (with Developer Mode on), open the **App Launcher** in any channel
   and launch your app. Authorize it once, and play. 🌍

## Deployment (production)

The game is deployed as a **Cloudflare Worker** (`globle-activity`) that serves the
built client and handles `/api/token` — free tier is more than enough.

- `worker.js` — the Worker (static assets + token exchange)
- `wrangler.toml` — config; `VITE_DISCORD_CLIENT_ID` lives here as a var
- `DISCORD_CLIENT_SECRET` — stored as a Worker secret
  (`grep ^DISCORD_CLIENT_SECRET= .env | cut -d= -f2- | npx wrangler secret put DISCORD_CLIENT_SECRET`)
- Redeploy after changes: `npm run deploy` (builds the client, then `wrangler deploy`)
- CI: pushes to `main` auto-deploy via `.github/workflows/deploy.yml`
  (needs repo secret `CLOUDFLARE_API_TOKEN`; vars `VITE_DISCORD_CLIENT_ID`
  and `CLOUDFLARE_ACCOUNT_ID` are already set)

Live URL: `https://globle-activity.globle-clarissa.workers.dev` — point the
dev-portal **URL Mapping** `/` at `globle-activity.globle-clarissa.workers.dev`.

For local dev, keep using `server/` + `client/` + a cloudflared quick tunnel
(`./cloudflared.exe tunnel --url http://localhost:5173`).

## How the game works

- Proximity between countries is the minimum haversine distance between border
  vertices, so neighbours score ~0 km ("hottest"); the gradient caps at 15,000 km.
- The daily answer is picked by a UTC date seed, so no server state is needed for
  everyone in a channel to share the same puzzle.
- Each Activity iframe runs per-user, so guesses are individual — compare results
  in chat with the "Copy result" share button.

## Credits & license

- Country geometry and alternate-name data come from
  [the-abe-train/globle](https://github.com/the-abe-train/globle)
  (CC BY-NC-SA 4.0), derived from public-domain Natural Earth data.
- Earth texture is NASA Blue Marble imagery (public domain), via
  [three-globe](https://github.com/vasturiano/three-globe).
- The space background is generated procedurally at runtime (fractal-noise
  nebula + starfield) — no image assets.
- Fonts: Space Grotesk, Orbitron, Inter (SIL OFL) and Geist Pixel (Vercel, OFL).
- Game inspired by the original [Globle](https://globle-game.com) by Abe Train.
