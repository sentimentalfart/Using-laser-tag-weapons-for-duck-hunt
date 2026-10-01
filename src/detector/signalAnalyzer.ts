export type BlasterColor = 'red' | 'green' | 'blue' | 'yellow' | 'ir_white' | 'custom';

export interface BlasterSignal {
  color: BlasterColor;
  colorName: string;
  hex: string;
  hue: number; // 0 - 360
  saturation: number; // 0 - 100
  brightness: number; // 0 - 255
  pulseDurationMs: number;
  confidence: number;
}

export interface CustomBlasterProfile {
  name: string;
  targetHue: number;
  hueTolerance: number;
  minSaturation: number;
  hex: string;
}

export class SignalAnalyzer {
  private customProfiles: CustomBlasterProfile[] = [];

  constructor() {
    this.loadCustomProfiles();
  }

  public loadCustomProfiles() {
    try {
      const stored = localStorage.getItem('laser_custom_profiles');
      if (stored) {
        this.customProfiles = JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
  }

  public saveCustomProfile(profile: CustomBlasterProfile) {
    this.customProfiles.push(profile);
    try {
      localStorage.setItem('laser_custom_profiles', JSON.stringify(this.customProfiles));
    } catch {
      // Ignored
    }
  }

  /**
   * Convert RGB to HSV
   * r, g, b in range [0, 255]
   * returns { h: [0, 360], s: [0, 100], v: [0, 100] }
   */
  public rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;

    let h = 0;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;

    if (max !== min) {
      switch (max) {
        case rn:
          h = (gn - bn) / d + (gn < bn ? 6 : 0);
          break;
        case gn:
          h = (bn - rn) / d + 2;
          break;
        case bn:
          h = (rn - gn) / d + 4;
          break;
      }
      h = Math.round(h * 60);
    }

    return { h, s: Math.round(s), v: Math.round(v) };
  }

  /**
   * Classify the optical color signal of the laser/IR blast
   */
  public analyzeSpot(r: number, g: number, b: number, pulseDurationMs = 120): BlasterSignal {
    const { h, s, v } = this.rgbToHsv(r, g, b);
    const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Check custom saved profiles first
    for (const prof of this.customProfiles) {
      const hueDiff = Math.min(Math.abs(h - prof.targetHue), 360 - Math.abs(h - prof.targetHue));
      if (hueDiff <= prof.hueTolerance && s >= prof.minSaturation) {
        return {
          color: 'custom',
          colorName: prof.name,
          hex: prof.hex,
          hue: h,
          saturation: s,
          brightness,
          pulseDurationMs,
          confidence: 0.95,
        };
      }
    }

    // Pure intense white-hot core with low saturation: characteristic of pure IR emitters
    // CMOS sensors with IR filters turn IR light into desaturated white/light-violet
    if (s < 25 && brightness > 220) {
      return {
        color: 'ir_white',
        colorName: 'Infrared Pulse',
        hex: '#e0e7ff',
        hue: h,
        saturation: s,
        brightness,
        pulseDurationMs,
        confidence: 0.9,
      };
    }

    // Red Laser / Red Team (Hue ~ 345 - 360 or 0 - 20)
    if ((h >= 340 || h <= 22) && s > 35) {
      return {
        color: 'red',
        colorName: 'Red Laser / Team Red',
        hex: '#ef4444',
        hue: h,
        saturation: s,
        brightness,
        pulseDurationMs,
        confidence: 0.92,
      };
    }

    // Green Laser / Green Team (Hue ~ 80 - 165)
    if (h >= 75 && h <= 170 && s > 35) {
      return {
        color: 'green',
        colorName: 'Green Laser / Team Green',
        hex: '#22c55e',
        hue: h,
        saturation: s,
        brightness,
        pulseDurationMs,
        confidence: 0.94,
      };
    }

    // Yellow / Orange Laser (Hue ~ 25 - 65)
    if (h >= 25 && h <= 65 && s > 40) {
      return {
        color: 'yellow',
        colorName: 'Yellow Laser / Team Gold',
        hex: '#eab308',
        hue: h,
        saturation: s,
        brightness,
        pulseDurationMs,
        confidence: 0.88,
      };
    }

    // Blue / Violet Laser / Team Blue (Hue ~ 190 - 290)
    if (h >= 185 && h <= 290) {
      return {
        color: 'blue',
        colorName: 'Blue Laser / Team Blue',
        hex: '#3b82f6',
        hue: h,
        saturation: s,
        brightness,
        pulseDurationMs,
        confidence: 0.91,
      };
    }

    // Default fallback
    return {
      color: 'ir_white',
      colorName: 'Standard IR Blaster',
      hex: '#38bdf8',
      hue: h,
      saturation: s,
      brightness,
      pulseDurationMs,
      confidence: 0.7,
    };
  }
}

export const signalAnalyzer = new SignalAnalyzer();
