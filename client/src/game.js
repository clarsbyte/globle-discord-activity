import {
  allCountries,
  findCountry,
  searchCountries,
  proximityOf,
  getDailyAnswer,
  getRandomAnswer,
  todayString,
} from "./data.js";
import { initGlobe, updateGlobe, resetGlobe, spinTo } from "./globe.js";

const heatColorFor = (proximity) => {
  // Mirror of the globe gradient for the guess list chips
  if (proximity >= 1) return "#2ac42b";
  const stops = [
    [0.0, "#ffffff"],
    [0.25, "#fee391"],
    [0.5, "#fe9929"],
    [0.75, "#e34a33"],
    [1.0, "#b30000"],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (proximity <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (proximity - p0) / (p1 - p0);
      const lerp = (a, b) => Math.round(a + (b - a) * t);
      const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const [r0, g0, b0] = rgb(c0);
      const [r1, g1, b1] = rgb(c1);
      return `rgb(${lerp(r0, r1)},${lerp(g0, g1)},${lerp(b0, b1)})`;
    }
  }
  return stops[stops.length - 1][1];
};

export function startGame(rootEl, sessionPromise) {
  // Resolved Discord session { user, channelId }, null in browser dev mode
  let displayName = null;
  let channelId = null;
  if (sessionPromise) {
    sessionPromise.then((s) => {
      if (s) {
        displayName = s.user.global_name ?? s.user.username;
        channelId = s.channelId;
      }
    }).catch(() => {});
  }

  rootEl.innerHTML = `
    <div class="mode-bar">
      <button id="mode-daily" class="mode-btn active" type="button">Daily</button>
      <button id="mode-free" class="mode-btn" type="button">Free play</button>
    </div>
    <div id="globe" class="globe"></div>
    <form id="guess-form" class="guess-form" autocomplete="off">
      <div class="guess-input-wrap">
        <input id="guess-input" type="text" placeholder="Guess a country..." aria-label="Country name" />
        <div id="suggestions" class="suggestions hidden"></div>
      </div>
      <button id="guess-btn" type="submit">Guess</button>
    </form>
    <div id="message" class="message"></div>
    <div id="win-banner" class="win-banner hidden"></div>
    <ul id="guess-list" class="guess-list"></ul>
  `;

  const globeEl = rootEl.querySelector("#globe");
  const form = rootEl.querySelector("#guess-form");
  const input = rootEl.querySelector("#guess-input");
  const suggestionsEl = rootEl.querySelector("#suggestions");
  const messageEl = rootEl.querySelector("#message");
  const winBanner = rootEl.querySelector("#win-banner");
  const guessList = rootEl.querySelector("#guess-list");
  const dailyBtn = rootEl.querySelector("#mode-daily");
  const freeBtn = rootEl.querySelector("#mode-free");

  initGlobe(globeEl, allCountries());

  let mode = "daily";
  let answer = null;
  let guesses = []; // [{feature, distance, proximity}]
  let isWon = false;

  function newGame(nextMode) {
    mode = nextMode;
    answer = mode === "daily" ? getDailyAnswer() : getRandomAnswer();
    guesses = [];
    isWon = false;
    guessList.innerHTML = "";
    winBanner.classList.add("hidden");
    input.disabled = false;
    input.value = "";
    hideSuggestions();
    resetGlobe();
    setMessage(
      mode === "daily"
        ? `Guess today's country (${todayString()}) — same for everyone!`
        : "Guess the mystery country!"
    );
    input.focus();
  }

  function setMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.classList.toggle("error", isError);
  }

  function alreadyGuessed(feature) {
    return guesses.some((g) => g.feature === feature);
  }

  function submitGuess(name) {
    if (isWon) return;
    const feature = findCountry(name);
    if (!feature) {
      setMessage(`"${name}" isn't a country we know — check the spelling.`, true);
      return;
    }
    if (alreadyGuessed(feature)) {
      setMessage(`You already guessed ${feature.properties.NAME}.`, true);
      return;
    }

    const { distance, proximity } = proximityOf(feature, answer);
    const correct = feature === answer;
    guesses.push({ feature, distance, proximity: correct ? 1 : proximity });

    if (correct) {
      isWon = true;
      input.disabled = true;
      showWin();
    } else if (distance === 0) {
      setMessage(`${feature.properties.NAME} is right next to the answer — they share a border!`);
    } else {
      setMessage(`${feature.properties.NAME} is ${formatKm(distance)} away — getting ${
        proximity > 0.75 ? "really hot!" : proximity > 0.5 ? "warmer..." : proximity > 0.25 ? "cold..." : "colder..."
      }`);
    }

    renderGuessList();
    updateGlobe(guesses, answer, isWon);
    spinTo(feature);
    input.value = "";
    hideSuggestions();
  }

  function formatKm(meters) {
    return `${Math.round(meters / 1000).toLocaleString()} km`;
  }

  function renderGuessList() {
    guessList.innerHTML = "";
    const sorted = guesses.slice().sort((a, b) => b.proximity - a.proximity);
    for (const g of sorted) {
      const li = document.createElement("li");
      li.className = "guess-row";
      const pct = Math.round(g.proximity * 100);
      li.innerHTML = `
        <span class="guess-name">${g.feature.properties.NAME}</span>
        <span class="guess-dist">${g.distance === 0 && g.proximity < 1 ? "next to it" : formatKm(g.distance)}</span>
        <span class="guess-chip" style="background:${heatColorFor(g.proximity)}">${pct}%</span>
      `;
      guessList.appendChild(li);
    }
  }

  function squaresFor(proximity) {
    if (proximity >= 1) return "🟩";
    if (proximity > 0.75) return "🟥";
    if (proximity > 0.5) return "🟧";
    if (proximity > 0.25) return "🟨";
    return "⬜";
  }

  function shareText() {
    const rows = guesses.map((g) => squaresFor(g.proximity)).join("");
    const who = displayName ?? "I";
    const label = mode === "daily" ? `Globle ${todayString()}` : "Globle (free play)";
    return `🌍 ${label} — ${who} guessed in ${guesses.length} guess${guesses.length === 1 ? "" : "es"}\n${rows}`;
  }

  // Clipboard with iframe-safe fallback (navigator.clipboard is often
  // blocked inside the Discord activity iframe)
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {}
      ta.remove();
      return ok;
    }
  }

  function showWin() {
    const name = answer.properties.NAME;
    const n = guesses.length;
    const headline = displayName
      ? `🎉 <strong>${displayName}</strong> guessed <strong>${name}</strong> in <strong>${n}</strong> guess${n === 1 ? "" : "es"}!`
      : `🎉 The mystery country was <strong>${name}</strong>! You got it in <strong>${n}</strong> guess${n === 1 ? "" : "es"}.`;
    winBanner.innerHTML = `
      <div>
        <div class="win-text">${headline}</div>
        <div class="win-actions">
          <button id="share-btn" type="button">Copy result</button>
          <button id="again-btn" type="button">Play free mode</button>
        </div>
      </div>
      <div class="win-check">✓</div>
    `;
    winBanner.classList.remove("hidden");
    setMessage("");

    // Post the result to the channel as the bot (Discord mode only)
    if (channelId && displayName) {
      const rows = guesses.map((g) => squaresFor(g.proximity)).join("");
      fetch("/api/share-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: channelId,
          content: `${displayName} guessed in ${n} guess${n === 1 ? "" : "es"}\n${rows}`,
        }),
      })
        .then((r) => {
          if (!r.ok) console.error("share-result failed", r.status);
        })
        .catch((err) => console.error("share-result failed", err));
    }
    winBanner.querySelector("#share-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const ok = await copyText(shareText());
      btn.textContent = ok ? "Copied!" : "Select & copy manually";
      if (!ok) window.prompt("Copy your result:", shareText());
      setTimeout(() => (btn.textContent = "Copy result"), 2000);
    });
    winBanner.querySelector("#again-btn").addEventListener("click", () => {
      freeBtn.classList.add("active");
      dailyBtn.classList.remove("active");
      newGame("free");
    });
  }

  // ---- autocomplete ----
  let highlighted = -1;

  function hideSuggestions() {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
    highlighted = -1;
  }

  function showSuggestions() {
    const matches = searchCountries(input.value);
    if (matches.length === 0) {
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = "";
    matches.forEach((feature, i) => {
      const item = document.createElement("div");
      item.className = "suggestion" + (i === highlighted ? " highlighted" : "");
      item.textContent = feature.properties.NAME;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        submitGuess(feature.properties.NAME);
      });
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.classList.remove("hidden");
  }

  input.addEventListener("input", () => {
    highlighted = -1;
    showSuggestions();
  });

  input.addEventListener("keydown", (e) => {
    const items = suggestionsEl.querySelectorAll(".suggestion");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      highlighted =
        e.key === "ArrowDown"
          ? (highlighted + 1) % items.length
          : (highlighted - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle("highlighted", i === highlighted));
    } else if (e.key === "Enter") {
      if (highlighted >= 0 && items[highlighted]) {
        e.preventDefault();
        submitGuess(items[highlighted].textContent);
      }
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  input.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitGuess(input.value);
  });

  dailyBtn.addEventListener("click", () => {
    if (mode === "daily") return;
    dailyBtn.classList.add("active");
    freeBtn.classList.remove("active");
    newGame("daily");
  });

  freeBtn.addEventListener("click", () => {
    freeBtn.classList.add("active");
    dailyBtn.classList.remove("active");
    newGame("free");
  });

  newGame("daily");
}
