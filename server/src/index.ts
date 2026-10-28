import express from 'express';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket, WebSocketServer } from 'ws';
import type { MemoryMode } from './memory.js';
import { Pipeline } from './pipeline.js';
import { decodeFrame } from './protocol.js';
import { readRecording, Recorder } from './recording.js';
import type { PhoneMessage } from './types.js';

const PORT = Number(process.env.PORT || 8787);
const MODE = (process.env.MEMORY_MODE || 'position') as MemoryMode;

const pipeline = new Pipeline(MODE);
const recorder = new Recorder();
const viewers = new Set<WebSocket>();

const app = express();
app.use(express.json());
app.get('/api/scene', (_req, res) => {
  res.json(pipeline.scene());
});
// TODO(Nov 2): POST /api/ask → models/llm.ts ask()

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(): void {
  const msg = JSON.stringify(pipeline.scene());
  for (const v of viewers) if (v.readyState === WebSocket.OPEN) v.send(msg);
}

wss.on('connection', (ws, req) => {
  const role = new URL(req.url ?? '/', 'http://localhost').searchParams.get('role');

  if (role === 'viewer') {
    viewers.add(ws);
    ws.send(JSON.stringify(pipeline.scene()));
    ws.on('close', () => viewers.delete(ws));
    return;
  }

  console.log('phone connected');
  ws.on('close', () => console.log('phone disconnected'));
  ws.on('message', async (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw) as PhoneMessage;
      if (msg.type === 'record') {
        if (msg.on) recorder.start();
        else recorder.stop();
      } else if (msg.type === 'frame') {
        recorder.write(raw);
        await pipeline.process(decodeFrame(msg));
        broadcast();
      }
    } catch (err) {
      console.error('frame failed:', err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`server on http://localhost:${PORT} (memory mode: ${MODE}, SAM mock: ${process.env.SAM_MOCK === '1'})`);
  if (process.env.REPLAY) void replay(process.env.REPLAY);
});

/** Feeds a recording through the pipeline at its original speed, so the viewer can watch. */
async function replay(dir: string): Promise<void> {
  console.log(`replaying ${dir}`);
  let prevT: number | null = null;
  for await (const frame of readRecording(dir)) {
    if (prevT !== null) await sleep(Math.max(0, frame.t - prevT));
    prevT = frame.t;
    await pipeline.process(frame);
    broadcast();
  }
  console.log('replay finished');
}
