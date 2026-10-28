# BoxSense

Hackathon project, due 2026-11-04 9 PM ET. Read README.md first; it has the architecture, decisions and plan.
Project notes and decision records live in the Obsidian vault at `~/Documents/Obsidian Vault/BoxSense/`.

- The user is not a Python or Android developer. Keep everything in TypeScript/JavaScript (Node + Express, Vite + React).
- Server: `server/src`, ESM with NodeNext, so relative imports use `.js` extensions. Run with tsx; no build step.
- Wire formats live in `server/src/types.ts`. The viewer mirrors `SceneMessage` by hand in `web/src/viewer/App.tsx`.
- `web/src/phone/phone.js` runs on the phone and can't be tested here. Say so when changing it.
- Check with `npm run typecheck`. Develop against recordings (`REPLAY=`) rather than a live phone.
