import express from "express";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = express();
const port = 3001;

// Allow express to parse JSON bodies
app.use(express.json());

app.post("/api/token", async (req, res) => {
  // Exchange the code for an access_token
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  // Retrieve the access_token from the response
  const { access_token } = await response.json();

  // Return the access_token to our client as { access_token: "..." }
  res.send({ access_token });
});

// Post the player's result to the channel as the bot
app.post("/api/share-result", async (req, res) => {
  const { channel_id, content } = req.body ?? {};
  if (
    typeof channel_id !== "string" ||
    !/^\d+$/.test(channel_id) ||
    typeof content !== "string" ||
    content.length === 0 ||
    content.length > 300
  ) {
    return res.status(400).send({ error: "bad request" });
  }
  const r = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  res.status(r.status).send(await r.json());
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
