// The fire: visitors leave a first name and one word in the Circles room.
// Stored in Upstash Redis list "me:fire" (newest first, last 200 kept).
// To remove an entry, delete it from the list in the Upstash console.

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

// Letters (any language), spaces, apostrophes and hyphens only: no links, no markup.
const clean = (v, n) => String(v == null ? "" : v).normalize("NFC").replace(/[^\p{L}\p{M} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "The fire isn't lit yet." });
  const b = req.body || {};
  try {
    if (b.action === "list") {
      const [all] = await redis([["LRANGE", "me:fire", 0, 59]]);
      const items = (all || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean).map(({ name, word, at }) => ({ name, word, at }));
      return res.status(200).json({ items });
    }
    if (b.action === "add") {
      if (/https?|www|\.[a-z]{2,}\b|@/i.test(String(b.name) + " " + String(b.word))) return res.status(400).json({ error: "Just a name and a word, no links." });
      const name = clean(b.name, 24), word = clean(b.word, 24);
      if (name.length < 1 || word.length < 2) return res.status(400).json({ error: "Add your first name and one word." });
      if (word.includes(" ") && word.split(" ").length > 2) return res.status(400).json({ error: "One word is enough." });
      const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "x");
      const key = "me:rl:fire:" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const [n] = await redis([["INCR", key], ["EXPIRE", key, 86400, "NX"]]);
      if (n > 3) return res.status(429).json({ error: "You've already added to the fire today." });
      const item = { name, word, at: Date.now() };
      await redis([["LPUSH", "me:fire", JSON.stringify(item)], ["LTRIM", "me:fire", 0, 199]]);
      return res.status(200).json({ item });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.log("Fire error", String(e));
    return res.status(502).json({ error: "The fire is having trouble. Try again in a minute." });
  }
}
