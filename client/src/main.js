import "./style.css";
import { loadCountries } from "./data.js";
import { startGame } from "./game.js";
import { setupDiscord, avatarUrl } from "./discord.js";
import { initSpace } from "./space.js";

const app = document.querySelector("#app");

function renderHeader(user) {
  const header = document.querySelector("#header");
  if (user) {
    const name = user.global_name ?? user.username;
    header.innerHTML = `
      <h1><img src="/globe-icon.png" alt="" class="logo" /> Globle</h1>
      <div class="user-chip">
        <img src="${avatarUrl(user)}" alt="" width="24" height="24" />
        <span>${name}</span>
      </div>
    `;
  } else {
    header.innerHTML = `
      <h1><img src="/globe-icon.png" alt="" class="logo" /> Globle</h1>
      <div class="user-chip dev">dev / browser mode</div>
    `;
  }
}

async function main() {
  initSpace();
  renderHeader(null);

  try {
    await loadCountries();
  } catch (err) {
    console.error("Failed to load country data", err);
    app.innerHTML = `<p class="message error">Failed to load country data.</p>`;
    return;
  }

  // Authenticate with Discord when running as an Activity; in a plain
  // browser we skip auth and run in dev mode. Resolves to
  // { user, channelId } in Discord, or null in the browser.
  const sessionPromise = setupDiscord()
    .then((session) => {
      if (session) renderHeader(session.user);
      console.log(session ? "Discord SDK is authenticated" : "Browser dev mode (not in Discord)");
      return session;
    })
    .catch((err) => {
      console.error("Discord auth failed", err);
      return null;
    });

  startGame(app, sessionPromise);
}

main();
