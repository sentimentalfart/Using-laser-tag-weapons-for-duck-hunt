import React, { useEffect, useRef } from 'react';
import { Duck, ShotImpact } from '../types/game';

interface DuckCanvasProps {
  ducks: Duck[];
  impacts: ShotImpact[];
  dogState: {
    visible: boolean;
    type: 'laugh' | 'hold_duck' | 'snicker';
    duckCount: number;
    progress: number; // 0 to 1 (pop up and down)
  };
  screenFlash: boolean;
  onScreenClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

export const DuckCanvas: React.FC<DuckCanvasProps> = ({
  ducks,
  impacts,
  dogState,
  screenFlash,
  onScreenClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastDucksStateRef = useRef<Map<string, string>>(new Map());

  // Track duck hit events to spawn feather particles
  useEffect(() => {
    ducks.forEach((duck) => {
      const prevStatus = lastDucksStateRef.current.get(duck.id);
      if (duck.status === 'hit' && prevStatus === 'flying') {
        // Spawn feather and spark particles
        const colors = duck.type === 'golden' ? ['#fbbf24', '#fef08a', '#ffffff', '#f59e0b'] : ['#38bdf8', '#fb7185', '#ffffff', '#22c55e'];
        for (let i = 0; i < 24; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 4.5;
          particlesRef.current.push({
            x: duck.x,
            y: duck.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 3 + Math.random() * 5,
            alpha: 1.0,
            life: 40 + Math.random() * 20,
          });
        }
      }
      lastDucksStateRef.current.set(duck.id, duck.status);
    });
  }, [ducks]);

  // Main canvas animation render loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Render Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.65, '#7dd3fc');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.72);

      // Distant pixel mountains
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      ctx.lineTo(w * 0.15, h * 0.58);
      ctx.lineTo(w * 0.32, h * 0.72);
      ctx.lineTo(w * 0.48, h * 0.54);
      ctx.lineTo(w * 0.7, h * 0.72);
      ctx.lineTo(w * 0.88, h * 0.56);
      ctx.lineTo(w, h * 0.72);
      ctx.fill();

      // Pixel Clouds
      const time = Date.now() * 0.0006;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const drawCloud = (cx: number, cy: number, size: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.8, cy - size * 0.2, size * 0.85, 0, Math.PI * 2);
        ctx.arc(cx + size * 1.5, cy, size * 0.7, 0, Math.PI * 2);
        ctx.arc(cx - size * 0.7, cy + size * 0.1, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      };

      drawCloud(((time * 25 + 100) % (w + 200)) - 100, h * 0.18, 28);
      drawCloud(((time * 18 + 450) % (w + 200)) - 100, h * 0.28, 22);
      drawCloud(((time * 22 + 750) % (w + 200)) - 100, h * 0.12, 34);

      // Pixel Tree on left side
      const treeBaseX = w * 0.12;
      const treeBaseY = h * 0.72;
      // Trunk
      ctx.fillStyle = '#78350f';
      ctx.fillRect(treeBaseX - 14, treeBaseY - 140, 28, 140);
      // Leaves foliage
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(treeBaseX, treeBaseY - 180, 55, 0, Math.PI * 2);
      ctx.arc(treeBaseX - 35, treeBaseY - 145, 45, 0, Math.PI * 2);
      ctx.arc(treeBaseX + 35, treeBaseY - 145, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(treeBaseX - 10, treeBaseY - 175, 38, 0, Math.PI * 2);
      ctx.fill();

      // 2. Render Ducks
      ducks.forEach((duck) => {
        if (duck.status === 'escaped') return;

        const dx = (duck.x / 100) * w;
        const dy = (duck.y / 100) * h;
        const scale = 1.3;

        ctx.save();
        ctx.translate(dx, dy);

        if (duck.status === 'hit' || duck.status === 'falling') {
          // Spinning tumble
          const spin = ((Date.now() - (duck.hitTime || 0)) * 0.015);
          ctx.rotate(spin);
        } else if (duck.facing === 'left') {
          ctx.scale(-1, 1);
        }

        // Color palettes based on duck type
        let bodyColor = '#854d0e';
        let headColor = '#15803d';
        let wingColor = '#a16207';
        let beakColor = '#ea580c';

        if (duck.type === 'swift') {
          bodyColor = '#1e3a8a';
          headColor = '#0284c7';
          wingColor = '#2563eb';
          beakColor = '#f59e0b';
        } else if (duck.type === 'golden') {
          bodyColor = '#ca8a04';
          headColor = '#eab308';
          wingColor = '#fde047';
          beakColor = '#f97316';
        }

        if (duck.status === 'hit') {
          // Flash white/yellow shock
          bodyColor = '#ffffff';
          headColor = '#fef08a';
          wingColor = '#ffffff';
        }

        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22 * scale, 14 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // White neck ring (classic mallard)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(8 * scale, -9 * scale, 4 * scale, 12 * scale);

        // Head
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(14 * scale, -8 * scale, 9 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(16 * scale, -11 * scale, 3 * scale, 3 * scale);
        ctx.fillStyle = '#000000';
        ctx.fillRect(18 * scale, -10 * scale, 2 * scale, 2 * scale);

        // Beak
        ctx.fillStyle = beakColor;
        ctx.beginPath();
        ctx.moveTo(21 * scale, -9 * scale);
        ctx.lineTo(29 * scale, -6 * scale);
        ctx.lineTo(21 * scale, -4 * scale);
        ctx.fill();

        // Wing (flapping frame)
        ctx.fillStyle = wingColor;
        const flap = duck.flapFrame % 3;
        ctx.beginPath();
        if (flap === 0) {
          // Wings Up
          ctx.moveTo(-10 * scale, 0);
          ctx.lineTo(-4 * scale, -22 * scale);
          ctx.lineTo(8 * scale, -2 * scale);
        } else if (flap === 1) {
          // Wings Gliding
          ctx.moveTo(-12 * scale, 0);
          ctx.lineTo(0, -12 * scale);
          ctx.lineTo(8 * scale, 2 * scale);
        } else {
          // Wings Down
          ctx.moveTo(-8 * scale, 0);
          ctx.lineTo(-2 * scale, 18 * scale);
          ctx.lineTo(8 * scale, 4 * scale);
        }
        ctx.fill();

        // Golden duck sparkle
        if (duck.type === 'golden') {
          ctx.fillStyle = '#ffffff';
          const sparkOffset = Math.sin(Date.now() * 0.01) * 8;
          ctx.fillRect(-15 + sparkOffset, -15 - sparkOffset, 3, 3);
          ctx.fillRect(15 - sparkOffset, 12 + sparkOffset, 3, 3);
        }

        ctx.restore();

        // If hit, draw points popup floating up
        if (duck.status === 'hit' || duck.status === 'falling') {
          ctx.save();
          ctx.font = 'bold 16px "Press Start 2P", monospace';
          ctx.fillStyle = duck.type === 'golden' ? '#fde047' : '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          const pointsText = `+${duck.points}`;
          const textY = dy - 24;
          ctx.strokeText(pointsText, dx - 20, textY);
          ctx.fillText(pointsText, dx - 20, textY);
          ctx.restore();
        }
      });

      // 3. Render Particles (Feathers & sparks)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += (p.vx / w) * 100;
        p.y += (p.vy / h) * 100;
        p.vy += 0.12; // gravity
        p.alpha -= 0.02;
        p.life--;

        if (p.life <= 0 || p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;
        ctx.fillRect(px, py, p.size, p.size);
        ctx.restore();
      }

      // 4. Render Dog (Popping up from grass)
      if (dogState.visible) {
        const dogX = w * 0.5;
        // Peak Y is h * 0.60, baseline is h * 0.74
        const dogY = h * 0.74 - (dogState.progress * h * 0.14);

        ctx.save();
        ctx.translate(dogX, dogY);

        // Brown Dog Body & Head
        ctx.fillStyle = '#92400e';
        // Head
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();

        // Floppy Ears
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(-34, -4, 14, 26, -0.2, 0, Math.PI * 2);
        ctx.ellipse(34, -4, 14, 26, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(0, 10, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Black Nose
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(0, 4, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-10, -10, 7, 0, Math.PI * 2);
        ctx.arc(10, -10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-8, -10, 4, 0, Math.PI * 2);
        ctx.arc(8, -10, 4, 0, Math.PI * 2);
        ctx.fill();

        // Dog Expression
        if (dogState.type === 'snicker' || dogState.type === 'laugh') {
          // Snickering: paws covering laughing mouth
          ctx.fillStyle = '#92400e';
          ctx.beginPath();
          ctx.arc(-14, 22, 14, 0, Math.PI * 2);
          ctx.arc(14, 22, 14, 0, Math.PI * 2);
          ctx.fill();

          // Laugh bubble text
          ctx.font = '14px "Press Start 2P", monospace';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('HE-HE-HE!', -65, -45);
        } else {
          // Holding captured ducks in paws!
          ctx.fillStyle = '#22c55e';
          ctx.font = '14px "Press Start 2P", monospace';
          ctx.fillText('NICE SHOT!', -60, -45);

          // Duck in paw
          ctx.fillStyle = '#854d0e';
          ctx.fillRect(28, -6, 20, 14);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(40, -16, 12, 12);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(52, -14, 8, 5);
        }

        ctx.restore();
      }

      // 5. Render Foreground Grass & Bushes (Hiding ducks when they fly out)
      const grassGrad = ctx.createLinearGradient(0, h * 0.70, 0, h);
      grassGrad.addColorStop(0, '#16a34a');
      grassGrad.addColorStop(0.3, '#15803d');
      grassGrad.addColorStop(1, '#14532d');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, h * 0.72, w, h * 0.28);

      // Pixel grass tufts along the horizon
      ctx.fillStyle = '#22c55e';
      const step = 20;
      for (let gx = 0; gx < w; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, h * 0.72);
        ctx.lineTo(gx + 6, h * 0.69);
        ctx.lineTo(gx + 12, h * 0.72);
        ctx.fill();
      }

      // 6. Render Laser Shot Impacts (Crosshairs, expanding ripples, and laser tag beams)
      const now = Date.now();
      impacts.forEach((imp) => {
        const age = now - imp.timestamp;
        if (age > 600) return;

        const ix = (imp.x / 100) * w;
        const iy = (imp.y / 100) * h;
        const progress = age / 600;
        const radius = 8 + progress * 40;
        const alpha = 1 - progress;

        ctx.save();
        ctx.strokeStyle = imp.color || '#38bdf8';
        ctx.lineWidth = Math.max(1, 3 * (1 - progress));
        ctx.globalAlpha = alpha;

        // Expanding blast ring
        ctx.beginPath();
        ctx.arc(ix, iy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner tactical crosshair
        const crossSize = 14;
        ctx.beginPath();
        ctx.moveTo(ix - crossSize, iy);
        ctx.lineTo(ix + crossSize, iy);
        ctx.moveTo(ix, iy - crossSize);
        ctx.lineTo(ix, iy + crossSize);
        ctx.stroke();

        // Hit flash or player name tag
        ctx.font = '10px "Rajdhani", sans-serif';
        ctx.fillStyle = imp.color || '#38bdf8';
        ctx.fillText(
          `${imp.playerName}${imp.hit ? ' [HIT!]' : ''}`,
          ix + 16,
          iy - 10
        );

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [ducks, impacts, dogState]);

  // Adjust canvas resolution dynamically to match element size
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      onClick={onScreenClick}
      className={`relative w-full h-full cursor-crosshair overflow-hidden rounded-xl border-4 border-slate-700 shadow-2xl transition-all select-none ${
        screenFlash ? 'brightness-200 saturate-200' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block bg-slate-900"
      />

      {/* Screen flash white-out (Classic Light Gun CRT flash effect) */}
      {screenFlash && (
        <div className="pointer-events-none absolute inset-0 bg-white/70 animate-ping" />
      )}
    </div>
  );
};
