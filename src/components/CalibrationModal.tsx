import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, RotateCcw, Crosshair, Sparkles, Sliders, Eye, Zap, Volume2 } from 'lucide-react';
import { IRDetector, FrameStats, ShotEvent } from '../detector/irDetector';
import { calibrationEngine, Point2D } from '../detector/calibration';
import { signalAnalyzer } from '../detector/signalAnalyzer';
import { retroSound } from '../audio/retroAudio';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  detector: IRDetector;
  onManualShotTest?: (x: number, y: number) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  detector,
}) => {
  const [activeTab, setActiveTab] = useState<'calibration' | 'signal_scope' | 'settings'>('calibration');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Live detector stats
  const [stats, setStats] = useState<FrameStats>({
    activePixels: 0,
    peakBrightness: 0,
    detectedPoint: null,
  });

  // Last test shot
  const [lastShot, setLastShot] = useState<ShotEvent | null>(null);

  // Calibration wizard state
  const [calibStep, setCalibStep] = useState<number>(0); // 0: not started, 1: TL, 2: TR, 3: BR, 4: BL, 5: completed
  const [calibPoints, setCalibPoints] = useState<{
    topLeft: Point2D | null;
    topRight: Point2D | null;
    bottomRight: Point2D | null;
    bottomLeft: Point2D | null;
  }>({
    topLeft: null,
    topRight: null,
    bottomRight: null,
    bottomLeft: null,
  });

  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const config = detector.getConfig();

  // Load cameras
  useEffect(() => {
    if (isOpen) {
      detector.getAvailableCameras().then((devices) => {
        setCameras(devices);
        if (devices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devices[0].deviceId);
        }
      });
      setIsCameraActive(detector.isCameraRunning());
    }
  }, [isOpen]);

  // Hook debug canvas and stats callback
  useEffect(() => {
    if (!isOpen) return;

    if (debugCanvasRef.current) {
      detector.setDebugCanvas(debugCanvasRef.current);
    }

    detector.setOnFrameStats((newStats) => {
      setStats(newStats);
    });

    const originalShotCallback = (shot: ShotEvent) => {
      setLastShot(shot);
      retroSound.playLaserShot();

      // If calibration wizard is currently waiting for a shot
      if (calibStep >= 1 && calibStep <= 4) {
        handleCalibShot(shot.camX, shot.camY);
      }
    };

    detector.setOnShot(originalShotCallback);

    return () => {
      detector.setDebugCanvas(null);
    };
  }, [isOpen, calibStep]);

  const handleStartCamera = async (devId?: string) => {
    const success = await detector.start(devId || selectedDeviceId);
    setIsCameraActive(success);
  };

  const handleStopCamera = () => {
    detector.stop();
    setIsCameraActive(false);
  };

  const handleCalibShot = (camX: number, camY: number) => {
    retroSound.playDuckHit();
    if (calibStep === 1) {
      setCalibPoints(p => ({ ...p, topLeft: { x: camX, y: camY } }));
      setCalibStep(2);
    } else if (calibStep === 2) {
      setCalibPoints(p => ({ ...p, topRight: { x: camX, y: camY } }));
      setCalibStep(3);
    } else if (calibStep === 3) {
      setCalibPoints(p => ({ ...p, bottomRight: { x: camX, y: camY } }));
      setCalibStep(4);
    } else if (calibStep === 4) {
      const finalPoints = {
        topLeft: calibPoints.topLeft!,
        topRight: calibPoints.topRight!,
        bottomRight: { x: camX, y: camY },
        bottomLeft: { x: camX, y: camY },
      };
      setCalibPoints(p => ({ ...p, bottomLeft: { x: camX, y: camY } }));
      calibrationEngine.saveCalibration(finalPoints);
      setCalibStep(5);
      retroSound.playRoundStart();
    }
  };

  const handleResetCalibration = () => {
    calibrationEngine.resetCalibration();
    setCalibPoints({
      topLeft: null,
      topRight: null,
      bottomRight: null,
      bottomLeft: null,
    });
    setCalibStep(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-['Rajdhani'] tracking-wide text-cyan-400 uppercase">
                Laser Tag & IR Sensor Hub
              </h2>
              <p className="text-xs text-slate-400">
                Calibrate 4-point screen tracking, optical laser color sensing & camera filters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCameraActive ? (
              <button
                onClick={handleStopCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-600/40 text-xs font-semibold hover:bg-rose-900 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> Stop Camera
              </button>
            ) : (
              <button
                onClick={() => handleStartCamera()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950"
              >
                <Camera className="w-3.5 h-3.5" /> Start Camera
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2">
          <button
            onClick={() => setActiveTab('calibration')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'calibration'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-4 h-4" /> 4-Corner Calibration
          </button>

          <button
            onClick={() => setActiveTab('signal_scope')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'signal_scope'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Optical Color Sensor
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'settings'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" /> Sensitivity & Filters
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: 4-POINT CALIBRATION */}
          {activeTab === 'calibration' && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-['Rajdhani'] font-bold text-slate-200 text-base flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                    Screen Target Homography Alignment
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aligns your laser tag blaster with your monitor so shots match where you point, regardless of camera angle.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    calibrationEngine.isCalibrated() ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}>
                    {calibrationEngine.isCalibrated() ? 'Calibrated' : 'Uncalibrated (Direct Mode)'}
                  </span>
                  <button
                    onClick={handleResetCalibration}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    title="Reset Calibration"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Wizard Target Arena */}
              <div className="relative w-full aspect-video bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                {/* Visual grid lines */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                  <div className="border-r border-cyan-500/40" />
                  <div className="border-r border-cyan-500/40" />
                  <div className="border-r border-cyan-500/40" />
                  <div />
                  <div className="border-b border-cyan-500/40 col-span-4" />
                </div>

                {calibStep === 0 && (
                  <div className="text-center p-6 space-y-4 max-w-md">
                    <div className="w-16 h-16 mx-auto rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                      <Crosshair className="w-8 h-8 animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                    <h4 className="font-['Rajdhani'] font-bold text-lg text-slate-100 uppercase">
                      Ready to Calibrate Your Laser Tag Blaster?
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      You will shoot 4 corner targets on the screen (Top-Left, Top-Right, Bottom-Right, Bottom-Left).
                      Your camera will learn your exact monitor coordinates!
                    </p>
                    <button
                      onClick={() => {
                        if (!isCameraActive) handleStartCamera();
                        setCalibStep(1);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-['Rajdhani'] text-sm tracking-wider uppercase shadow-lg shadow-cyan-950 transition-all"
                    >
                      Start 4-Corner Wizard
                    </button>
                  </div>
                )}

                {calibStep >= 1 && calibStep <= 4 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top-Left Target */}
                    <div className={`absolute top-[8%] left-[8%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
                      calibStep === 1 ? 'scale-125 animate-pulse text-rose-400' : calibPoints.topLeft ? 'text-emerald-400' : 'text-slate-600'
                    }`}>
                      <Crosshair className="w-12 h-12" />
                      <span className="text-[10px] font-bold mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                        {calibStep === 1 ? '1. SHOOT HERE!' : 'Top-Left OK'}
                      </span>
                    </div>

                    {/* Top-Right Target */}
                    <div className={`absolute top-[8%] right-[8%] translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
                      calibStep === 2 ? 'scale-125 animate-pulse text-rose-400' : calibPoints.topRight ? 'text-emerald-400' : 'text-slate-600'
                    }`}>
                      <Crosshair className="w-12 h-12" />
                      <span className="text-[10px] font-bold mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                        {calibStep === 2 ? '2. SHOOT HERE!' : 'Top-Right OK'}
                      </span>
                    </div>

                    {/* Bottom-Right Target */}
                    <div className={`absolute bottom-[8%] right-[8%] translate-x-1/2 translate-y-1/2 flex flex-col items-center ${
                      calibStep === 3 ? 'scale-125 animate-pulse text-rose-400' : calibPoints.bottomRight ? 'text-emerald-400' : 'text-slate-600'
                    }`}>
                      <Crosshair className="w-12 h-12" />
                      <span className="text-[10px] font-bold mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                        {calibStep === 3 ? '3. SHOOT HERE!' : 'Bottom-Right OK'}
                      </span>
                    </div>

                    {/* Bottom-Left Target */}
                    <div className={`absolute bottom-[8%] left-[8%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center ${
                      calibStep === 4 ? 'scale-125 animate-pulse text-rose-400' : calibPoints.bottomLeft ? 'text-emerald-400' : 'text-slate-600'
                    }`}>
                      <Crosshair className="w-12 h-12" />
                      <span className="text-[10px] font-bold mt-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
                        {calibStep === 4 ? '4. SHOOT HERE!' : 'Bottom-Left OK'}
                      </span>
                    </div>

                    {/* Center prompt */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto bg-slate-950/90 border border-slate-700 p-4 rounded-xl shadow-xl">
                      <p className="text-xs uppercase font-['Rajdhani'] font-bold text-cyan-400">
                        Step {calibStep} of 4
                      </p>
                      <p className="text-sm font-bold text-slate-100 mt-1">
                        Point laser tag blaster at highlighted target and pull trigger!
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        (Or click target directly if testing without blaster)
                      </p>
                      <button
                        onClick={() => {
                          const mockCorners = [
                            { x: 10, y: 10 },
                            { x: 90, y: 10 },
                            { x: 90, y: 90 },
                            { x: 10, y: 90 },
                          ];
                          handleCalibShot(mockCorners[calibStep - 1].x, mockCorners[calibStep - 1].y);
                        }}
                        className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-cyan-300 font-semibold"
                      >
                        Click to Simulate Hit
                      </button>
                    </div>
                  </div>
                )}

                {calibStep === 5 && (
                  <div className="text-center p-6 space-y-4 max-w-md animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 mx-auto rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="font-['Rajdhani'] font-bold text-xl text-emerald-300 uppercase">
                      Calibration Complete!
                    </h4>
                    <p className="text-xs text-slate-300">
                      Bilinear perspective transform is now locked in. Your laser shots will pinpoint ducks accurately on screen.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setCalibStep(0)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Recalibrate
                      </button>
                      <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-['Rajdhani'] text-sm uppercase tracking-wider"
                      >
                        Save & Play
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: OPTICAL SIGNAL & COLOR SENSOR */}
          {activeTab === 'signal_scope' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Debug Camera View */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-['Rajdhani'] font-bold text-sm text-slate-200 uppercase flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    Live IR / Optical Feed Mask
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Cyan spots = detected laser blast
                  </span>
                </div>

                <div className="relative aspect-[4/3] bg-black rounded-xl border-2 border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
                  <canvas
                    ref={debugCanvasRef}
                    width={320}
                    height={240}
                    className="w-full h-full object-cover block"
                  />
                  {!isCameraActive && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3">
                      <Camera className="w-10 h-10 text-slate-600" />
                      <p className="text-xs text-slate-400">Camera is currently paused</p>
                      <button
                        onClick={() => handleStartCamera()}
                        className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                      >
                        Activate Camera Feed
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Peak Frame Brightness:</span>
                  <span className="font-mono font-bold text-cyan-300">{stats.peakBrightness} / 255</span>
                </div>
              </div>

              {/* Right Column: Signal Spectrum & Color Classification */}
              <div className="space-y-4">
                <h3 className="font-['Rajdhani'] font-bold text-sm text-slate-200 uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Optical Blaster Color Signature
                </h3>

                {/* Detected Color Card */}
                <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl shadow-lg border-2 border-white/20 flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: lastShot?.signal.hex || stats.currentSignal?.hex || '#38bdf8',
                        boxShadow: `0 0 20px ${lastShot?.signal.hex || '#38bdf8'}66`,
                      }}
                    >
                      <Zap className="w-7 h-7 text-white drop-shadow" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Detected Signal Mode
                      </span>
                      <h4 className="text-lg font-bold font-['Rajdhani'] text-white">
                        {lastShot?.signal.colorName || stats.currentSignal?.colorName || 'Awaiting Laser Burst...'}
                      </h4>
                      <p className="text-xs font-mono text-slate-400">
                        {lastShot?.signal.hex || stats.currentSignal?.hex || '#38BDF8'}
                      </p>
                    </div>
                  </div>

                  {/* Optical Parameters */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Hue Spectrum</span>
                      <span className="font-bold text-slate-200">
                        {lastShot?.signal.hue ?? stats.currentSignal?.hue ?? 0}°
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Color Saturation</span>
                      <span className="font-bold text-slate-200">
                        {lastShot?.signal.saturation ?? stats.currentSignal?.saturation ?? 0}%
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Screen Aim X / Y</span>
                      <span className="font-bold text-cyan-300">
                        {lastShot ? `${lastShot.screenX}% , ${lastShot.screenY}%` : '-- , --'}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-lg">
                      <span className="text-slate-400 block text-[10px] uppercase">Blob Cluster Size</span>
                      <span className="font-bold text-slate-200">
                        {lastShot ? `${lastShot.blobSize} px` : `${stats.activePixels} px`}
                      </span>
                    </div>
                  </div>

                  {/* Test Blaster Instructions */}
                  <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-lg text-xs space-y-1 text-cyan-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      Try Pointing Any Laser Tag Blaster or TV Remote:
                    </p>
                    <p className="text-[11px] text-cyan-300/80 leading-normal">
                      Pull your laser tag blaster's trigger aimed at the webcam. The system will register the color (Red, Green, Blue, IR White) and log the hit!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SENSITIVITY & SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Camera device selection */}
              <div className="space-y-2">
                <label className="text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-slate-300">
                  Select Video Input Camera
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    if (isCameraActive) handleStartCamera(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  {cameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detection Mode */}
              <div className="space-y-2">
                <label className="text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-slate-300">
                  Detection Sensor Preset
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'ir_bright', label: 'IR / White Hot Core', desc: 'Standard laser tag guns & TV remotes' },
                    { id: 'red_laser', label: 'Red Laser / Team Red', desc: 'Visible 650nm red beams' },
                    { id: 'green_laser', label: 'Green Laser / Team Green', desc: 'Visible 532nm green beams' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => detector.setConfig({ detectionMode: preset.id as any })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        config.detectionMode === preset.id
                          ? 'border-cyan-400 bg-cyan-950/30 text-cyan-200'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold font-['Rajdhani'] text-xs text-slate-100">{preset.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Brightness Threshold</span>
                    <span className="font-mono text-cyan-400">{config.threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="160"
                    max="254"
                    value={config.threshold}
                    onChange={(e) => detector.setConfig({ threshold: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Higher = ignores ambient room lamps; lower = more sensitive to distant blaster shots.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Flash Delta Sensitivity</span>
                    <span className="font-mono text-cyan-400">{config.deltaThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={config.deltaThreshold}
                    onChange={(e) => detector.setConfig({ deltaThreshold: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Compares current frame with previous frame to eliminate static bulbs.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Shot Trigger Cooldown (Debounce)</span>
                    <span className="font-mono text-cyan-400">{config.debounceMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="400"
                    step="20"
                    value={config.debounceMs}
                    onChange={(e) => detector.setConfig({ debounceMs: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Prevents a single blaster blast burst from registering duplicate shots.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">Mirror Camera Image</span>
                    <span className="text-[10px] text-slate-400">Invert horizontal aim for selfie webcam mode</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.mirrorCamera}
                    onChange={(e) => detector.setConfig({ mirrorCamera: e.target.checked })}
                    className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            <span>Camera Status: <strong className={isCameraActive ? 'text-emerald-400' : 'text-slate-500'}>{isCameraActive ? 'Active (Scanning 60FPS)' : 'Idle'}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-['Rajdhani'] uppercase tracking-wider text-xs shadow-md transition-all"
          >
            Apply & Back to Game
          </button>
        </div>

      </div>
    </div>
  );
};
