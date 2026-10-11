// Email list signups for michael-ender.
// Stores emails in Upstash Redis when the database is connected in Vercel
// (KV_REST_API_URL / KV_REST_API_TOKEN), otherwise only logs them.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (req.body && req.body.check === true) {
    if (!URL_ || !TOKEN) return res.status(200).json({ db: false });
    try {
      const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify([["PING"], ["HLEN", "me:subscribers"]]) });
      const d = await r.json();
      return res.status(200).json({ db: r.ok, ping: d[0] && d[0].result, subscribers: d[1] && d[1].result });
    } catch (e) { return res.status(200).json({ db: false, error: "unreachable" }); }
  }
  const email = String((req.body && req.body.email) || "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "That email doesn't look right." });
  const entry = JSON.stringify({ email, at: new Date().toISOString(), source: "michael-ender" });
  if (!URL_ || !TOKEN) { console.log("SIGNUP", entry); return res.status(200).json({ ok: true }); }
  try {
    const r = await fetch(URL_ + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" },
      body: JSON.stringify([["HSET", "me:subscribers", email, entry]]),
    });
    if (!r.ok) throw new Error("storage " + r.status);
    return res.status(200).json({ ok: true, stored: true });
  } catch (e) {
    console.log("SIGNUP (not stored)", entry, String(e));
    return res.status(200).json({ ok: true });
  }
}
