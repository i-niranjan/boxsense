/**
 * npm run eval -- recordings/<session>
 *
 * Replays a recording through each memory mode and compares it with the hand-written
 * recordings/<session>/groundtruth.json:
 *
 *   { "realObjects": 10,
 *     "events": [ { "t": 42, "object": "B3", "event": "hidden" }, ... ] }
 *
 * Only object count error is implemented so far.
 * TODO: re-ID accuracy, occlusion survival, change detection, position drift, latency.
 * TODO: cache SAM responses per frame on disk, so re-running eval doesn't call the API again.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { MemoryMode } from './memory.js';
import { Pipeline } from './pipeline.js';
import { readRecording } from './recording.js';

interface GroundTruth {
  realObjects: number;
  events?: { t: number; object: string; event: 'hidden' | 'revealed' | 'removed' }[];
}

const MODES: MemoryMode[] = ['none', 'position', 'full'];

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) throw new Error('usage: npm run eval -- recordings/<session>');
  const dir = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
  const truth = JSON.parse(readFileSync(join(dir, 'groundtruth.json'), 'utf8')) as GroundTruth;

  const rows = [];
  for (const mode of MODES) {
    const pipeline = new Pipeline(mode);
    let keyframes = 0;
    for await (const frame of readRecording(dir)) {
      if (await pipeline.process(frame)) keyframes++;
    }
    const counted = pipeline.memory.list().length;
    rows.push({ mode, keyframes, counted, real: truth.realObjects, countError: counted - truth.realObjects });
  }
  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
