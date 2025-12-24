
import { TOWER_STATS_DATA } from './towers/stats';

export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 15;
export const CELL_SIZE = 40; 
export const GAME_TICK_RATE = 1000 / 60;
export const PROJECTILE_SPEED = 0.35; 
export const MAX_UPGRADE_LEVEL = 5;

// ROCKET PHYSICS CONFIGURATION
export const ROCKET_START_SPEED = 0.05;
export const ROCKET_MAX_SPEED = 0.18; // Slower than regular projectiles (0.35)
export const ROCKET_ACCELERATION = 0.005;
export const ROCKET_TURN_SPEED = 0.05; // Reduced from 0.12 for wider turn radius

export const START_POS = { x: 0, y: 0 };
export const END_POS = { x: GRID_WIDTH - 1, y: GRID_HEIGHT - 1 };

export const INITIAL_MONEY = 120;
export const INITIAL_LIVES = 15;

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS',
  BOSS_TITAN = 'BOSS_TITAN'
}

export const ENEMY_STATS = {
  [EnemyType.BASIC]: { hp: 25, speed: 0.9, reward: 5, color: '#4b5320', radius: 8, emoji: '🪖' }, // Infantry
  [EnemyType.FAST]: { hp: 15, speed: 1.7, reward: 8, color: '#c2b280', radius: 6, emoji: '🏍️' }, // Motorcycle
  [EnemyType.TANK]: { hp: 100, speed: 0.6, reward: 20, color: '#2c3539', radius: 10, emoji: '🚜' }, // Light Tank
  [EnemyType.BOSS]: { hp: 600, speed: 0.45, reward: 120, color: '#7c3f00', radius: 14, emoji: '🐅' }, // Heavy Panzer
  [EnemyType.BOSS_TITAN]: { hp: 1500, speed: 0.3, reward: 300, color: '#1a1c1e', radius: 18, emoji: '🕍' } // Super Fortress
};

export enum TowerType {
  WALL = 'WALL',
  TURRET = 'TURRET',
  SNIPER = 'SNIPER',
  RAPID = 'RAPID',
  ROCKET = 'ROCKET',
  TESLA = 'TESLA'
}

export const TOWER_STATS: Record<TowerType, {
  name: string; 
  cost: number; 
  range: number; 
  damage: number; 
  cooldown: number; 
  color: string; 
  description: string; 
}> = TOWER_STATS_DATA as any;

export const generateWave = (index: number) => {
  const baseHpMult = 1 + (index * 0.2); 
  const countMult = 1 + Math.floor(index / 4) * 0.15;
  
  const types = [
    EnemyType.BASIC, EnemyType.BASIC, EnemyType.FAST, 
    EnemyType.TANK, EnemyType.BASIC, EnemyType.FAST, 
    EnemyType.TANK, EnemyType.BOSS
  ];
  
  let type = types[index % types.length];
  if (type === EnemyType.BOSS && Math.floor(index / 8) % 2 !== 0) {
    type = EnemyType.BOSS_TITAN;
  }

  const baseStats = ENEMY_STATS[type];
  let count = 6 + Math.floor(index * 0.9);
  if (type === EnemyType.BOSS || type === EnemyType.BOSS_TITAN) count = 1 + Math.floor(index / 10);
  if (type === EnemyType.TANK) count = 2 + Math.floor(index / 3);
  
  return {
    type,
    count: Math.floor(count * countMult),
    hp: Math.floor(baseStats.hp * baseHpMult),
    interval: Math.max(12, 55 - Math.floor(index * 0.6)),
    reward: Math.floor(baseStats.reward * (1 + (index * 0.04)))
  };
};

export const WAVE_CONFIG = Array.from({ length: 100 }, (_, i) => generateWave(i));

export enum GameMode {
  MISSION = 'MISSION',
  ENDLESS = 'ENDLESS'
}