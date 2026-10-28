/** 4x4 matrix, 16 numbers, column-major (WebXR and gl-matrix layout). */
export type Mat4 = number[];
export type Vec3 = [number, number, number];

/** Depth resampled on the phone so it lines up with the camera image. */
export interface DepthGrid {
  width: number;
  height: number;
  /** Depth in millimetres, row-major, top-left origin. 0 = no reading. */
  mm: Uint16Array;
}

/** One decoded frame from the phone. */
export interface Frame {
  seq: number;
  /** Phone clock, ms since epoch. */
  t: number;
  /** JPEG bytes. */
  image: Buffer;
  imageWidth: number;
  imageHeight: number;
  /** Camera-to-world transform (XRView.transform.matrix). Metres, y up. */
  pose: Mat4;
  /** XRView.projectionMatrix. */
  projection: Mat4;
  depth: DepthGrid | null;
}

/** Wire format the phone sends. Recordings store these lines verbatim. */
export interface FrameMessage {
  type: 'frame';
  seq: number;
  t: number;
  /** Base64 JPEG. */
  image: string;
  imageWidth: number;
  imageHeight: number;
  pose: Mat4;
  projection: Mat4;
  /** `mm` is a base64 Uint16Array. */
  depth: { width: number; height: number; mm: string } | null;
}

export interface RecordMessage {
  type: 'record';
  on: boolean;
}

export type PhoneMessage = FrameMessage | RecordMessage;

/** One object SAM found in one image. */
export interface Detection {
  label: string;
  score: number;
  /** Normalised [x0, y0, x1, y1], top-left origin. */
  box: [number, number, number, number];
  // TODO: add the mask once we know the SAM 3.1 API response shape
}

/** A detection placed in room coordinates. */
export interface Observation {
  label: string;
  score: number;
  position: Vec3;
  box: Detection['box'];
  fingerprint?: number[];
}

export type ObjectState = 'visible' | 'occluded' | 'missing';

export interface MemoryObject {
  id: string;
  /** SAM prompt that found it, e.g. "cardboard box". */
  label: string;
  /** Human-readable name from the LLM, filled in once. */
  name?: string;
  position: Vec3;
  state: ObjectState;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  /** Keyframes in a row where the object should have been visible but wasn't. */
  missedFrames: number;
  fingerprint?: number[];
}

/** What the server pushes to the 3D viewer. */
export interface SceneMessage {
  type: 'scene';
  t: number;
  camera: Mat4 | null;
  objects: Omit<MemoryObject, 'fingerprint'>[];
}
