import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DuckCanvas } from './components/DuckCanvas';
import { RetroHUD } from './components/RetroHUD';
import { CalibrationModal } from './components/CalibrationModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { ExportModal } from './components/ExportModal';
import { IRDetector, ShotEvent } from './detector/irDetector';
import { calibrationEngine } from './detector/calibration';
import { retroSound } from './audio/retroAudio';
import { Duck, ShotImpact, PlayerStats, RoomState, DuckType } from './types/game';
import { Play, RotateCcw, Crosshair, Users, Download, Sparkles } from 'lucide-react';

export default function App() {
  // Game states
  const [gameState, setGameState] = useState<'title' | 'playing' | 'round_over' | 'game_over'>('title');
  const [round, setRound] = useState<number>(1);
  const [ammo, setAmmo] = useState<number>(3);
  const maxAmmo = 3;
  const [screenFlash, setScreenFlash] = useState<boolean>(false);

  // Ducks in game
  const [ducks, setDucks] = useState<Duck[]>([]);
  const ducksRef = useRef<Duck[]>([]);
  ducksRef.current = ducks;

  const [ducksHitThisRound, setDucksHitThisRound] = useState<number>(0);
  const [ducksEscapedThisRound, setDucksEscapedThisRound] = useState<number>(0);

  // Impacts & Visual effects
  const [impacts, setImpacts] = useState<ShotImpact[]>([]);

  // Dog animation state
  const [dogState, setDogState] = useState<{
    visible: boolean;
    type: 'laugh' | 'hold_duck' | 'snicker';
    duckCount: number;
    progress: number;
  }>({
    visible: false,
    type: 'hold_duck',
    duckCount: 1,
    progress: 0,
  });

  // Player statistics
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    id: `p_${Math.random().toString(36).substring(2, 8)}`,
    name: 'Laser Hunter',
    score: 0,
    hits: 0,
    shots: 0,
    accuracy: 100,
    streak: 0,
    bestStreak: 0,
    color: '#38bdf8',
  });

  // Detected optical laser tag color
  const [detectedColorName, setDetectedColorName] = useState<string>('IR Optical Ready');
  const [detectedColorHex, setDetectedColorHex] = useState<string>('#38bdf8');

  // Modals
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // IR Camera Detector Instance
  const detectorRef = useRef<IRDetector | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);

  // WebSocket Multiplayer
  const wsRef = useRef<WebSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Initialize Detector & Calibration
  useEffect(() => {
    const detector = new IRDetector();
    detectorRef.current = detector;
    setIsCalibrated(calibrationEngine.isCalibrated());

    // Auto-start camera if permissions already granted, or wait for user action
    detector.getAvailableCameras().then((devices) => {
      if (devices.length > 0) {
        detector.start().then((started) => {
          setIsCameraActive(started);
        });
      }
    });

    return () => {
      detector.stop();
    };
  }, []);

  // Connect to Multiplayer WebSocket
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'JOINED_SUCCESS' || msg.type === 'ROOM_UPDATE') {
          setRoomState(msg.room);
          if (msg.playerId) {
            setPlayerStats(prev => ({ ...prev, id: msg.playerId }));
          }
        } else if (msg.type === 'ROUND_STARTED') {
          setRoomState(msg.room);
          setRound(msg.round);
          setGameState('playing');
          retroSound.playRoundStart();
        } else if (msg.type === 'DUCK_SPAWNED') {
          // Synchronized duck from multiplayer server
          setDucks((prev) => [
            ...prev,
            {
              id: msg.duck.id,
              x: msg.duck.x,
              y: msg.duck.y,
              vx: msg.duck.vx,
              vy: msg.duck.vy,
              type: msg.duck.type,
              points: msg.duck.points,
              status: 'flying',
              facing: msg.duck.vx > 0 ? 'right' : 'left',
              flapFrame: 0,
            },
          ]);
          retroSound.playQuack();
        } else if (msg.type === 'PLAYER_SHOT') {
          // Remote or local player shot
          const newImpact: ShotImpact = {
            id: `imp_${Date.now()}_${Math.random()}`,
            x: msg.x,
            y: msg.y,
            hit: msg.hit,
            color: msg.color,
            playerName: msg.playerName,
            timestamp: Date.now(),
          };
          setImpacts((prev) => [...prev.slice(-15), newImpact]);

          if (msg.hit && msg.hitDuckId) {
            retroSound.playDuckHit();
            retroSound.playFallWhistle();
            setDucks((prev) =>
              prev.map((d) => (d.id === msg.hitDuckId ? { ...d, status: 'hit', hitTime: Date.now() } : d))
            );
          }

          if (msg.room) {
            setRoomState(msg.room);
          }
        } else if (msg.type === 'ROUND_FINISHED') {
          setRoomState(msg.room);
          setGameState('round_over');
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Trigger dog reaction animation
  const triggerDogAnimation = useCallback((type: 'laugh' | 'hold_duck', duckCount = 1) => {
    if (type === 'laugh') {
      retroSound.playDogSnicker();
    } else {
      retroSound.playDogBark();
    }

    setDogState({
      visible: true,
      type,
      duckCount,
      progress: 0,
    });

    let startTime = Date.now();
    const duration = 2200;

    const animTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        clearInterval(animTimer);
        setDogState((s) => ({ ...s, visible: false, progress: 0 }));
      } else {
        // Curve: rises in first 400ms, stays for 1400ms, lowers in last 400ms
        let prog = 1.0;
        if (elapsed < 400) {
          prog = elapsed / 400;
        } else if (elapsed > 1800) {
          prog = (duration - elapsed) / 400;
        }
        setDogState((s) => ({ ...s, progress: Math.max(0, prog) }));
      }
    }, 16);
  }, []);

  // Handle laser tag shot impact
  const processShot = useCallback(
    (screenX: number, screenY: number, signalColorName = 'Standard IR', signalColorHex = '#38bdf8') => {
      retroSound.playLaserShot();

      // CRT Light Gun Screen Flash
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 50);

      setDetectedColorName(signalColorName);
      setDetectedColorHex(signalColorHex);

      // Consume ammo
      setAmmo((prev) => Math.max(0, prev - 1));

      // Check collision with flying ducks
      let hitDuck: Duck | null = null;
      const currentDucks = ducksRef.current;

      for (const duck of currentDucks) {
        if (duck.status === 'flying') {
          // Calculate hit distance in percentage space
          const dist = Math.hypot(duck.x - screenX, (duck.y - screenY) * 1.3);
          if (dist < 7.5) {
            hitDuck = duck;
            break;
          }
        }
      }

      const isHit = Boolean(hitDuck);

      // Update impacts
      const impact: ShotImpact = {
        id: `imp_${Date.now()}_${Math.random()}`,
        x: screenX,
        y: screenY,
        hit: isHit,
        color: signalColorHex,
        playerName: playerStats.name,
        timestamp: Date.now(),
      };
      setImpacts((prev) => [...prev.slice(-15), impact]);

      // If playing multiplayer, broadcast to arena server
      if (roomState && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'SHOOT',
            x: screenX,
            y: screenY,
            hitDuckId: hitDuck ? hitDuck.id : undefined,
          })
        );
      }

      // Handle hit effects locally
      if (hitDuck) {
        retroSound.playDuckHit();
        retroSound.playFallWhistle();

        const hitPoints = hitDuck.points;
        setDucks((prev) =>
          prev.map((d) => (d.id === hitDuck!.id ? { ...d, status: 'hit', hitTime: Date.now() } : d))
        );

        setDucksHitThisRound((prev) => prev + 1);

        setPlayerStats((prev) => {
          const newHits = prev.hits + 1;
          const newShots = prev.shots + 1;
          const newStreak = prev.streak + 1;
          const multiplier = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
          return {
            ...prev,
            hits: newHits,
            shots: newShots,
            streak: newStreak,
            bestStreak: Math.max(prev.bestStreak, newStreak),
            score: prev.score + hitPoints * multiplier,
            accuracy: Math.round((newHits / newShots) * 100),
          };
        });

        triggerDogAnimation('hold_duck', 1);
      } else {
        setPlayerStats((prev) => {
          const newShots = prev.shots + 1;
          return {
            ...prev,
            shots: newShots,
            streak: 0,
            accuracy: Math.round((prev.hits / newShots) * 100),
          };
        });
      }
    },
    [playerStats.name, roomState, triggerDogAnimation]
  );

  // Hook Camera IR Detector Shot Callback
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;

    detector.setOnShot((shot: ShotEvent) => {
      processShot(shot.screenX, shot.screenY, shot.signal.colorName, shot.signal.hex);
    });
  }, [processShot]);

  // Duck Spawn & Flight Loop (Single-player engine)
  const spawnSinglePlayerDuck = useCallback(() => {
    const duckTypes: Array<{ type: DuckType; points: number; speedMul: number }> = [
      { type: 'classic', points: 500, speedMul: 1.0 },
      { type: 'swift', points: 800, speedMul: 1.6 },
      { type: 'golden', points: 1500, speedMul: 2.2 },
    ];

    const roll = Math.random();
    const selected = roll > 0.85 ? duckTypes[2] : roll > 0.5 ? duckTypes[1] : duckTypes[0];

    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -4 : 104;
    const startY = 40 + Math.random() * 30;
    const baseVx = (1.4 + Math.random() * 1.5) * selected.speedMul;
    const vx = fromLeft ? baseVx : -baseVx;
    const vy = -(1.2 + Math.random() * 1.4) * selected.speedMul;

    const newDuck: Duck = {
      id: `duck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: startX,
      y: startY,
      vx,
      vy,
      type: selected.type,
      points: selected.points,
      status: 'flying',
      facing: fromLeft ? 'right' : 'left',
      flapFrame: 0,
    };

    setDucks((prev) => [...prev, newDuck]);
    setAmmo(maxAmmo);
    retroSound.playQuack();
  }, []);

  // Single player game frame physics update
  useEffect(() => {
    if (gameState !== 'playing') return;

    let animId: number;

    const updatePhysics = () => {
      setDucks((prevDucks) =>
        prevDucks
          .map((duck) => {
            if (duck.status === 'flying') {
              let nx = duck.x + duck.vx * 0.16;
              let ny = duck.y + duck.vy * 0.16;
              let nvx = duck.vx;
              let nvy = duck.vy;

              // Bounce off side boundaries
              if (nx < 4 && nvx < 0) {
                nvx = Math.abs(nvx);
              } else if (nx > 96 && nvx > 0) {
                nvx = -Math.abs(nvx);
              }

              // Bounce off top and bottom limits
              if (ny < 12 && nvy < 0) {
                nvy = Math.abs(nvy);
              } else if (ny > 66 && nvy > 0) {
                nvy = -Math.abs(nvy);
              }

              return {
                ...duck,
                x: nx,
                y: ny,
                vx: nvx,
                vy: nvy,
                facing: (nvx > 0 ? 'right' : 'left') as 'left' | 'right',
                flapFrame: (duck.flapFrame + 0.18) % 3,
              };
            } else if (duck.status === 'hit') {
              // Pause briefly in shock then tumble
              if (Date.now() - (duck.hitTime || 0) > 300) {
                return { ...duck, status: 'falling' as const };
              }
              return duck;
            } else if (duck.status === 'falling') {
              return {
                ...duck,
                y: duck.y + 1.2,
              };
            }
            return duck;
          })
          .filter((duck) => duck.y < 85) // remove ducks that fell into the grass
      );

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState]);

  // Single player duck spawner loop
  useEffect(() => {
    if (gameState !== 'playing' || (roomState && roomState.players.length > 1)) return;

    const spawnInterval = setInterval(() => {
      const activeCount = ducksRef.current.filter((d) => d.status === 'flying').length;
      const totalProcessed = ducksHitThisRound + ducksEscapedThisRound;

      if (totalProcessed >= 10 && activeCount === 0) {
        setGameState('round_over');
        retroSound.playRoundStart();
        return;
      }

      if (activeCount < 2 && totalProcessed + activeCount < 10) {
        spawnSinglePlayerDuck();
      }
    }, 2400);

    return () => clearInterval(spawnInterval);
  }, [gameState, roomState, ducksHitThisRound, ducksEscapedThisRound, spawnSinglePlayerDuck]);

  // Duck fly-away / escape timer
  useEffect(() => {
    if (gameState !== 'playing') return;

    const escapeChecker = setInterval(() => {
      const now = Date.now();
      setDucks((prevDucks) =>
        prevDucks.map((duck) => {
          if (duck.status === 'flying') {
            // If duck has been flying for > 9 seconds or ammo depleted
            const age = now - parseInt(duck.id.split('_')[1] || '0', 10);
            if (age > 9500) {
              setDucksEscapedThisRound((e) => e + 1);
              triggerDogAnimation('laugh');
              return { ...duck, status: 'escaped' as const };
            }
          }
          return duck;
        })
      );
    }, 1000);

    return () => clearInterval(escapeChecker);
  }, [gameState, triggerDogAnimation]);

  // Start new single-player round
  const startSinglePlayerGame = (resetScore = false) => {
    if (resetScore) {
      setPlayerStats((prev) => ({
        ...prev,
        score: 0,
        hits: 0,
        shots: 0,
        accuracy: 100,
        streak: 0,
      }));
      setRound(1);
    }
    setDucks([]);
    setDucksHitThisRound(0);
    setDucksEscapedThisRound(0);
    setAmmo(maxAmmo);
    setGameState('playing');
    retroSound.playRoundStart();

    // Auto-prompt camera if not started
    if (!isCameraActive && detectorRef.current) {
      detectorRef.current.start().then((started) => setIsCameraActive(started));
    }
  };

  // Canvas direct click / tap shooting
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    processShot(clickX, clickY, 'Touch / Click Trigger', '#f43f5e');
  };

  // Keyboard spacebar trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        // Fire at center or last tracked point
        processShot(50, 45, 'Spacebar Trigger', '#38bdf8');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, processShot]);

  // Multiplayer Actions
  const handleJoinMultiplayerRoom = (roomId: string, playerName: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setPlayerStats((prev) => ({ ...prev, name: playerName }));
      wsRef.current.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomId,
          playerName,
          playerId: playerStats.id,
        })
      );
    }
  };

  const handleToggleReady = (ready: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SET_READY', ready }));
    }
  };

  const handleStartMultiplayerGame = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'START_GAME' }));
      setIsMultiplayerOpen(false);
    }
  };

  const handleSendEmote = (emote: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CHAT_EMOTE', emote }));
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Top HUD */}
      <RetroHUD
        stats={playerStats}
        round={round}
        ammo={ammo}
        maxAmmo={maxAmmo}
        ducks={ducks}
        roundDucksTotal={10}
        ducksHitThisRound={ducksHitThisRound}
        ducksEscapedThisRound={ducksEscapedThisRound}
        isMuted={isMuted}
        onToggleMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          retroSound.setMuted(next);
        }}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        isCalibrated={isCalibrated}
        isCameraActive={isCameraActive}
        roomState={roomState}
        detectedColorName={detectedColorName}
        detectedColorHex={detectedColorHex}
      />

      {/* Main Play Area */}
      <div className="relative flex-1 px-3 sm:px-6 pb-2 min-h-0">
        <DuckCanvas
          ducks={ducks}
          impacts={impacts}
          dogState={dogState}
          screenFlash={screenFlash}
          onScreenClick={handleCanvasClick}
        />

        {/* Title Screen Overlay */}
        {gameState === 'title' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="max-w-lg w-full bg-slate-900/95 border-4 border-amber-500 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
              
              <div className="space-y-2">
                <span className="text-4xl animate-bounce inline-block">🦆</span>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-['Press_Start_2P'] text-amber-400 leading-relaxed tracking-wider drop-shadow-lg">
                  DUCK HUNT
                </h1>
                <p className="text-xs font-['Rajdhani'] font-bold text-cyan-400 tracking-widest uppercase">
                  IR Camera & Laser Tag Edition
                </p>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2 text-slate-300">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  How to Play with Laser Tag / IR Blaster:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-normal">
                  <li><strong>Point your laser tag blaster</strong> or TV remote at the camera and pull the trigger!</li>
                  <li>Our vision engine senses <strong>IR light bursts</strong> and color signals (Red, Blue, Green, Gold).</li>
                  <li>Click <strong>"Calibrate IR"</strong> to lock in 4-corner screen homography tracking.</li>
                  <li>You can also click, tap, or hit <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white">Space</kbd> to shoot!</li>
                </ul>
              </div>

              {/* Start Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => startSinglePlayerGame(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-['Rajdhani'] text-base uppercase tracking-wider shadow-lg shadow-amber-950 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  Start Solo Hunt
                </button>

                <button
                  onClick={() => setIsMultiplayerOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-['Rajdhani'] text-base uppercase tracking-wider shadow-lg shadow-indigo-950 transition-all cursor-pointer"
                >
                  <Users className="w-5 h-5" />
                  Online Versus
                </button>
              </div>

              <div className="flex justify-center gap-4 text-xs">
                <button
                  onClick={() => setIsCalibrationOpen(true)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  <Crosshair className="w-3.5 h-3.5" /> Sensor Calibration
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => setIsExportOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" /> Export For My Website
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Round Over / Victory Overlay */}
        {gameState === 'round_over' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in zoom-in-95">
            <div className="max-w-md w-full bg-slate-900 border-4 border-cyan-500 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
              
              <div className="space-y-1">
                <span className="text-3xl">🏆</span>
                <h2 className="text-xl font-bold font-['Press_Start_2P'] text-cyan-400">
                  ROUND {round} CLEAR!
                </h2>
                <p className="text-xs text-slate-400">
                  Ducks Hit: <strong className="text-emerald-400">{ducksHitThisRound}</strong> / 10
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Accuracy</span>
                  <span className="font-bold text-base text-cyan-300">{playerStats.accuracy}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Total Score</span>
                  <span className="font-bold text-base text-amber-400 font-mono">{playerStats.score}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRound((r) => r + 1);
                    startSinglePlayerGame(false);
                  }}
                  className="flex-1 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-['Rajdhani'] uppercase tracking-wider text-sm shadow-lg shadow-cyan-950 transition-all cursor-pointer"
                >
                  Next Round ➔
                </button>

                <button
                  onClick={() => setGameState('title')}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-['Rajdhani'] uppercase tracking-wider text-xs transition-colors"
                >
                  Title
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Sensor Calibration & Optical Scope Modal */}
      {detectorRef.current && (
        <CalibrationModal
          isOpen={isCalibrationOpen}
          onClose={() => {
            setIsCalibrationOpen(false);
            setIsCalibrated(calibrationEngine.isCalibrated());
          }}
          detector={detectorRef.current}
        />
      )}

      {/* Online Multiplayer Modal */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
        roomState={roomState}
        playerId={playerStats.id}
        isConnected={isConnected}
        onJoinRoom={handleJoinMultiplayerRoom}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartMultiplayerGame}
        onSendEmote={handleSendEmote}
      />

      {/* Export & Download for Website Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        appUrl={typeof window !== 'undefined' ? window.location.origin : ''}
      />

    </div>
  );
}
