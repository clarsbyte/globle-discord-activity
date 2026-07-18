import dataUrl from "./assets/country_data.json?url";
import altNamesUrl from "./assets/alternate_names.json?url";

// Country data is derived from Natural Earth via the-abe-train/globle (CC BY-NC-SA 4.0)
export const MAX_DISTANCE = 15_000_000; // meters; beyond this a guess counts as "coldest"

let countries = [];
const nameIndex = new Map(); // lowercase name/alias -> feature

// Aliases missing from alternate_names.json: dataset abbreviations and
// common shorthands. Key = alias (lowercase), value = dataset NAME.
const EXTRA_ALIASES = {
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  america: "United States of America",
  uk: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  "antigua and barbuda": "Antigua and Barb.",
  "bosnia and herzegovina": "Bosnia and Herz.",
  "central african republic": "Central African Rep.",
  drc: "Dem. Rep. Congo",
  "dr congo": "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "democratic republic of congo": "Dem. Rep. Congo",
  "dominican republic": "Dominican Rep.",
  "equatorial guinea": "Eq. Guinea",
  "marshall islands": "Marshall Is.",
  "solomon islands": "Solomon Is.",
  "south sudan": "S. Sudan",
  "saint kitts and nevis": "St. Kitts and Nevis",
  "saint vincent and the grenadines": "St. Vin. and Gren.",
  "saint vincent": "St. Vin. and Gren.",
  "ivory coast": "Côte d'Ivoire",
  "cote divoire": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "sao tome and principe": "São Tomé and Principe",
  "east timor": "Timor-Leste",
  "czech republic": "Czechia",
  "cape verde": "Cabo Verde",
  turkiye: "Turkey",
  burma: "Myanmar",
  swaziland: "Eswatini",
};

function countryName(feature) {
  return feature.properties.NAME;
}

function polygonPoints(feature) {
  const { geometry } = feature;
  if (geometry.type === "Polygon") return geometry.coordinates[0];
  let points = [];
  for (const polygon of geometry.coordinates) {
    points = points.concat(polygon[0]);
  }
  return points;
}

export async function loadCountries() {
  const [dataRes, altRes] = await Promise.all([fetch(dataUrl), fetch(altNamesUrl)]);
  const data = await dataRes.json();
  const altNames = await altRes.json();

  countries = data.features.slice().sort((a, b) => countryName(a).localeCompare(countryName(b)));

  for (const feature of countries) {
    feature._points = polygonPoints(feature);
    nameIndex.set(countryName(feature).toLowerCase(), feature);
  }
  // Alternate spellings from the dataset alias file, then our extras
  for (const { real, alternative } of altNames["en-CA"]) {
    const feature = nameIndex.get(real);
    if (feature && !nameIndex.has(alternative)) nameIndex.set(alternative, feature);
  }
  for (const [alias, realName] of Object.entries(EXTRA_ALIASES)) {
    const feature = nameIndex.get(realName.toLowerCase());
    if (feature && !nameIndex.has(alias)) nameIndex.set(alias, feature);
  }
}

export function allCountries() {
  return countries;
}

export function findCountry(name) {
  return nameIndex.get(name.trim().toLowerCase()) ?? null;
}

export function searchCountries(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const startsWith = [];
  const includes = [];
  const seen = new Set();
  for (const [alias, feature] of nameIndex) {
    if (seen.has(feature)) continue;
    if (alias.startsWith(q)) {
      startsWith.push(feature);
      seen.add(feature);
    } else if (alias.includes(q)) {
      includes.push(feature);
      seen.add(feature);
    }
  }
  const byName = (a, b) => countryName(a).localeCompare(countryName(b));
  return [...startsWith.sort(byName), ...includes.sort(byName)].slice(0, limit);
}

function haversineMeters(p1, p2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Minimum distance between any vertex of either country's border, so
// neighbouring countries score ~0 km (matching the original Globle).
export function polygonDistance(a, b) {
  const name1 = countryName(a);
  const name2 = countryName(b);
  // Enclaves whose borders don't quite touch in the data
  const enclaves = [
    ["South Africa", "Lesotho"],
    ["Italy", "Vatican"],
    ["Italy", "San Marino"],
  ];
  for (const [x, y] of enclaves) {
    if ((name1 === x && name2 === y) || (name1 === y && name2 === x)) return 0;
  }
  let min = Infinity;
  for (const p1 of a._points) {
    for (const p2 of b._points) {
      const d = haversineMeters(p1, p2);
      if (d < min) min = d;
    }
  }
  return min;
}

export function proximityOf(guess, answer) {
  const distance = polygonDistance(guess, answer);
  let proximity = Math.max(0, 1 - distance / MAX_DISTANCE);
  // A wrong guess can never score 100%, even when it borders the answer
  if (guess !== answer && proximity >= 1) proximity = 0.99;
  return { distance, proximity };
}

// Deterministic daily answer (UTC date-seeded, so everyone in a channel
// gets the same country on the same day). 7919 is prime; 197 countries.
export function getDailyAnswer(date = new Date()) {
  const day = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000
  );
  return countries[(day * 7919) % countries.length];
}

export function getRandomAnswer() {
  return countries[Math.floor(Math.random() * countries.length)];
}

export function todayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
