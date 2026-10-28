// Runs on the Android phone in Chrome. Starts a WebXR AR session and streams
// camera image + phone pose + depth to the laptop server over a WebSocket.
//
// UNTESTED ON A DEVICE YET. This is the first thing to get working (Oct 30).
// Things to verify on the phone: image orientation, depth alignment with the image,
// and whether `camera-access` is available.

const SEND_INTERVAL_MS = 300;
const IMAGE_WIDTH = 640; // JPEG is downscaled to this width before sending
const DEPTH_WIDTH = 160; // depth is resampled to a grid this wide, aligned with the image

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const recordBtn = document.getElementById('record');

let ws = null;
let recording = false;
let sentFrames = 0;

function setStatus(text) {
  statusEl.textContent = text;
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?role=phone`);
  ws.onopen = () => setStatus('Connected to laptop');
  ws.onclose = () => {
    setStatus('Disconnected, retrying…');
    setTimeout(connect, 1000);
  };
}
connect();

recordBtn.onclick = () => {
  recording = !recording;
  recordBtn.classList.toggle('on', recording);
  recordBtn.textContent = recording ? '■ Stop recording' : '● Record';
  ws?.send(JSON.stringify({ type: 'record', on: recording }));
};

startBtn.onclick = async () => {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-ar'))) {
    setStatus('WebXR AR is not supported here. Use Chrome on an ARCore phone, over HTTPS or a flagged origin.');
    return;
  }

  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['camera-access', 'depth-sensing'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.getElementById('overlay') },
      depthSensing: {
        usagePreference: ['cpu-optimized'],
        dataFormatPreference: ['luminance-alpha', 'float32'],
      },
    });
  } catch (err) {
    setStatus(`Could not start AR: ${err.message}`);
    return;
  }

  startBtn.disabled = true;
  recordBtn.disabled = false;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { xrCompatible: true });
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  const glBinding = new XRWebGLBinding(session, gl);
  const refSpace = await session.requestReferenceSpace('local');
  const readFramebuffer = gl.createFramebuffer();

  let lastSent = 0;
  let seq = 0;

  session.addEventListener('end', () => {
    startBtn.disabled = false;
    recordBtn.disabled = true;
    setStatus('AR session ended');
  });

  session.requestAnimationFrame(function onFrame(time, frame) {
    session.requestAnimationFrame(onFrame);

    const baseLayer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pose = frame.getViewerPose(refSpace);
    if (!pose) return;
    if (time - lastSent < SEND_INTERVAL_MS) return;
    // Skip if the network is backed up rather than queueing stale frames.
    if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 1_000_000) return;

    const view = pose.views[0];
    if (!view.camera) return;
    lastSent = time;

    // The camera texture is only valid inside this callback, so read it now.
    const image = readCameraImage(gl, glBinding, view.camera, readFramebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
    const depth = readDepthGrid(frame, view, view.camera.width / view.camera.height);

    ws.send(
      JSON.stringify({
        type: 'frame',
        seq: seq++,
        t: Date.now(),
        image: image.base64,
        imageWidth: image.width,
        imageHeight: image.height,
        pose: Array.from(view.transform.matrix),
        projection: Array.from(view.projectionMatrix),
        depth,
      }),
    );
    sentFrames++;
    setStatus(`Streaming · ${sentFrames} frames${recording ? ' · RECORDING' : ''}${depth ? '' : ' · no depth yet'}`);
  });
};

/** Reads the camera texture into a downscaled JPEG (base64, no data: prefix). */
function readCameraImage(gl, glBinding, camera, framebuffer) {
  const texture = glBinding.getCameraImage(camera);
  const w = camera.width;
  const h = camera.height;

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const pixels = new Uint8ClampedArray(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const full = new OffscreenCanvas(w, h);
  full.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);

  // readPixels returns rows bottom-up, so flip vertically while scaling down.
  const outW = Math.min(IMAGE_WIDTH, w);
  const outH = Math.round((h * outW) / w);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  ctx.translate(0, outH);
  ctx.scale(1, -1);
  ctx.drawImage(full, 0, 0, outW, outH);

  const base64 = out.toDataURL('image/jpeg', 0.7).split(',')[1];
  return { base64, width: outW, height: outH };
}

/**
 * Resamples depth onto a grid aligned with the camera image (top-left origin), in millimetres.
 * getDepthInMeters takes normalised view coordinates, so the server never has to deal with
 * the depth buffer's own transform.
 */
function readDepthGrid(frame, view, aspect) {
  const info = frame.getDepthInformation(view);
  if (!info) return null;
  const width = DEPTH_WIDTH;
  const height = Math.round(DEPTH_WIDTH / aspect);
  const mm = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const meters = info.getDepthInMeters((x + 0.5) / width, (y + 0.5) / height);
      mm[y * width + x] = Math.min(65535, Math.round(meters * 1000));
    }
  }
  return { width, height, mm: toBase64(mm.buffer) };
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
