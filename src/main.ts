import './style.css';
import { startCamera } from './camera';
import { Tracker, type TrackedHand } from './tracking';
import { GlitchStrip } from './glitch';

const video = document.getElementById('cam') as HTMLVideoElement;
const canvas = document.getElementById('overlay') as HTMLCanvasElement;
const status = document.getElementById('status') as HTMLSpanElement;
const modeBtn = document.getElementById('modeBtn') as HTMLButtonElement;
const hitboxBtn = document.getElementById('hitboxBtn') as HTMLButtonElement;
const gestBtn = document.getElementById('gestBtn') as HTMLButtonElement;
let gesturesOn = true;

gestBtn.addEventListener('click', () => {
  gesturesOn = !gesturesOn;
  gestBtn.textContent = `gestures: ${gesturesOn ? 'on' : 'off'}`;
});
const sizeSlider = document.getElementById('sizeSlider') as HTMLInputElement;
const drawBtn = document.getElementById('drawBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const shotBtn = document.getElementById('shotBtn') as HTMLButtonElement;
const bonesBtn = document.getElementById('bonesBtn') as HTMLButtonElement;
const drawCanvas = document.getElementById('drawlayer') as HTMLCanvasElement;
let showHitboxes = true;
let showBones = true;
let drawMode = false;

drawBtn.addEventListener('click', () => {
  drawMode = !drawMode;
  drawBtn.textContent = `draw: ${drawMode ? 'on' : 'off'}`;
});

clearBtn.addEventListener('click', () => {
  drawCanvas.getContext('2d')!.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
});

shotBtn.addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const cx2 = c.getContext('2d')!;
  cx2.save();
  cx2.scale(-1, 1);
  cx2.drawImage(video, -c.width, 0, c.width, c.height);
  cx2.restore();
  cx2.drawImage(canvas, 0, 0);
  cx2.drawImage(drawCanvas, 0, 0);
  const a = document.createElement('a');
  a.download = `handplay-${Date.now()}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
  status.textContent = 'saved screenshot';
});

bonesBtn.addEventListener('click', () => {
  showBones = !showBones;
  bonesBtn.textContent = `bones: ${showBones ? 'on' : 'off'}`;
});

const tracker = new Tracker();
const strip = new GlitchStrip();

modeBtn.addEventListener('click', () => {
  strip.cycleMode();
  modeBtn.textContent = `mode: ${strip.mode}`;
});

hitboxBtn.addEventListener('click', () => {
  showHitboxes = !showHitboxes;
  hitboxBtn.textContent = `hitboxes: ${showHitboxes ? 'on' : 'off'}`;
});

sizeSlider.addEventListener('input', () => {
  strip.sizeScale = parseFloat(sizeSlider.value);
});

const startScreen = document.getElementById('startScreen') as HTMLDivElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;

async function boot(): Promise<void> {
  try {
    status.textContent = 'camera…';
    await startCamera(video);
    status.textContent = 'model…';
    await tracker.init();
    status.textContent = 'show both hands, pinch';
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    drawCanvas.width = video.videoWidth;
    drawCanvas.height = video.videoHeight;
    startScreen.style.display = 'none';
    requestAnimationFrame(loop);
  } catch (e) {
    status.textContent = `error: ${e instanceof Error ? e.message : String(e)}`;
    startBtn.textContent = 'RETRY';
    startScreen.style.display = 'flex';
  }
}

startBtn.addEventListener('click', () => {
  startScreen.style.display = 'none';

});

const t0 = performance.now();

function loop(): void {
  try {
    step();
  } catch (e) {
    status.textContent = `err: ${e}`;
    console.error(e);
  }
  requestAnimationFrame(loop);
}

function step(): void {
  const now = performance.now();
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hands = tracker.update(video, now);
  handleGestures(hands, now);
  if (drawMode) {
    const dctx = drawCanvas.getContext('2d')!;
    hands.forEach((h, hi) => {
      if (h.pinching && h.pinchRatio < 0.3) {
        const px = (1 - h.indexTip.x) * drawCanvas.width;
        const py = h.indexTip.y * drawCanvas.height;
        const last = lastDraw.get(hi);
        dctx.strokeStyle = `hsl(${(now / 10) % 360}, 90%, 60%)`;
        dctx.lineWidth = 4 + (1 - Math.min(1, h.pinchRatio)) * 10;
        dctx.lineCap = 'round';
        dctx.beginPath();
        if (last) {
          dctx.moveTo(last.x, last.y);
          dctx.lineTo(px, py);
        } else {
          dctx.moveTo(px, py);
          dctx.lineTo(px + 0.1, py + 0.1);
        }
        dctx.stroke();
        lastDraw.set(hi, { x: px, y: py });
        status.textContent = 'drawing — pinch to draw, open hand to lift pen';
      } else {
        lastDraw.delete(hi);
      }
    });
  } else {
    lastDraw.clear();
  }
  if (hands.length >= 2 && !drawMode) {
    const h0 = hands[0];
    const h1 = hands[1];
    const targets = [
      { x: 1 - h0.indexTip.x, y: h0.indexTip.y },
      { x: 1 - h0.thumbTip.x, y: h0.thumbTip.y },
      { x: 1 - h1.indexTip.x, y: h1.indexTip.y },
      { x: 1 - h1.thumbTip.x, y: h1.thumbTip.y },
    ];
    if (Number.isNaN(smoothPts[0].x)) {
      smoothPts.forEach((p, i) => {
        p.x = targets[i].x;
        p.y = targets[i].y;
      });
    }
    smoothPts.forEach((p, i) => {
      p.x += (targets[i].x - p.x) * 0.35;
      p.y += (targets[i].y - p.y) * 0.35;
    });
    strip.renderQuad(
      ctx,
      video,
      smoothPts[0],
      smoothPts[1],
      smoothPts[2],
      smoothPts[3],
      now - t0,
      canvas.width,
      canvas.height,
    );
    status.textContent = 'quad active — spread fingers / hands to resize';
  } else if (!drawMode) {
    smoothPts.forEach((p) => {
      p.x = NaN;
      p.y = NaN;
    });
    status.textContent = 'show both hands';
  }
  updateTrails(ctx, drawMode ? [] : hands);
  tryThrow(hands, now, ctx);
  if (hands.length >= 2 && !drawMode) {
    ctx.save();
    ctx.strokeStyle = `hsla(${(now / 10) % 360}, 100%, 60%, 0.9)`;
    ctx.lineWidth = 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(smoothPts[0].x * canvas.width, smoothPts[0].y * canvas.height);
    smoothPts.slice(1).forEach((p) => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  drawDebug(ctx, hands);
}

let lastGestureAt = 0;
let lastGesture = '';

let gestureCandidate = '';
let gestureFrames = 0;

function handleGestures(hands: TrackedHand[], now: number): void {
  if (!gesturesOn || drawMode) {
    gestureCandidate = '';
    gestureFrames = 0;
    return;
  }
  if (hands.length === 0 || now - lastGestureAt < 1500) return;
  const ex = hands[0].extended;
  const open = ex.every(Boolean);
  const fist = ex.every((e) => !e);
  const peace = ex[0] && ex[1] && !ex[2] && !ex[3];
  const point = ex[0] && !ex[1] && !ex[2] && !ex[3];
  let gesture = '';
  if (fist) gesture = 'fist';
  else if (peace) gesture = 'peace';
  else if (open) gesture = 'open';
  else if (point) gesture = 'point';
  if (!gesture) {
    lastGesture = '';
    gestureFrames = 0;
    return;
  }
  if (gesture && gesture === gestureCandidate) {
    gestureFrames++;
  } else {
    gestureCandidate = gesture;
    gestureFrames = 1;
  }
  if (gestureFrames < 25 || gesture === lastGesture) return;
  lastGesture = gesture;
  lastGestureAt = now;
  gestureFrames = 0;
  if (gesture === 'fist') {
    drawCanvas.getContext('2d')!.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    status.textContent = 'gesture: fist — cleared';
  } else if (gesture === 'peace') {
    strip.cycleMode();
    modeBtn.textContent = `mode: ${strip.mode}`;
    status.textContent = `gesture: peace — vfx: ${strip.mode}`;
  } else if (gesture === 'open') {
    drawMode = !drawMode;
    drawBtn.textContent = `draw: ${drawMode ? 'on' : 'off'}`;
    status.textContent = `gesture: open — draw ${drawMode ? 'on' : 'off'}`;
  } else if (gesture === 'point') {
    showHitboxes = !showHitboxes;
    hitboxBtn.textContent = `hitboxes: ${showHitboxes ? 'on' : 'off'}`;
    status.textContent = `gesture: point — hitboxes ${showHitboxes ? 'on' : 'off'}`;
  }
}

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const lastDraw = new Map<number, { x: number; y: number }>();
const trailBufs = new Map<string, { x: number; y: number }[]>();
const lastWrist = new Map<number, { x: number; y: number; t: number }>();
let fly: {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
} | null = null;

function tryThrow(hands: TrackedHand[], now: number, ctx: CanvasRenderingContext2D): void {
  hands.forEach((h, hi) => {
    const last = lastWrist.get(hi);
    lastWrist.set(hi, { x: h.wrist.x, y: h.wrist.y, t: now });
    if (!last) return;
    const dt = Math.max(1, now - last.t);
    const speed = Math.hypot(h.wrist.x - last.x, h.wrist.y - last.y) / (dt / 16);
    const closed = h.extended.every((e) => !e);
    if (closed && speed > 0.05 && !fly) {
      const img = document.createElement('canvas');
      img.width = drawCanvas.width;
      img.height = drawCanvas.height;
      img.getContext('2d')!.drawImage(drawCanvas, 0, 0);
      fly = {
        img,
        x: drawCanvas.width / 2,
        y: drawCanvas.height / 2,
        vx: (last.x - h.wrist.x) * (drawCanvas.width / (dt / 16)) * 1.2,
        vy: (h.wrist.y - last.y) * (drawCanvas.height / (dt / 16)) * 1.2,
        rot: 0,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
      };
      const dctx = drawCanvas.getContext('2d')!;
      dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      status.textContent = 'YEET — drawing thrown';
    }
  });
  if (fly) {
    fly.x += fly.vx;
    fly.y += fly.vy;
    fly.vy += 0.4;
    fly.rot += fly.vr;
    fly.life -= 0.02;
    if (fly.life <= 0) {
      fly = null;
    } else {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fly.life);
      ctx.translate(fly.x, fly.y);
      ctx.rotate(fly.rot);
      ctx.drawImage(fly.img, -fly.img.width / 4, -fly.img.height / 4, fly.img.width / 2, fly.img.height / 2);
      ctx.restore();
    }
  }
}

function updateTrails(ctx: CanvasRenderingContext2D, hands: TrackedHand[]): void {
  const seen = new Set<string>();
  hands.forEach((h, hi) => {
    const tipIdx = [8, 12, 16, 20];
    h.extended.forEach((ext, fi) => {
      if (!ext) return;
      const key = `${hi}-${fi}`;
      seen.add(key);
      const p = h.points[tipIdx[fi]];
      const sx = (1 - p.x) * ctx.canvas.width;
      const sy = p.y * ctx.canvas.height;
      let buf = trailBufs.get(key);
      if (!buf) {
        buf = [];
        trailBufs.set(key, buf);
      }
      const last = buf[buf.length - 1];
      if (!last || Math.hypot(last.x - sx, last.y - sy) > 2) {
        buf.push({ x: sx, y: sy });
        if (buf.length > 24) buf.shift();
      }
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < buf.length; i++) {
        const a = buf[i - 1];
        const b = buf[i];
        ctx.strokeStyle = `hsla(${(performance.now() / 8 + fi * 90) % 360}, 100%, 60%, ${i / buf.length})`;
        ctx.lineWidth = 2 + (i / buf.length) * 8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    });
  });
  for (const key of trailBufs.keys()) {
    if (!seen.has(key)) trailBufs.delete(key);
  }
}

const smoothPts = [{ x: NaN, y: NaN }, { x: NaN, y: NaN }, { x: NaN, y: NaN }, { x: NaN, y: NaN }];

function drawDebug(ctx: CanvasRenderingContext2D, hands: TrackedHand[]): void {
  ctx.save();
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = hands.length >= 2 ? '#0f0' : hands.length === 1 ? '#ff0' : '#f00';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  const line = `hands: ${hands.length}  pinching: ${hands.filter((h) => h.pinching).length}  dist: ${hands.map((h) => h.pinchDist.toFixed(2)).join('/')}`;
  ctx.strokeText(line, 20, 50);
  ctx.fillText(line, 20, 50);
  hands.forEach((h, i) => {
    if (showHitboxes) {
      const bx2 = (1 - (h.bbox.x + h.bbox.w)) * ctx.canvas.width;
      const by2 = h.bbox.y * ctx.canvas.height;
      ctx.strokeStyle = h.pinching ? '#0f0' : '#f0f';
      ctx.lineWidth = 3;
      ctx.strokeRect(bx2, by2, h.bbox.w * ctx.canvas.width, h.bbox.h * ctx.canvas.height);
      h.points.forEach((p) => {
        ctx.beginPath();
        ctx.arc((1 - p.x) * ctx.canvas.width, p.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#0ff';
        ctx.fill();
      });
    }
    if (showBones) {
      ctx.strokeStyle = 'rgba(255,255,0,0.8)';
      ctx.lineWidth = 2;
      BONES.forEach(([a, b]) => {
        const pa = h.points[a];
        const pb = h.points[b];
        ctx.beginPath();
        ctx.moveTo((1 - pa.x) * ctx.canvas.width, pa.y * ctx.canvas.height);
        ctx.lineTo((1 - pb.x) * ctx.canvas.width, pb.y * ctx.canvas.height);
        ctx.stroke();
      });
    }
    const x = (1 - h.indexTip.x) * ctx.canvas.width;
    const y = h.indexTip.y * ctx.canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    ctx.fillStyle = h.pinching ? '#0f0' : '#f00';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.strokeText(String(i), x + 16, y);
    ctx.fillText(String(i), x + 16, y);
  });
  ctx.restore();
}

boot();
