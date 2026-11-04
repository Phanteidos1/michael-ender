// The fire: visitors leave their first name and one word. Everyone after sees them glowing as sparks.
// Stored in Upstash Redis list "me:fire" (newest first, last 500 kept). Total in "me:fire:count".
// No swear filter: to remove an entry, delete it from the list "me:fire" in the Upstash console.

import { createHash } from "node:crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const d = await r.json();
  if (!r.ok || !Array.isArray(d)) throw new Error("storage " + r.status);
  return d.map(x => x.result);
}

// Letters (any language) only, plus hyphen and apostrophe inside a word: no links, emails, digits or symbols.
const WORD = /^[\p{L}\p{M}]+(?:['\-][\p{L}\p{M}]+)*$/u;
const tidy = v => String(v == null ? "" : v).normalize("NFC").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "The fire isn't lit yet." });
  const b = req.body || {};
  try {
    if (b.action === "list") {
      const [all, count] = await redis([["LRANGE", "me:fire", 0, 39], ["GET", "me:fire:count"]]);
      const items = (all || []).map(x => { try { const o = JSON.parse(x); return o.name && o.word ? { name: o.name, word: o.word } : null; } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ items, count: Number(count) || 0 });
    }
    if (b.action === "add") {
      const name = tidy(b.name), word = tidy(b.word);
      if (!name || !word) return res.status(400).json({ error: "Your first name and one word, please." });
      if (name.length > 20 || !WORD.test(name)) return res.status(400).json({ error: "Just your first name, letters only." });
      if (word.length > 20 || !WORD.test(word)) return res.status(400).json({ error: "One word, letters only. No links or symbols." });
      const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "x");
      const key = "me:rl:fire:" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const [n] = await redis([["INCR", key], ["EXPIRE", key, 86400, "NX"]]);
      if (n > 3) return res.status(429).json({ error: "Three sparks a day. Come back tomorrow." });
      const cap = w => w.charAt(0).toLocaleUpperCase() + w.slice(1);
      const entry = { name: cap(name), word: word.toLocaleLowerCase(), at: Date.now() };
      const [, , count] = await redis([["LPUSH", "me:fire", JSON.stringify(entry)], ["LTRIM", "me:fire", 0, 499], ["INCR", "me:fire:count"]]);
      return res.status(200).json({ ok: true, count, item: { name: entry.name, word: entry.word } });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.log("Fire error", String(e));
    return res.status(502).json({ error: "The fire is having trouble. Try again in a minute." });
  }
}
