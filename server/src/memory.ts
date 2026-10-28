import { depthAt, distance, project } from './geometry.js';
import type { Frame, MemoryObject, Observation } from './types.js';

/**
 * none     – every detection is a new object (the "no memory" baseline)
 * position – match on 3D position + label
 * full     – position + DINOv2 fingerprint (TODO)
 */
export type MemoryMode = 'none' | 'position' | 'full';

const MATCH_RADIUS_M = 0.25;
const OCCLUSION_MARGIN_M = 0.15;
const MISSING_AFTER_FRAMES = 5;
/** How much a new sighting moves the stored position (running average). */
const POSITION_BLEND = 0.3;

export class ObjectMemory {
  readonly objects = new Map<string, MemoryObject>();
  private nextId = 1;

  constructor(readonly mode: MemoryMode = 'position') {}

  /** Call once per keyframe with everything SAM found in it. */
  update(observations: Observation[], frame: Frame): void {
    const matched = new Set<string>();

    for (const obs of observations) {
      const match = this.mode === 'none' ? null : this.findMatch(obs, matched);
      if (match) {
        match.position = match.position.map((p, i) => p + (obs.position[i] - p) * POSITION_BLEND) as MemoryObject['position'];
        match.lastSeen = frame.t;
        match.seenCount++;
        match.state = 'visible';
        match.missedFrames = 0;
        matched.add(match.id);
      } else {
        const obj = this.create(obs, frame.t);
        matched.add(obj.id);
      }
    }

    this.updateUnseen(matched, frame);
  }

  list(): MemoryObject[] {
    return [...this.objects.values()];
  }

  /**
   * Greedy: the nearest unmatched object with the same label, within MATCH_RADIUS_M.
   * TODO: Hungarian matching over a combined cost (distance + fingerprint) for mode 'full'.
   */
  private findMatch(obs: Observation, taken: Set<string>): MemoryObject | null {
    let best: MemoryObject | null = null;
    let bestDist = MATCH_RADIUS_M;
    for (const obj of this.objects.values()) {
      if (taken.has(obj.id) || obj.label !== obs.label) continue;
      const d = distance(obj.position, obs.position);
      if (d < bestDist) {
        best = obj;
        bestDist = d;
      }
    }
    return best;
  }

  private create(obs: Observation, t: number): MemoryObject {
    const obj: MemoryObject = {
      id: `obj-${this.nextId++}`,
      label: obs.label,
      position: obs.position,
      state: 'visible',
      firstSeen: t,
      lastSeen: t,
      seenCount: 1,
      missedFrames: 0,
      fingerprint: obs.fingerprint,
    };
    this.objects.set(obj.id, obj);
    return obj;
  }

  /**
   * Objects the camera should be able to see but SAM didn't find:
   * something closer in the depth map → occluded; otherwise, after a few misses → missing.
   * Objects outside the view keep their state, because we learned nothing about them.
   */
  private updateUnseen(matched: Set<string>, frame: Frame): void {
    if (!frame.depth) return;
    for (const obj of this.objects.values()) {
      if (matched.has(obj.id)) continue;
      const p = project(obj.position, frame.projection, frame.pose);
      if (!p) continue;
      const d = depthAt(frame.depth, p.u, p.v);
      if (d === null) continue;
      if (d < p.depth - OCCLUSION_MARGIN_M) {
        obj.state = 'occluded';
        obj.missedFrames = 0;
      } else if (++obj.missedFrames >= MISSING_AFTER_FRAMES) {
        obj.state = 'missing';
      }
    }
  }
}
