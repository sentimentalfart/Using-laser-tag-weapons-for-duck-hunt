import React, { useState } from 'react';
import { Download, Code, Globe, Check, Copy, ExternalLink, Sparkles, Terminal, FileCode, Server } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, appUrl }) => {
  const [activeTab, setActiveTab] = useState<'standalone' | 'embed' | 'build_guide'>('standalone');
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : appUrl;
  const embedCode = `<iframe 
  src="${currentOrigin}" 
  width="100%" 
  height="780" 
  style="border: none; border-radius: 16px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);"
  allow="camera; microphone; fullscreen"
  loading="lazy"
  title="Laser Tag Duck Hunt Game">
</iframe>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(`npm run build\n# dist/ folder is ready to deploy!`);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  // Generate and download standalone offline HTML package
  const handleDownloadStandalone = () => {
    setIsGenerating(true);

    try {
      const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laser Tag Duck Hunt - Standalone Game</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body { background: #020617; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }
    header { background: #0f172a; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; }
    h1 { font-size: 1.1rem; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; }
    .badge { background: #0369a1; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; }
    #game-container { flex: 1; position: relative; background: #000; overflow: hidden; cursor: crosshair; }
    canvas { width: 100%; height: 100%; display: block; }
    #hud { position: absolute; bottom: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; pointer-events: none; }
    .hud-box { background: rgba(15, 23, 42, 0.85); border: 2px solid #38bdf8; border-radius: 10px; padding: 10px 18px; font-weight: bold; }
    .score-val { color: #fbbf24; font-size: 1.4rem; font-family: monospace; }
    #cam-status { position: absolute; top: 15px; left: 15px; background: rgba(15, 23, 42, 0.85); border: 1px solid #334155; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; }
    button.btn { background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    button.btn:hover { background: #0369a1; }
  </style>
</head>
<body>
  <header>
    <h1>🦆 Laser Tag Duck Hunt (Standalone)</h1>
    <div style="display: flex; gap: 10px; align-items: center;">
      <button class="btn" id="start-cam-btn">📷 Start Camera IR Sensor</button>
      <span class="badge">Offline Bundle</span>
    </div>
  </header>
  <div id="game-container">
    <div id="cam-status"><span class="dot"></span> <span>Click screen or shoot with IR Laser Tag</span></div>
    <canvas id="gameCanvas"></canvas>
    <div id="hud">
      <div class="hud-box">SCORE: <span id="score" class="score-val">000000</span></div>
      <div class="hud-box">DUCKS SHOT: <span id="hits" style="color: #4ade80;">0</span></div>
      <div class="hud-box">SIGNAL: <span id="sig-color" style="color: #38bdf8;">IR DETECTOR READY</span></div>
    </div>
  </div>
  <script>
    // Web Audio Synthesizer
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let actx = null;
    function playLaser() {
      if (!actx) actx = new AudioCtx();
      const t = actx.currentTime;
      const osc = actx.createOscillator();
      const g = actx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(g); g.connect(actx.destination);
      osc.start(t); osc.stop(t + 0.15);
    }
    function playHit() {
      if (!actx) actx = new AudioCtx();
      const t = actx.currentTime;
      const osc = actx.createOscillator();
      const g = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(g); g.connect(actx.destination);
      osc.start(t); osc.stop(t + 0.2);
    }

    // Game state
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0;
    let hits = 0;
    let ducks = [];
    let impacts = [];

    function resize() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function spawnDuck() {
      const fromLeft = Math.random() > 0.5;
      ducks.push({
        x: fromLeft ? -20 : canvas.width + 20,
        y: canvas.height * 0.4 + Math.random() * (canvas.height * 0.3),
        vx: (fromLeft ? 1 : -1) * (2.5 + Math.random() * 2),
        vy: -(1.5 + Math.random() * 2),
        status: 'flying',
        facing: fromLeft ? 1 : -1,
        color: Math.random() > 0.8 ? '#f59e0b' : '#22c55e',
        points: 500,
        flap: 0
      });
    }

    setInterval(() => {
      if (ducks.filter(d => d.status === 'flying').length < 2) {
        spawnDuck();
      }
    }, 2000);

    function shoot(x, y, color = '#38bdf8') {
      playLaser();
      impacts.push({ x, y, r: 8, alpha: 1.0, color });
      let hitAny = false;
      ducks.forEach(d => {
        if (d.status === 'flying' && Math.hypot(d.x - x, d.y - y) < 45) {
          d.status = 'hit';
          hitAny = true;
          score += d.points;
          hits++;
          playHit();
          document.getElementById('score').innerText = String(score).padStart(6, '0');
          document.getElementById('hits').innerText = hits;
        }
      });
    }

    canvas.parentElement.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      shoot(e.clientX - rect.left, e.clientY - rect.top, '#f43f5e');
    });

    // Camera IR Detection
    let video = null;
    let offCanvas = document.createElement('canvas');
    offCanvas.width = 320; offCanvas.height = 240;
    let offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    let lastShootTime = 0;

    document.getElementById('start-cam-btn').addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        video = document.createElement('video');
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();
        document.getElementById('sig-color').innerText = 'CAMERA IR ACTIVE';
        document.getElementById('start-cam-btn').innerText = '✅ Camera Live';
      } catch (err) {
        alert('Could not access camera: ' + err.message);
      }
    });

    function checkCameraIR() {
      if (!video || video.readyState < 2) return;
      offCtx.drawImage(video, 0, 0, 320, 240);
      const frame = offCtx.getImageData(0, 0, 320, 240);
      const data = frame.data;
      let count = 0, sumX = 0, sumY = 0;
      let sumR = 0, sumG = 0, sumB = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 238) {
          const px = (i / 4) % 320;
          const py = Math.floor((i / 4) / 320);
          sumX += px; sumY += py;
          sumR += r; sumG += g; sumB += b;
          count++;
        }
      }

      if (count >= 2 && count <= 250) {
        const now = Date.now();
        if (now - lastShootTime > 180) {
          lastShootTime = now;
          // Invert X for mirror webcam
          const camX = (1 - (sumX / count) / 320) * canvas.width;
          const camY = ((sumY / count) / 240) * canvas.height;
          const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
          let beamCol = '#38bdf8';
          if (avgR > avgG * 1.4 && avgR > avgB * 1.4) beamCol = '#ef4444';
          else if (avgG > avgR * 1.3 && avgG > avgB * 1.3) beamCol = '#22c55e';
          document.getElementById('sig-color').innerText = beamCol === '#ef4444' ? '🔴 RED TEAM LASER' : beamCol === '#22c55e' ? '🟢 GREEN TEAM LASER' : '⚡ IR BURST DETECTED';
          shoot(camX, camY, beamCol);
        }
      }
    }

    // Main animation loop
    function loop() {
      checkCameraIR();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.72);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, canvas.height * 0.72, canvas.width, canvas.height * 0.28);

      // Render Ducks
      ducks.forEach(d => {
        if (d.status === 'flying') {
          d.x += d.vx; d.y += d.vy;
          d.flap = (d.flap + 0.2) % 3;
          if (d.y < 50 || d.y > canvas.height * 0.65) d.vy *= -1;
          if (d.x < -40 || d.x > canvas.width + 40) d.vx *= -1;
        } else if (d.status === 'hit') {
          d.y += 6;
        }
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 22, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(d.x + (d.facing > 0 ? 8 : -12), d.y - 8, 4, 10);
      });

      // Render Impacts
      for (let i = impacts.length - 1; i >= 0; i--) {
        const imp = impacts[i];
        imp.r += 2; imp.alpha -= 0.04;
        if (imp.alpha <= 0) { impacts.splice(i, 1); continue; }
        ctx.strokeStyle = imp.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = imp.alpha;
        ctx.beginPath();
        ctx.arc(imp.x, imp.y, imp.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;

      const blob = new Blob([standaloneHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'laser-tag-duck-hunt.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border-2 border-emerald-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-['Rajdhani'] tracking-wide text-emerald-400 uppercase">
                Export & Download for Your Website
              </h2>
              <p className="text-xs text-slate-400">
                Put your Laser Tag Duck Hunt arcade game directly onto your personal website or blog
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2">
          <button
            onClick={() => setActiveTab('standalone')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'standalone'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" /> 1-Click HTML Download
          </button>

          <button
            onClick={() => setActiveTab('embed')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'embed'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" /> Website Iframe Embed
          </button>

          <button
            onClick={() => setActiveTab('build_guide')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase transition-all ${
              activeTab === 'build_guide'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" /> Production Hosting Guide
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: STANDALONE DOWNLOAD */}
          {activeTab === 'standalone' && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    <FileCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-['Rajdhani'] text-slate-100 uppercase">
                      Download Self-Contained Single-File Game (.html)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      This downloads a single <code className="text-emerald-400 font-mono">laser-tag-duck-hunt.html</code> file that contains the entire game engine, 8-bit sound effects, and Camera IR/Laser tag detection.
                      You can double-click it to play offline right in your browser, or upload it to any website host!
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleDownloadStandalone}
                    disabled={isGenerating}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-['Rajdhani'] text-sm tracking-wider uppercase shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {isGenerating ? 'Preparing Bundle...' : 'Download Standalone Game HTML'}
                  </button>
                  <span className="text-xs text-slate-500">Zero setup • 100% Client-side • Works in Chrome, Edge, Firefox, Safari</span>
                </div>
              </div>

              {/* How to use the downloaded file */}
              <div className="space-y-3">
                <h4 className="text-xs font-['Rajdhani'] font-bold text-slate-300 uppercase tracking-wider">
                  How to Use on Your Website
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-emerald-400 font-bold text-xs">1. WordPress / CMS</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Upload to your WordPress Media Library or FTP, or copy inside a Custom HTML block.
                    </p>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-emerald-400 font-bold text-xs">2. GitHub Pages / Vercel</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Name the file <code className="text-slate-300">index.html</code> and push to a GitHub repository with Pages enabled.
                    </p>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-emerald-400 font-bold text-xs">3. Custom Web Server</span>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Upload directly to your Apache, Nginx, or cPanel <code className="text-slate-300">public_html</code> directory.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IFRAME EMBED */}
          {activeTab === 'embed' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold font-['Rajdhani'] text-slate-100 uppercase">
                  Embed Game Directly on Any Web Page
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Copy and paste this snippet into your HTML, Squarespace, Wix, Shopify, or WordPress post:
                </p>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                  {embedCode}
                </pre>
                <button
                  onClick={handleCopyEmbed}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
                >
                  {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedEmbed ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div className="bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-xl text-xs space-y-1 text-amber-200">
                <strong className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Important Camera Permission Note:
                </strong>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Notice the attribute <code className="bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-100">allow="camera; microphone"</code>.
                  This is required by modern web browsers to let your website visitors grant camera access so their laser tag blaster can be detected!
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCTION BUILD */}
          {activeTab === 'build_guide' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold font-['Rajdhani'] text-slate-100 uppercase flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  Full-Stack Build & Multiplayer Deployment
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  If you want to host the full multiplayer server with real-time WebSocket rooms:
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">1. Build Frontend Static Assets</span>
                    <button
                      onClick={handleCopyCli}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {copiedCli ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedCli ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-emerald-400 bg-slate-900/80 p-2.5 rounded-lg">
                    npm run build
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    This generates an optimized, minified production build in the <code className="text-slate-200 font-mono">dist/</code> folder.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 text-xs block">2. Host the Multiplayer WebSocket Server</span>
                  <pre className="text-xs font-mono text-emerald-400 bg-slate-900/80 p-2.5 rounded-lg">
                    npm run start
                  </pre>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Deploy this project to Render.com, Railway.app, Google Cloud Run, or AWS. The server handles WebSocket connections on port 3000 and serves the Duck Hunt arena.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold font-['Rajdhani'] uppercase tracking-wider text-xs transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
