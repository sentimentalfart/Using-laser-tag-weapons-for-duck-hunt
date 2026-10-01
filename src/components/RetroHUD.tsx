import React from 'react';
import { Volume2, VolumeX, Crosshair, Users, Download, Zap, Trophy, Flame } from 'lucide-react';
import { PlayerStats, RoomState, Duck } from '../types/game';

interface RetroHUDProps {
  stats: PlayerStats;
  round: number;
  ammo: number;
  maxAmmo: number;
  ducks: Duck[];
  roundDucksTotal: number;
  ducksHitThisRound: number;
  ducksEscapedThisRound: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenCalibration: () => void;
  onOpenMultiplayer: () => void;
  onOpenExport: () => void;
  isCalibrated: boolean;
  isCameraActive: boolean;
  roomState: RoomState | null;
  detectedColorName?: string;
  detectedColorHex?: string;
}

export const RetroHUD: React.FC<RetroHUDProps> = ({
  stats,
  round,
  ammo,
  maxAmmo,
  ducks,
  roundDucksTotal,
  ducksHitThisRound,
  ducksEscapedThisRound,
  isMuted,
  onToggleMute,
  onOpenCalibration,
  onOpenMultiplayer,
  onOpenExport,
  isCalibrated,
  isCameraActive,
  roomState,
  detectedColorName = 'IR Optical Ready',
  detectedColorHex = '#38bdf8',
}) => {
  return (
    <div className="w-full flex flex-col justify-between pointer-events-none select-none">
      
      {/* Top Navigation Header */}
      <div className="p-3 sm:p-4 flex items-center justify-between pointer-events-auto bg-slate-950/80 backdrop-blur-md border-b-2 border-slate-800 shadow-lg">
        {/* Brand & Blaster Signal Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">🦆</span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold font-['Press_Start_2P'] tracking-wider text-amber-400 drop-shadow">
                DUCK HUNT
              </h1>
              <span className="text-[10px] font-['Rajdhani'] font-bold text-cyan-400 tracking-widest uppercase">
                Laser Tag IR Arena
              </span>
            </div>
          </div>

          {/* Active Blaster Sensor Indicator */}
          <div
            onClick={onOpenCalibration}
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer shadow"
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: detectedColorHex }}
            />
            <span className="text-xs font-['Rajdhani'] font-bold uppercase text-slate-200">
              {isCameraActive ? detectedColorName : 'Camera Idle (Click to Arm)'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Calibration Button */}
          <button
            onClick={onOpenCalibration}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              isCalibrated
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isCalibrated ? 'Calibrated' : 'Calibrate IR'}</span>
          </button>

          {/* Multiplayer Button */}
          <button
            onClick={onOpenMultiplayer}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              roomState
                ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60 hover:bg-indigo-900'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-indigo-400'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Online Versus</span>
            {roomState && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping" />
            )}
          </button>

          {/* Export & Download Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40 text-xs font-['Rajdhani'] font-bold uppercase tracking-wider shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Game</span>
          </button>

          {/* Audio Mute Button */}
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Multiplayer Live Duel Bar (If in multiplayer room) */}
      {roomState && roomState.players.length > 1 && (
        <div className="w-full bg-slate-950/90 border-b border-indigo-500/40 px-6 py-1.5 flex items-center justify-between text-xs font-['Rajdhani'] font-bold">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 uppercase">Arena Duel:</span>
            {roomState.players.slice(0, 3).map((p) => (
              <span
                key={p.id}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-200">{p.name}:</span>
                <span className="text-amber-400 font-mono">{p.score}</span>
              </span>
            ))}
          </div>
          <span className="text-slate-400 text-[11px]">Room: {roomState.id}</span>
        </div>
      )}

      {/* Bottom Retro Game HUD */}
      <div className="p-3 sm:p-4 mt-auto">
        <div className="max-w-5xl mx-auto bg-slate-950/95 border-2 border-slate-700 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
          
          {/* Shots / Ammo Energy */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-[10px] font-['Press_Start_2P'] text-cyan-400 uppercase">
              SHOT
            </div>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1.5 rounded-lg">
              {Array.from({ length: maxAmmo }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-5 rounded-xs transition-all ${
                    i < ammo
                      ? 'bg-rose-500 border border-rose-300 shadow-sm shadow-rose-500'
                      : 'bg-slate-800 opacity-40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Duck Icons Tally Bar (10 ducks in round) */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-['Press_Start_2P'] text-slate-400 uppercase">
              HIT TALLY
            </span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              {Array.from({ length: 10 }).map((_, idx) => {
                const isHit = idx < ducksHitThisRound;
                const isEscaped = idx >= ducksHitThisRound && idx < (ducksHitThisRound + ducksEscapedThisRound);
                const isCurrent = idx === (ducksHitThisRound + ducksEscapedThisRound);

                return (
                  <span
                    key={idx}
                    className={`text-xs transition-all ${
                      isHit
                        ? 'text-emerald-400 drop-shadow scale-110'
                        : isEscaped
                        ? 'text-rose-500 line-through opacity-70'
                        : isCurrent
                        ? 'text-amber-400 animate-pulse'
                        : 'text-slate-700'
                    }`}
                  >
                    🦆
                  </span>
                );
              })}
            </div>
          </div>

          {/* Round Indicator */}
          <div className="text-center">
            <span className="text-[9px] font-['Press_Start_2P'] text-emerald-400 block">
              ROUND
            </span>
            <span className="text-lg font-['Press_Start_2P'] font-bold text-white">
              {round}
            </span>
          </div>

          {/* Score & Streak */}
          <div className="flex items-center gap-4">
            {stats.streak > 1 && (
              <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/50 px-2.5 py-1 rounded-lg text-amber-300 text-xs font-bold font-['Rajdhani'] animate-bounce">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                <span>{stats.streak}x STREAK</span>
              </div>
            )}

            <div className="text-right">
              <span className="text-[9px] font-['Press_Start_2P'] text-amber-400 block">
                SCORE
              </span>
              <span className="text-base sm:text-xl font-['Press_Start_2P'] text-amber-300 drop-shadow">
                {String(stats.score).padStart(6, '0')}
              </span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
