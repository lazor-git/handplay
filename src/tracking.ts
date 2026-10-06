import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

export interface TrackedHand {
  pinching: boolean;
  pinchDist: number;
  pinchRatio: number;
  indexTip: { x: number; y: number };
  thumbTip: { x: number; y: number };
  bbox: { x: number; y: number; w: number; h: number };
  points: { x: number; y: number }[];
  wrist: { x: number; y: number };
  extended: boolean[];
}

export class Tracker {
  private landmarker: HandLandmarker | null = null;

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks('/wasm');
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/hand_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  }

  update(video: HTMLVideoElement, t: number): TrackedHand[] {
    if (!this.landmarker || video.readyState < 2) return [];
    const r: HandLandmarkerResult = this.landmarker.detectForVideo(video, t);
    return r.landmarks.map((lm) => {
      const thumb = lm[4];
      const index = lm[8];
      const d = Math.hypot(thumb.x - index.x, thumb.y - index.y);
      const handSize = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);
      const pinchOk = d < 0.4 * Math.max(handSize, 0.01);
      const xs = lm.map((p) => p.x);
      const ys = lm.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        pinching: pinchOk,
        pinchDist: d,
        pinchRatio: d / Math.max(handSize, 0.01),
        indexTip: { x: index.x, y: index.y },
        thumbTip: { x: thumb.x, y: thumb.y },
        wrist: { x: lm[0].x, y: lm[0].y },
        extended: [lm[8], lm[12], lm[16], lm[20]].map(
          (tip) => Math.hypot(tip.x - lm[0].x, tip.y - lm[0].y) > 1.6 * handSize,
        ),
        bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        points: lm.map((p) => ({ x: p.x, y: p.y })),
      };
    });
  }
}
