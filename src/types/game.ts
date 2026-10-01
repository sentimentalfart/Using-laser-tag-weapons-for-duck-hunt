export type DuckType = 'classic' | 'swift' | 'golden';

export interface Duck {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  vx: number;
  vy: number;
  type: DuckType;
  points: number;
  status: 'flying' | 'hit' | 'falling' | 'escaped';
  facing: 'left' | 'right';
  flapFrame: number;
  hitTime?: number;
  fallSpeed?: number;
  hitBy?: string;
  hitByName?: string;
  hitByColor?: string;
}

export type GameMode = 'classic' | 'clay' | 'arcade' | 'multiplayer';

export interface PlayerStats {
  id: string;
  name: string;
  score: number;
  hits: number;
  shots: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
  color: string;
}

export interface IRDetectionConfig {
  threshold: number; // 150 - 255 (brightness)
  minBlobSize: number; // 2 - 50 px
  maxBlobSize: number; // 50 - 500 px
  deltaDetection: boolean; // Compare with prev frame to isolate flashes
  deltaThreshold: number; // 30 - 150
  detectionMode: 'ir_bright' | 'red_laser' | 'green_laser';
  mirrorCamera: boolean;
  debounceMs: number; // 100 - 300 ms
  showMaskOverlay: boolean;
}

export interface ShotImpact {
  id: string;
  x: number;
  y: number;
  hit: boolean;
  color: string;
  playerName: string;
  timestamp: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  score: number;
  hits: number;
  shots: number;
  ready: boolean;
  color: string;
  isHost: boolean;
  lastShot?: { x: number; y: number; timestamp: number; hit: boolean };
}

export interface RoomState {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  status: 'lobby' | 'playing' | 'round_over' | 'game_over';
  round: number;
  ducks: Duck[];
}
