import { distance, medianDepthInBox, poseTranslation, unproject, viewAngle } from './geometry.js';
import { ObjectMemory, type MemoryMode } from './memory.js';
import { segment } from './models/sam.js';
import type { Detection, Frame, Mat4, Observation, SceneMessage } from './types.js';

// Only run SAM when the view has changed enough to be worth it.
const KEYFRAME_MOVE_M = 0.15;
const KEYFRAME_TURN_RAD = (10 * Math.PI) / 180;
const KEYFRAME_MAX_GAP_MS = 2000;

const PROMPTS = (process.env.SAM_PROMPTS ?? 'cardboard box')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export class Pipeline {
  readonly memory: ObjectMemory;
  private camera: Mat4 | null = null;
  private lastKeyframe: { pose: Mat4; t: number } | null = null;
  private busy = false;

  constructor(mode: MemoryMode = 'position') {
    this.memory = new ObjectMemory(mode);
  }

  /** Returns true if the frame was used as a keyframe. */
  async process(frame: Frame): Promise<boolean> {
    this.camera = frame.pose;
    // Live: drop frames while SAM is still busy. Replay awaits each frame, so nothing is dropped there.
    if (this.busy || !this.isKeyframe(frame)) return false;

    this.busy = true;
    try {
      this.lastKeyframe = { pose: frame.pose, t: frame.t };
      const detections = await segment(frame.image, PROMPTS);
      const observations = detections
        .map((d) => toObservation(d, frame))
        .filter((o): o is Observation => o !== null);
      this.memory.update(observations, frame);
      return true;
    } finally {
      this.busy = false;
    }
  }

  scene(): SceneMessage {
    return {
      type: 'scene',
      t: Date.now(),
      camera: this.camera,
      objects: this.memory.list().map(({ fingerprint: _, ...o }) => o),
    };
  }

  private isKeyframe(frame: Frame): boolean {
    const last = this.lastKeyframe;
    if (!last) return true;
    return (
      distance(poseTranslation(frame.pose), poseTranslation(last.pose)) > KEYFRAME_MOVE_M ||
      viewAngle(frame.pose, last.pose) > KEYFRAME_TURN_RAD ||
      frame.t - last.t > KEYFRAME_MAX_GAP_MS
    );
  }
}

/** Places a 2D detection in the room, using depth at the middle of its box. */
function toObservation(det: Detection, frame: Frame): Observation | null {
  if (!frame.depth) return null;
  const depth = medianDepthInBox(frame.depth, det.box);
  if (depth === null) return null;
  const [x0, y0, x1, y1] = det.box;
  const position = unproject((x0 + x1) / 2, (y0 + y1) / 2, depth, frame.projection, frame.pose);
  // TODO(Nov 1): crop + fingerprint for memory mode 'full'.
  return { label: det.label, score: det.score, position, box: det.box };
}
