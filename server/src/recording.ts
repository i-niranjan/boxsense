import { createReadStream, createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { decodeFrame } from './protocol.js';
import type { Frame, FrameMessage } from './types.js';

export const RECORDINGS_DIR = resolve(import.meta.dirname, '../../recordings');

/**
 * Writes the phone's frame messages verbatim to recordings/<session>/frames.jsonl.
 * Hand-write recordings/<session>/groundtruth.json next to it for eval.
 */
export class Recorder {
  private stream: WriteStream | null = null;
  session: string | null = null;

  start(): string {
    this.stop();
    this.session = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = join(RECORDINGS_DIR, this.session);
    mkdirSync(dir, { recursive: true });
    this.stream = createWriteStream(join(dir, 'frames.jsonl'));
    console.log(`recording → ${dir}`);
    return this.session;
  }

  write(rawFrameMessage: string): void {
    this.stream?.write(rawFrameMessage + '\n');
  }

  stop(): void {
    if (!this.stream) return;
    this.stream.end();
    console.log(`recording stopped: ${this.session}`);
    this.stream = null;
    this.session = null;
  }
}

/** Reads a recording frame by frame. `dir` is the session folder. */
export async function* readRecording(dir: string): AsyncGenerator<Frame> {
  const lines = createInterface({ input: createReadStream(join(dir, 'frames.jsonl')) });
  for await (const line of lines) {
    if (line.trim()) yield decodeFrame(JSON.parse(line) as FrameMessage);
  }
}
