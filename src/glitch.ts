export type StripMode = 'face-slice' | 'static' | 'color' | 'scanline' | 'pixelate' | 'vapor' | 'zoom';

const MODES: StripMode[] = ['face-slice', 'static', 'color', 'scanline', 'pixelate', 'vapor', 'zoom'];

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export class GlitchStrip {
  modeIndex = 0;
  sizeScale = 1;
  private off = document.createElement('canvas');

  get mode(): StripMode {
    return MODES[this.modeIndex];
  }

  cycleMode(): void {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
  }

  renderQuad(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    leftTop: { x: number; y: number },
    leftBottom: { x: number; y: number },
    rightTop: { x: number; y: number },
    rightBottom: { x: number; y: number },
    t: number,
    canvasW: number,
    canvasH: number,
  ): void {
    const cx = (leftTop.x + leftBottom.x + rightTop.x + rightBottom.x) / 4;
    const cy = (leftTop.y + leftBottom.y + rightTop.y + rightBottom.y) / 4;
    const s = this.sizeScale;
    const sc = (p: { x: number; y: number }) => ({
      x: (cx + (p.x - cx) * s) * canvasW,
      y: (cy + (p.y - cy) * s) * canvasH,
    });
    const lt = sc(leftTop);
    const lb = sc(leftBottom);
    const rt = sc(rightTop);
    const rb = sc(rightBottom);

    const maxLen = Math.max(dist(lt, rt), dist(lb, rb));
    const maxH = Math.max(dist(lt, lb), dist(rt, rb));
    if (maxLen < 10 || maxH < 4) return;
    const w = Math.ceil(maxLen);
    const h = Math.ceil(Math.max(maxH, 8));
    this.off.width = w;
    this.off.height = h;
    const octx = this.off.getContext('2d')!;

    if (this.mode === 'face-slice' || this.mode === 'scanline') {
      const srcH = video.videoHeight * 0.3;
      const sy = Math.max(0, Math.min(video.videoHeight - srcH, video.videoHeight * cy - srcH / 2));
      const screenLeft = Math.min(lt.x, lb.x) / canvasW;
      const screenRight = Math.max(rt.x, rb.x) / canvasW;
      const sx = video.videoWidth * (1 - screenRight);
      const sw = Math.max(1, video.videoWidth * Math.max(screenRight - screenLeft, 0.01));
      octx.save();
      octx.scale(-1, 1);
      octx.drawImage(video, sx, sy, sw, srcH, -w, 0, w, h);
      octx.restore();
      if (this.mode === 'scanline') {
        octx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = 0; y < h; y += 4) octx.fillRect(0, y, w, 2);
        octx.fillStyle = 'rgba(255,0,128,0.15)';
        for (let y = 2; y < h; y += 4) octx.fillRect(0, y, w, 1);
      }
    } else if (this.mode === 'static') {
      const img = octx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = Math.random() < 0.1 ? 255 : v * 0.6;
        img.data[i + 2] = Math.random() < 0.3 ? 255 : v;
        img.data[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
    } else if (this.mode === 'pixelate') {
      const srcH = video.videoHeight * 0.4;
      const sy = Math.max(0, Math.min(video.videoHeight - srcH, video.videoHeight * cy - srcH / 2));
      const sx = video.videoWidth * (1 - Math.max(lt.x, rt.x, rb.x, lb.x) / canvasW);
      const sw = Math.max(1, video.videoWidth * Math.min(Math.abs(rt.x - lt.x + (rb.x - lb.x)) / 2 / canvasW, 1));
      const tiny = document.createElement('canvas');
      tiny.width = Math.max(4, w >> 4);
      tiny.height = Math.max(4, h >> 4);
      const tctx = tiny.getContext('2d')!;
      tctx.scale(-1, 1);
      tctx.drawImage(video, sx, sy, sw, srcH, -tiny.width, 0, tiny.width, tiny.height);
      octx.imageSmoothingEnabled = false;
      octx.drawImage(tiny, 0, 0, w, h);
      octx.imageSmoothingEnabled = true;
    } else if (this.mode === 'vapor') {
      const g = octx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ff71ce');
      g.addColorStop(0.5, '#01cdfe');
      g.addColorStop(1, '#05ffa1');
      octx.fillStyle = g;
      octx.fillRect(0, 0, w, h);
      octx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = Math.floor(t / 8) % 8; y < h; y += 8) octx.fillRect(0, y, w, 3);
        } else if (this.mode === 'zoom') {
      const zw = video.videoWidth * 0.25;
      const zh = video.videoHeight * 0.25;
      const zx = video.videoWidth * (1 - cx) - zw / 2;
      const zy = video.videoHeight * cy - zh / 2;
      octx.save();
      octx.scale(-1, 1);
      octx.drawImage(video, Math.max(0, Math.min(video.videoWidth - zw, zx)), Math.max(0, Math.min(video.videoHeight - zh, zy)), zw, zh, -w, 0, w, h);
      octx.restore();
} else {
      octx.fillStyle = `hsl(${(t * 0.2) % 360}, 90%, 55%)`;
      octx.fillRect(0, 0, w, h);
    }

    const slices = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < slices; i++) {
      const sy = Math.random() * h;
      const sh = Math.random() * 8 + 2;
      octx.drawImage(this.off, 0, sy, w, sh, (Math.random() - 0.5) * 30, sy, w, sh);
    }

    // draw texture mapped onto quad via horizontal strip slicing
    const steps = Math.max(8, h >> 2);
    ctx.save();
    for (let i = 0; i < steps; i++) {
      const v0 = i / steps;
      const v1 = (i + 1) / steps;
      const l0 = lerp(lt, lb, v0);
      const r0 = lerp(rt, rb, v0);
      const len0 = dist(l0, r0);
      if (len0 < 1) continue;
      const ang = Math.atan2(r0.y - l0.y, r0.x - l0.x);
      const shPx = Math.max(1, (v1 - v0) * h * 1.5);
      ctx.save();
      ctx.translate(l0.x, l0.y);
      ctx.rotate(ang);
      ctx.drawImage(this.off, 0, v0 * h, w, Math.max(1, (v1 - v0) * h), 0, 0, len0, shPx);
      ctx.restore();
    }
    ctx.restore();
  }

  render(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    a: { x: number; y: number },
    b: { x: number; y: number },
    t: number,
    canvasW: number,
    canvasH: number,
  ): void {
    const ax = a.x * canvasW;
    const ay = a.y * canvasH;
    const bx = b.x * canvasW;
    const by = b.y * canvasH;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 20) return;
    const angle = Math.atan2(by - ay, bx - ax);
    const thickness = Math.max(24, Math.min(90, len * 0.22)) * this.sizeScale;
    const w = Math.ceil(len);
    const h = Math.ceil(thickness);
    this.off.width = w;
    this.off.height = h;
    const octx = this.off.getContext('2d')!;

    if (this.mode === 'face-slice' || this.mode === 'scanline') {
      const midY = (a.y + b.y) / 2;
      const srcH = video.videoHeight * 0.3;
      const sy = Math.max(0, Math.min(video.videoHeight - srcH, video.videoHeight * midY - srcH / 2));
      const screenLeft = Math.min(a.x, b.x);
      const screenW = Math.abs(b.x - a.x);
      const sx = video.videoWidth * (1 - screenLeft - screenW);
      const sw = Math.max(1, video.videoWidth * screenW);
      octx.save();
      octx.scale(-1, 1);
      octx.drawImage(video, sx, sy, sw, srcH, -w, 0, w, h);
      octx.restore();
      if (this.mode === 'scanline') {
        octx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = 0; y < h; y += 4) octx.fillRect(0, y, w, 2);
        octx.fillStyle = 'rgba(255,0,128,0.15)';
        for (let y = 2; y < h; y += 4) octx.fillRect(0, y, w, 1);
      }
    } else if (this.mode === 'static') {
      const img = octx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = Math.random() < 0.1 ? 255 : v * 0.6;
        img.data[i + 2] = Math.random() < 0.3 ? 255 : v;
        img.data[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
    } else if (this.mode === 'pixelate') {
      const midY = (a.y + b.y) / 2;
      const srcH = video.videoHeight * 0.4;
      const sy = Math.max(0, Math.min(video.videoHeight - srcH, video.videoHeight * midY - srcH / 2));
      const sx = video.videoWidth * (1 - Math.max(a.x, b.x));
      const sw = Math.max(1, video.videoWidth * Math.abs(b.x - a.x));
      octx.save();
      octx.imageSmoothingEnabled = true;
      const tiny = document.createElement('canvas');
      tiny.width = Math.max(4, w >> 4);
      tiny.height = Math.max(4, h >> 4);
      const tctx = tiny.getContext('2d')!;
      tctx.scale(-1, 1);
      tctx.drawImage(video, sx, sy, sw, srcH, -tiny.width, 0, tiny.width, tiny.height);
      octx.imageSmoothingEnabled = false;
      octx.drawImage(tiny, 0, 0, w, h);
      octx.restore();
    } else if (this.mode === 'vapor') {
      const g = octx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ff71ce');
      g.addColorStop(0.5, '#01cdfe');
      g.addColorStop(1, '#05ffa1');
      octx.fillStyle = g;
      octx.fillRect(0, 0, w, h);
      octx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = (t >> 3) % 8; y < h; y += 8) octx.fillRect(0, y, w, 3);
        } else if (this.mode === 'zoom') {
      const midY2 = (a.y + b.y) / 2;
      const zw = video.videoWidth * 0.25;
      const zh = video.videoHeight * 0.25;
      octx.save();
      octx.scale(-1, 1);
      octx.drawImage(video, video.videoWidth / 2 - zw / 2, video.videoHeight * midY2 - zh / 2, zw, zh, -w, 0, w, h);
      octx.restore();
} else {
      octx.fillStyle = `hsl(${(t * 0.2) % 360}, 90%, 55%)`;
      octx.fillRect(0, 0, w, h);
    }

    const slices = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < slices; i++) {
      const sy = Math.random() * h;
      const sh = Math.random() * 8 + 2;
      octx.drawImage(this.off, 0, sy, w, sh, (Math.random() - 0.5) * 30, sy, w, sh);
    }

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    const jitter = Math.random() < 0.15 ? (Math.random() - 0.5) * 24 : 0;
    ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.filter = 'hue-rotate(120deg) saturate(4)';
    ctx.drawImage(this.off, jitter - 4, -h / 2);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(this.off, jitter + 4, -h / 2);
    ctx.save();
    ctx.filter = 'hue-rotate(-120deg) saturate(4)';
    ctx.drawImage(this.off, jitter - 4, -h / 2);
    ctx.restore();
    ctx.drawImage(this.off, jitter, -h / 2);
    ctx.restore();
  }
}
