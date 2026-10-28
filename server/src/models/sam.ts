import type { Detection } from '../types.js';

/**
 * SAM 3.1 through the Meta Model API: image + text prompts → detections.
 *
 * TODO(Oct 29): fill in the endpoint and the request/response shape from the Meta Model API
 * docs. Time one call and note the latency and rate limits in the Obsidian raw notes.
 * Open question: per-image calls vs video tracks (Obsidian: "SAM 3.1 call mode").
 */
export async function segment(image: Buffer, prompts: string[]): Promise<Detection[]> {
  if (process.env.SAM_MOCK === '1') return mockSegment(prompts);

  const apiKey = process.env.META_API_KEY;
  const base = process.env.META_API_BASE;
  if (!apiKey || !base) throw new Error('Set META_API_KEY and META_API_BASE in .env, or SAM_MOCK=1');

  void image;
  throw new Error('SAM 3.1 client not implemented yet (server/src/models/sam.ts)');
}

/** Pretends there's a box in the middle of every frame, so the rest of the pipeline can run. */
function mockSegment(prompts: string[]): Detection[] {
  return [{ label: prompts[0], score: 1, box: [0.4, 0.4, 0.6, 0.6] }];
}
