import { mat4, vec4 } from 'gl-matrix';
import type { DepthGrid, Detection, Mat4, Vec3 } from './types.js';

// Image coordinates are normalised (0..1) with a top-left origin. Depth is z-distance
// along the camera's view axis, which is what ARCore reports.
// TODO(device): verify image orientation and depth alignment on a real phone.

/** Pixel + depth → point in room coordinates. */
export function unproject(u: number, v: number, depthM: number, projection: Mat4, pose: Mat4): Vec3 {
  const invProj = mat4.invert(mat4.create(), projection)!;
  const near = vec4.transformMat4(vec4.create(), [u * 2 - 1, 1 - v * 2, -1, 1], invProj);
  // Point on the near plane in camera space; scale it out until z = -depth.
  const x = near[0] / near[3];
  const y = near[1] / near[3];
  const z = near[2] / near[3];
  const s = depthM / -z;
  const world = vec4.transformMat4(vec4.create(), [x * s, y * s, -depthM, 1], pose);
  return [world[0], world[1], world[2]];
}

/** Room point → pixel + depth. Null if it's behind the camera or outside the image. */
export function project(point: Vec3, projection: Mat4, pose: Mat4): { u: number; v: number; depth: number } | null {
  const view = mat4.invert(mat4.create(), pose)!;
  const cam = vec4.transformMat4(vec4.create(), [...point, 1], view);
  const depth = -cam[2];
  if (depth <= 0) return null;
  const clip = vec4.transformMat4(vec4.create(), cam, projection);
  const u = (clip[0] / clip[3] + 1) / 2;
  const v = (1 - clip[1] / clip[3]) / 2;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v, depth };
}

/** Depth in metres at a normalised pixel, or null if there's no reading. */
export function depthAt(grid: DepthGrid, u: number, v: number): number | null {
  const x = Math.min(grid.width - 1, Math.floor(u * grid.width));
  const y = Math.min(grid.height - 1, Math.floor(v * grid.height));
  const mm = grid.mm[y * grid.width + x];
  return mm > 0 ? mm / 1000 : null;
}

/**
 * Median depth inside the middle part of a box. Shrinking the box keeps us off the
 * edges, where depth often belongs to the background.
 * TODO: use SAM's mask instead of the box once we have it.
 */
export function medianDepthInBox(grid: DepthGrid, box: Detection['box'], shrink = 0.5): number | null {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hw = ((x1 - x0) * shrink) / 2;
  const hh = ((y1 - y0) * shrink) / 2;
  const values: number[] = [];
  const gx0 = Math.max(0, Math.floor((cx - hw) * grid.width));
  const gx1 = Math.min(grid.width - 1, Math.ceil((cx + hw) * grid.width));
  const gy0 = Math.max(0, Math.floor((cy - hh) * grid.height));
  const gy1 = Math.min(grid.height - 1, Math.ceil((cy + hh) * grid.height));
  for (let y = gy0; y <= gy1; y++) {
    for (let x = gx0; x <= gx1; x++) {
      const mm = grid.mm[y * grid.width + x];
      if (mm > 0) values.push(mm / 1000);
    }
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Angle in radians between the viewing directions of two poses. */
export function viewAngle(a: Mat4, b: Mat4): number {
  // Column 2 is the camera's +z axis; it looks down -z, so the sign cancels out.
  const dot = a[8] * b[8] + a[9] * b[9] + a[10] * b[10];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

export function poseTranslation(pose: Mat4): Vec3 {
  return [pose[12], pose[13], pose[14]];
}
