// The fire: like at the Wednesday Drop Circle, visitors drop something they don't need anymore.
// Anonymous. Stored in Upstash Redis list "me:drops" (newest first, last 500 kept).
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

// Letters (any language), digits, spaces and light punctuation only: no links, no markup.
const clean = (v, n) => String(v == null ? "" : v).normalize("NFC").replace(/[^\p{L}\p{M}\p{N} ',.!?\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "The fire isn't lit yet." });
  const b = req.body || {};
  try {
    if (b.action === "list") {
      const [all, count] = await redis([["LRANGE", "me:drops", 0, 29], ["GET", "me:drops:count"]]);
      const items = (all || []).map(x => { try { return JSON.parse(x).text; } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ items, count: Number(count) || 0 });
    }
    if (b.action === "drop") {
      const raw = String(b.text == null ? "" : b.text);
      if (/https?:|www\.|\.(com|net|org|io|co|app|me|ly|xyz)\b|@/i.test(raw)) return res.status(400).json({ error: "Just words, no links." });
      const text = clean(raw, 80);
      if (text.length < 2) return res.status(400).json({ error: "Write what you want to let go of." });
      const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "x");
      const key = "me:rl:drop:" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const [n] = await redis([["INCR", key], ["EXPIRE", key, 86400, "NX"]]);
      if (n > 5) return res.status(429).json({ error: "The fire has taken enough from you today. Come back tomorrow." });
      const [, , count] = await redis([["LPUSH", "me:drops", JSON.stringify({ text, at: Date.now() })], ["LTRIM", "me:drops", 0, 499], ["INCR", "me:drops:count"]]);
      return res.status(200).json({ ok: true, count });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.log("Fire error", String(e));
    return res.status(502).json({ error: "The fire is having trouble. Try again in a minute." });
  }
}
