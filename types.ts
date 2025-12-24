
import React from 'react';
import { EnemyType, TowerType } from './constants';

// Declare R3F intrinsic elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      fog: any;
      group: any;
      mesh: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      cylinderGeometry: any;
      sphereGeometry: any;
      primitive: any;
      ringGeometry: any;
      boxGeometry: any;
      coneGeometry: any;
      torusGeometry: any;
      capsuleGeometry: any;
    }
  }
}

export interface Point {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number; 
  y: number;
  tx: number; 
  ty: number; 
  hp: number;
  maxHp: number;
  speed: number;
  frozen: number; 
  pathIndex: number; 
  distanceTraveled: number; 
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  startX: number; 
  startY: number; 
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  hit: boolean;
  age: number; 
  splashRadius?: number; 
  isBeam?: boolean; 
  isRocket?: boolean;
  rotation?: number; // Y-axis rotation in radians
}

export interface PassiveRocket {
  id: string;
  x: number;
  y: number;
  targetId: string | null;
  angle: number; // Orbit angle
  rotation: number; // Actual facing rotation
  state: 'deploying' | 'orbit' | 'pursuing';
  currentSpeed: number;
}

export interface Tower {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  cooldownRemaining: number;
  totalDamageDealt: number;
  rotation: number; 
  
  damageLevel: number;
  rangeLevel: number;
  speedLevel: number;
  investment: number; 

  passiveRockets?: PassiveRocket[];
}

export interface Cell {
  x: number;
  y: number;
  isWall: boolean;
  towerId: string | null;
}

export interface FlowDirection {
  dx: number;
  dy: number;
  dist: number; 
}