export interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationTarget {
  name: string;
  screenPos: Point2D; // percentage 0-100
  cameraPos: Point2D | null;
}

export interface CalibrationData {
  isCalibrated: boolean;
  points: {
    topLeft: Point2D;
    topRight: Point2D;
    bottomRight: Point2D;
    bottomLeft: Point2D;
  };
  screenBounds: {
    topLeft: Point2D;
    topRight: Point2D;
    bottomRight: Point2D;
    bottomLeft: Point2D;
  };
}

const STORAGE_KEY = 'laser_duck_hunt_calibration';

export class CalibrationEngine {
  private data: CalibrationData = {
    isCalibrated: false,
    points: {
      topLeft: { x: 10, y: 10 },
      topRight: { x: 90, y: 10 },
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 10, y: 90 },
    },
    screenBounds: {
      topLeft: { x: 10, y: 10 },
      topRight: { x: 90, y: 10 },
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 10, y: 90 },
    },
  };

  // Smoothing filter
  private lastSmoothed: Point2D | null = null;
  private smoothingFactor = 0.25; // 0 = no smoothing (fastest), 0.8 = heavy smoothing

  constructor() {
    this.loadCalibration();
  }

  public loadCalibration() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
      }
    } catch {
      // Default
    }
  }

  public saveCalibration(points: CalibrationData['points']) {
    this.data.isCalibrated = true;
    this.data.points = points;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignored
    }
  }

  public resetCalibration() {
    this.data.isCalibrated = false;
    this.data.points = {
      topLeft: { x: 10, y: 10 },
      topRight: { x: 90, y: 10 },
      bottomRight: { x: 90, y: 90 },
      bottomLeft: { x: 10, y: 90 },
    };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignored
    }
  }

  public isCalibrated(): boolean {
    return this.data.isCalibrated;
  }

  public getCalibrationData(): CalibrationData {
    return { ...this.data };
  }

  /**
   * Bilinear perspective mapping:
   * Maps camera point (cx, cy) to screen point (sx, sy) in [0, 100]% range
   */
  public mapCameraToScreen(cam: Point2D): Point2D {
    if (!this.data.isCalibrated) {
      // Uncalibrated fallback: 1-to-1 normalized direct mapping
      return this.applySmoothing(cam);
    }

    const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = this.data.points;

    // Estimate horizontal parameter u in [0, 1]
    const topWidth = Math.max(1, p1.x - p0.x);
    const bottomWidth = Math.max(1, p2.x - p3.x);
    const uTop = (cam.x - p0.x) / topWidth;
    const uBottom = (cam.x - p3.x) / bottomWidth;

    // Estimate vertical parameter v in [0, 1]
    const leftHeight = Math.max(1, p3.y - p0.y);
    const rightHeight = Math.max(1, p2.y - p1.y);
    const vLeft = (cam.y - p0.y) / leftHeight;
    const vRight = (cam.y - p1.y) / rightHeight;

    const u = Math.min(1.15, Math.max(-0.15, (uTop + uBottom) / 2));
    const v = Math.min(1.15, Math.max(-0.15, (vLeft + vRight) / 2));

    // Map to screen target bounds
    const s0 = this.data.screenBounds.topLeft;
    const s1 = this.data.screenBounds.topRight;
    const s2 = this.data.screenBounds.bottomRight;
    const s3 = this.data.screenBounds.bottomLeft;

    const screenX = (1 - u) * (1 - v) * s0.x + u * (1 - v) * s1.x + u * v * s2.x + (1 - u) * v * s3.x;
    const screenY = (1 - u) * (1 - v) * s0.y + u * (1 - v) * s1.y + u * v * s2.y + (1 - u) * v * s3.y;

    const clamped: Point2D = {
      x: Math.max(0, Math.min(100, Math.round(screenX * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round(screenY * 10) / 10)),
    };

    return this.applySmoothing(clamped);
  }

  private applySmoothing(point: Point2D): Point2D {
    if (!this.lastSmoothed) {
      this.lastSmoothed = point;
      return point;
    }

    // Distance threshold: if shot was fired fast or jumped far, do NOT lag with smoothing
    const dist = Math.hypot(point.x - this.lastSmoothed.x, point.y - this.lastSmoothed.y);
    if (dist > 15) {
      // Instant snap shot, no lag
      this.lastSmoothed = point;
      return point;
    }

    const smoothed: Point2D = {
      x: this.lastSmoothed.x + (point.x - this.lastSmoothed.x) * (1 - this.smoothingFactor),
      y: this.lastSmoothed.y + (point.y - this.lastSmoothed.y) * (1 - this.smoothingFactor),
    };

    this.lastSmoothed = smoothed;
    return smoothed;
  }
}

export const calibrationEngine = new CalibrationEngine();
