# Michael Ender (personal site)

Mike's central site: writer, builder, tournament poker pro and coach, connector. Design: a round walking labyrinth; each ring is one part of his life (Story, Building, Writing, Poker, Circles), the center is where you meet him (contact + email list).

- Work on branch `dev`. Never push to `main` unless Mike explicitly says "go live".
- One static `index.html`, photos in `img/` (Mike's own photos, 640x800, 4:5), `api/subscribe.js` stores email signups in Upstash Redis (env KV_REST_API_URL / KV_REST_API_TOKEN) under hash `me:subscribers`.
- Links: Generalist Compass https://generalist-compass.vercel.app, Table Ready https://table-ready-eosin.vercel.app, Substack https://substack.com/@phanteidos1, poems https://allpoetry.com/Michael_Ender, coaching https://phanteidos1.netlify.app, The Drop https://beyond-ethereal-path.base44.app/, Instagram https://instagram.com/Phanteidos1
- Story text comes from his book "Open Your I's": keep it specific and plain, not generic, not too poetic. English. No em dashes.
- Keep the labyrinth usable: walk/back buttons, ring labels clickable, arrow keys, works at 360px and in dark mode.
