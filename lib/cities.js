// Match free-text Shopify city names to TCS city codes.
import { cityList } from "./tcs.js";

let cache = { list: null, at: 0 };

export async function tcsCities() {
  if (cache.list && Date.now() - cache.at < 12 * 3600 * 1000) return cache.list;
  const d = await cityList("PK");
  const list = (d?.data || []).filter((c) => c.citycode && c.cityname);
  if (!list.length) throw new Error("TCS returned an empty city list");
  cache = { list, at: Date.now() };
  return list;
}

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

// Common spellings / abbreviations customers type -> TCS city name (normalized)
const ALIASES = {
  isb: "islamabad", isl: "islamabad", islamabd: "islamabad", islambad: "islamabad",
  khi: "karachi", krachi: "karachi", newkarachi: "karachi", northkarachi: "karachi", karachisouth: "karachi",
  karachieast: "karachi", karachiwest: "karachi", karachicentral: "karachi", malir: "karachi", korangi: "karachi",
  lhr: "lahore", lhe: "lahore", lahor: "lahore",
  rwp: "rawalpindi", pindi: "rawalpindi", rawalpndi: "rawalpindi",
  fsd: "faisalabad", faislabad: "faisalabad", lyallpur: "faisalabad",
  pew: "peshawar", pesh: "peshawar", peshawer: "peshawar",
  mux: "multan", gujranwala: "gujranwala", grw: "gujranwala",
  ryk: "rahimyarkhan", rahimyarkhan: "rahimyarkhan",
  dgkhan: "deraghazikhan", dgk: "deraghazikhan", dikhan: "deraismailkhan", dik: "deraismailkhan",
  nawabshah: "nawabshah", shaheedbenazirabad: "nawabshah", benazirabad: "nawabshah",
  mingora: "swat", saidusharif: "swat",
  hyd: "hyderabad", hydrabad: "hyderabad",
  ajk: "muzaffarabad", azadkashmir: "muzaffarabad",
  sargodha: "sargodah", sargoda: "sargodah",
};

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
    {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1); // swapped letters
    }
  return m[a.length][b.length];
}

// Returns { code, name, how } or null. `how`: exact | alias | fuzzy | word | address
export function matchCity(list, cityText, addressText = "") {
  const byName = new Map(list.map((c) => [norm(c.cityname), c]));
  const byCode = new Map(list.map((c) => [norm(c.citycode), c]));
  const pick = (c, how) => (c ? { code: c.citycode, name: c.cityname, how } : null);
  const n = norm(cityText);

  if (n) {
    if (byName.has(n)) return pick(byName.get(n), "exact");
    if (ALIASES[n] && byName.has(ALIASES[n])) return pick(byName.get(ALIASES[n]), "alias");
    if (n.length === 3 && byCode.has(n)) return pick(byCode.get(n), "exact");
    // fuzzy spelling (sheikupura -> sheikhupura, harroonabad -> haroonabad)
    if (n.length >= 5) {
      let best = null, bestD = 99;
      for (const [k, c] of byName) {
        const d = lev(n, k);
        if (d < bestD) { bestD = d; best = c; }
      }
      const limit = n.length >= 9 ? 2 : 1;
      if (best && bestD <= limit) return pick(best, "fuzzy");
    }
    // multi-word input: try each word / pair ("barikot swat", "new karachi")
    const words = String(cityText).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
    const cands = [];
    for (let i = 0; i < words.length; i++) {
      for (const w of [words[i], words[i] + (words[i + 1] || "")]) {
        const k = norm(w);
        if (byName.has(k)) cands.push(byName.get(k));
        else if (ALIASES[k] && byName.has(ALIASES[k])) cands.push(byName.get(ALIASES[k]));
      }
    }
    if (cands.length) return pick(cands.sort((a, b) => b.cityname.length - a.cityname.length)[0], "word");
  }

  // last resort: look for a well-known city name inside the address
  const a = " " + String(addressText).toLowerCase().replace(/[^a-z]+/g, " ") + " ";
  let found = null;
  for (const c of list) {
    const nm = c.cityname.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    if (nm.length >= 5 && a.includes(" " + nm + " ") && (!found || nm.length > found.cityname.length)) found = c;
  }
  return pick(found, "address");
}
