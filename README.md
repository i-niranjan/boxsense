# BoxSense

Scan a room with an Android phone. A laptop builds a live 3D map of the objects it sees and **remembers them** across viewpoints, occlusion and time, instead of treating every frame as new. The first use case is warehouse shelves.

Built for the [Meta AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon). **Submissions are due 2026-11-04, 9:00 PM ET.**

## How it works

```
Phone (Chrome, WebXR page)            Laptop (Node + Express)                    Browser
──────────────────────────            ───────────────────────────────            ─────────────────
camera image  ┐                       keyframe? (moved/turned enough)
phone pose    ├── WebSocket ──▶       → SAM 3.1: text prompt → boxes/masks
depth grid    ┘   ~3 fps              → depth + pose → 3D position in the room
                                      → match against object memory   ── WS ──▶ 3D viewer
                                      → unseen-but-in-view objects:              (react-three-fiber)
                                          depth closer  → occluded
                                          nothing there → missing
```

**Identity comes from geometry, not the model.** SAM finds objects in a single image; our memory decides whether it has seen each one before, mainly from its 3D position.

| Meta model | Job | Status |
|---|---|---|
| SAM 3.1 (Meta Model API) | Find objects from a text prompt | Mocked. Client TODO |
| DINOv2 (open weights, Transformers.js) | Visual fingerprint for re-ID | TODO |
| Muse Spark (Meta Model API) | Name objects, answer questions | TODO |

## Quick start

```bash
cp .env.example .env      # SAM_MOCK=1 by default, so no API key needed yet
npm install
npm run dev               # server on :8787, web on :5173
```

- Viewer: http://localhost:5173
- Phone: `http://<laptop-ip>:5173/phone.html` (get the IP with `ipconfig getifaddr en0`)

### Phone setup (once)

WebXR only runs on HTTPS or on origins Chrome trusts:

1. Check the phone supports AR depth: open https://immersive-web.github.io/webxr-samples/proposals/phone-ar-depth.html and tap Enter AR
2. On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<laptop-ip>:5173`, enable it, and relaunch Chrome
3. Phone and laptop must be on the same Wi-Fi

## Record, replay, eval

- Tap **● Record** on the phone. Frames go to `recordings/<session>/frames.jsonl`
- Replay into the viewer: set `REPLAY=recordings/<session>` in `.env`, then `npm run dev`
- Eval: write `recordings/<session>/groundtruth.json`, then `npm run eval -- recordings/<session>`

```json
{ "realObjects": 10,
  "events": [ { "t": 42, "object": "B3", "event": "hidden" } ] }
```

Eval runs every memory mode as a baseline: `none` (every detection is new), `position`, and `full` (position + fingerprint).

## Layout

```
server/src/
  index.ts           Express + WebSocket: phone in, viewer out, recording, replay
  pipeline.ts        keyframe selection → SAM → 3D placement → memory
  memory.ts          object memory: matching, occluded / missing states
  geometry.ts        pixel ↔ 3D math
  recording.ts       record and read sessions
  eval.ts            metrics vs ground truth
  models/sam.ts      SAM 3.1 client (mock for now)
  models/llm.ts      naming + Q&A (TODO)
  models/fingerprint.ts  DINOv2 (TODO)
web/
  phone.html + src/phone/phone.js   WebXR streamer (runs on the phone)
  index.html + src/viewer/          3D viewer
recordings/          saved sessions (gitignored)
```

## Decisions

Full notes are in Obsidian under `BoxSense/`.

**Made**
- The phone streams through a WebXR web page, not a native app
- Node + Express + TypeScript, with no Python
- Object identity comes from 3D position (plus fingerprint later)
- No LLM framework. The LLM never runs per frame
- Eval by record and replay, with baselines

**Open**
- [ ] Hackathon track: indie or startup
- [ ] Capture: WebXR, or plain video + VGGT on Modal (depends on the phone check)
- [ ] Naming model: Muse Spark if it takes images, otherwise Llama 4 vision on Fireworks
- [ ] SAM 3.1 call mode: per-keyframe images vs video tracks (depends on the API test)

## Plan

- [ ] **Oct 29:** phone check; one real SAM 3.1 API call (latency, response shape)
- [ ] **Oct 30:** phone page working on a device; record a shelf session
- [ ] **Oct 31:** real SAM in `models/sam.ts`; boxes in the viewer from a replay
- [ ] **Nov 1:** DINOv2 fingerprints; better matching; same IDs on revisit
- [ ] **Nov 2:** occluded/missing tuning; Muse Spark naming + Q&A
- [ ] **Nov 3:** eval numbers + baselines; demo script
- [ ] **Nov 4:** demo video, submit early
