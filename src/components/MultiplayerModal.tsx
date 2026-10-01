import React, { useState } from 'react';
import { Users, Swords, Copy, Check, Play, ShieldAlert, Sparkles, Radio } from 'lucide-react';
import { RoomState } from '../types/game';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState | null;
  playerId: string;
  isConnected: boolean;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onToggleReady: (ready: boolean) => void;
  onStartGame: () => void;
  onSendEmote: (emote: string) => void;
}

const TEAM_COLORS = [
  { name: 'Team Blue', hex: '#38bdf8' },
  { name: 'Team Red', hex: '#f43f5e' },
  { name: 'Team Green', hex: '#22c55e' },
  { name: 'Team Gold', hex: '#eab308' },
];

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  roomState,
  playerId,
  isConnected,
  onJoinRoom,
  onToggleReady,
  onStartGame,
  onSendEmote,
}) => {
  const [roomIdInput, setRoomIdInput] = useState('ARENA-1');
  const [nameInput, setNameInput] = useState('Hunter');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const currentPlayer = roomState?.players.find(p => p.id === playerId);
  const isHost = roomState ? roomState.hostId === playerId : false;

  const handleCopyCode = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    onJoinRoom(roomIdInput.trim().toUpperCase(), nameInput.trim() || 'Hunter');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-indigo-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-['Rajdhani'] tracking-wide text-indigo-400 uppercase">
                Online Multiplayer Arena
              </h2>
              <p className="text-xs text-slate-400">
                1v1 Duel or Co-Op Duck Hunt with live synchronized duck spawns & opponent laser beams
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!roomState ? (
            /* Join / Create Form */
            <form onSubmit={handleJoin} className="space-y-5 max-w-md mx-auto py-4">
              <div className="text-center space-y-1">
                <Users className="w-12 h-12 text-indigo-400 mx-auto" />
                <h3 className="font-['Rajdhani'] font-bold text-lg text-slate-100 uppercase">
                  Join or Host a Match
                </h3>
                <p className="text-xs text-slate-400">
                  Enter an arena room code to play with friends across the web!
                </p>
              </div>

              <div className="space-y-4 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-['Rajdhani'] font-bold uppercase text-slate-300">
                    Your Hunter Call-Sign
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. LaserSniper"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-semibold focus:outline-none focus:border-indigo-400"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-['Rajdhani'] font-bold uppercase text-slate-300">
                    Room Code
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    placeholder="e.g. ARENA-1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-indigo-300 font-mono font-bold uppercase focus:outline-none focus:border-indigo-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-['Rajdhani'] text-sm uppercase tracking-wider shadow-lg shadow-indigo-950 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  Connect to Arena
                </button>
              </div>
            </form>
          ) : (
            /* In-Room Lobby */
            <div className="space-y-6">
              {/* Room Info Bar */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Arena Room Code</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xl font-bold text-indigo-300">{roomState.id}</span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                      title="Copy Room Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                    roomState.status === 'playing' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                  }`}>
                    {roomState.status === 'playing' ? 'Match In Progress' : 'Lobby'}
                  </span>
                </div>
              </div>

              {/* Connected Players List */}
              <div className="space-y-3">
                <h4 className="text-xs font-['Rajdhani'] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Hunters in Arena ({roomState.players.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roomState.players.map((player) => (
                    <div
                      key={player.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        player.id === playerId
                          ? 'bg-slate-950 border-indigo-500/50 shadow-md'
                          : 'bg-slate-950/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow"
                          style={{ backgroundColor: player.color, color: '#000' }}
                        >
                          {player.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            {player.name}
                            {player.id === playerId && <span className="text-[10px] text-indigo-400">(You)</span>}
                            {player.isHost && (
                              <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-bold">
                                HOST
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Score: <strong className="text-amber-400 font-mono">{player.score}</strong> | Hits: {player.hits}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        player.ready ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {player.ready ? 'READY' : 'WAITING'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emote Reaction Bar */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 font-semibold">Quick Reaction:</span>
                <div className="flex gap-2">
                  {['🎯 Quack!', '🔥 Locked On', '🦆 Missed!', '🏆 Victory!'].map((emote) => (
                    <button
                      key={emote}
                      onClick={() => onSendEmote(emote)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all hover:scale-105"
                    >
                      {emote}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lobby Action Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => onToggleReady(!currentPlayer?.ready)}
                  className={`px-5 py-2.5 rounded-xl font-bold font-['Rajdhani'] text-xs uppercase tracking-wider transition-all ${
                    currentPlayer?.ready
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
                  }`}
                >
                  {currentPlayer?.ready ? 'Cancel Ready' : 'Mark Ready'}
                </button>

                {isHost && (
                  <button
                    onClick={onStartGame}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-['Rajdhani'] text-sm uppercase tracking-wider shadow-lg shadow-indigo-950 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Multiplayer Match
                  </button>
                )}

                {!isHost && (
                  <span className="text-xs text-slate-400 italic">
                    Waiting for room host to start the round...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
