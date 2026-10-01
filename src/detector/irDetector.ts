import { IRDetectionConfig } from '../types/game';
import { signalAnalyzer, BlasterSignal } from './signalAnalyzer';
import { calibrationEngine, Point2D } from './calibration';

export interface ShotEvent {
  screenX: number; // 0-100% (calibrated screen coordinate)
  screenY: number; // 0-100%
  camX: number; // Raw camera X
  camY: number; // Raw camera Y
  blobSize: number;
  signal: BlasterSignal;
  timestamp: number;
}

export interface FrameStats {
  activePixels: number;
  peakBrightness: number;
  detectedPoint: Point2D | null;
  currentSignal?: BlasterSignal;
}

export class IRDetector {
  private video: HTMLVideoElement | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private debugCanvas: HTMLCanvasElement | null = null;
  private debugCtx: CanvasRenderingContext2D | null = null;

  private stream: MediaStream | null = null;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  private prevFrameData: Uint8ClampedArray | null = null;
  private lastTriggerTime: number = 0;

  private config: IRDetectionConfig = {
    threshold: 230,
    minBlobSize: 2,
    maxBlobSize: 260,
    deltaDetection: true,
    deltaThreshold: 40,
    detectionMode: 'ir_bright',
    mirrorCamera: true,
    debounceMs: 160,
    showMaskOverlay: true,
  };

  private onShotCallback: ((event: ShotEvent) => void) | null = null;
  private onFrameStatsCallback: ((stats: FrameStats) => void) | null = null;

