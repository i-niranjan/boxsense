import type { Frame, FrameMessage } from './types.js';

export function decodeFrame(msg: FrameMessage): Frame {
  let depth: Frame['depth'] = null;
  if (msg.depth) {
    const bytes = Buffer.from(msg.depth.mm, 'base64');
    // Copy into a fresh buffer so the Uint16Array is 2-byte aligned.
    const mm = new Uint16Array(new Uint8Array(bytes).buffer, 0, bytes.length / 2);
    depth = { width: msg.depth.width, height: msg.depth.height, mm };
  }
  return {
    seq: msg.seq,
    t: msg.t,
    image: Buffer.from(msg.image, 'base64'),
    imageWidth: msg.imageWidth,
    imageHeight: msg.imageHeight,
    pose: msg.pose,
    projection: msg.projection,
    depth,
  };
}