  constructor(config?: Partial<IRDetectionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public setConfig(newConfig: Partial<IRDetectionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): IRDetectionConfig {
    return { ...this.config };
  }

  public setOnShot(callback: (event: ShotEvent) => void) {
    this.onShotCallback = callback;
  }

  public setOnFrameStats(callback: (stats: FrameStats) => void) {
    this.onFrameStatsCallback = callback;
  }

  public setDebugCanvas(canvas: HTMLCanvasElement | null) {
    this.debugCanvas = canvas;
    if (canvas) {
      this.debugCtx = canvas.getContext('2d');
    } else {
      this.debugCtx = null;
    }
  }

  public async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  public async start(deviceId?: string): Promise<boolean> {
    try {
      this.stop();

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.muted = true;

      await this.video.play();

      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 320;
      this.offscreenCanvas.height = 240;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

      this.isRunning = true;
      this.prevFrameData = null;
      this.processFrame();

      return true;
    } catch (err) {
      console.error('Failed to start camera:', err);
      return false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.prevFrameData = null;
  }

  public isCameraRunning(): boolean {
    return this.isRunning;
  }

  private processFrame = () => {
    if (!this.isRunning || !this.video || !this.offscreenCanvas || !this.offscreenCtx) {
      return;
    }

    const width = this.offscreenCanvas.width;
    const height = this.offscreenCanvas.height;

    // Capture current video frame
    this.offscreenCtx.drawImage(this.video, 0, 0, width, height);
    const frame = this.offscreenCtx.getImageData(0, 0, width, height);
    const data = frame.data;

    let peakBrightness = 0;
    let weightedSumX = 0;
    let weightedSumY = 0;
    let totalWeight = 0;
    let count = 0;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    const prevData = this.prevFrameData;
    const threshold = this.config.threshold;
    const deltaMode = this.config.deltaDetection && prevData !== null;
    const deltaThresh = this.config.deltaThreshold;

    let debugImageData: ImageData | null = null;
    if (this.debugCanvas && this.debugCtx) {
      debugImageData = this.debugCtx.createImageData(width, height);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > peakBrightness) peakBrightness = lum;

        let isMatch = false;

        // Check if pixel exceeds threshold (or specific color mode)
        if (this.config.detectionMode === 'ir_bright') {
          isMatch = lum >= threshold;
        } else if (this.config.detectionMode === 'red_laser') {
          isMatch = r >= threshold && r > g * 1.35 && r > b * 1.35;
        } else if (this.config.detectionMode === 'green_laser') {
          isMatch = g >= threshold && g > r * 1.3 && g > b * 1.3;
        }

        // Adaptive frame delta check to ignore ambient static room lights
        if (isMatch && deltaMode && prevData) {
          const prevLum = 0.299 * prevData[i] + 0.587 * prevData[i + 1] + 0.114 * prevData[i + 2];
          const delta = lum - prevLum;
          if (delta < deltaThresh) {
            isMatch = false;
          }
        }

        if (debugImageData) {
          if (isMatch) {
            // Neon cyan spot indicator
            debugImageData.data[i] = 0;
            debugImageData.data[i + 1] = 255;
            debugImageData.data[i + 2] = 255;
            debugImageData.data[i + 3] = 255;
          } else {
            // Grayscale camera preview
            const dimLum = lum * 0.45;
            debugImageData.data[i] = dimLum;
            debugImageData.data[i + 1] = dimLum;
            debugImageData.data[i + 2] = dimLum;
            debugImageData.data[i + 3] = 255;
          }
        }

        if (isMatch) {
          // Weighted centroid: brighter pixels contribute more (sub-pixel precision)
          const weight = Math.max(1, lum - threshold + 10);
          weightedSumX += x * weight;
          weightedSumY += y * weight;
          totalWeight += weight;

          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }
      }
    }

    this.prevFrameData = new Uint8ClampedArray(data);

    let rawCamPoint: Point2D | null = null;
    let screenPoint: Point2D | null = null;
    let signal: BlasterSignal | undefined;

    const now = Date.now();

    if (count >= this.config.minBlobSize && count <= this.config.maxBlobSize && totalWeight > 0) {
      const avgX = weightedSumX / totalWeight;
      const avgY = weightedSumY / totalWeight;

      let normCamX = (avgX / width) * 100;
      if (this.config.mirrorCamera) {
        normCamX = 100 - normCamX;
      }
      const normCamY = (avgY / height) * 100;

      rawCamPoint = {
        x: Math.round(normCamX * 10) / 10,
        y: Math.round(normCamY * 10) / 10,
      };

      // Analyze optical signal (color, hue, saturation, laser tag team)
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      signal = signalAnalyzer.analyzeSpot(avgR, avgG, avgB);

      // Perform 4-point calibration perspective mapping to screen space!
      screenPoint = calibrationEngine.mapCameraToScreen(rawCamPoint);

      // Check debounce timing
      if (now - this.lastTriggerTime >= this.config.debounceMs) {
        this.lastTriggerTime = now;
        if (this.onShotCallback && signal) {
          this.onShotCallback({
            screenX: screenPoint.x,
            screenY: screenPoint.y,
            camX: rawCamPoint.x,
            camY: rawCamPoint.y,
            blobSize: count,
            signal,
            timestamp: now,
          });
        }
      }
    }

    // Render debug canvas if open
    if (this.debugCanvas && this.debugCtx && debugImageData) {
      this.debugCtx.putImageData(debugImageData, 0, 0);

      if (rawCamPoint) {
        const dX = this.config.mirrorCamera ? width - (rawCamPoint.x / 100) * width : (rawCamPoint.x / 100) * width;
        const dY = (rawCamPoint.y / 100) * height;

        this.debugCtx.strokeStyle = signal ? signal.hex : '#22c55e';
        this.debugCtx.lineWidth = 2;
        this.debugCtx.beginPath();
        this.debugCtx.arc(dX, dY, 14, 0, Math.PI * 2);
        this.debugCtx.moveTo(dX - 18, dY);
        this.debugCtx.lineTo(dX + 18, dY);
        this.debugCtx.moveTo(dX, dY - 18);
        this.debugCtx.lineTo(dX, dY + 18);
        this.debugCtx.stroke();
      }
    }

    if (this.onFrameStatsCallback) {
      this.onFrameStatsCallback({
        activePixels: count,
        peakBrightness: Math.round(peakBrightness),
        detectedPoint: screenPoint || rawCamPoint,
        currentSignal: signal,
      });
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };
}
