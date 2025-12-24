
import React, { useState, useEffect, useRef, MouseEvent, Suspense } from 'react';
import { 
  GRID_WIDTH, GRID_HEIGHT, START_POS, END_POS, 
  INITIAL_MONEY, INITIAL_LIVES, 
  TOWER_STATS, ENEMY_STATS, TowerType, EnemyType, PROJECTILE_SPEED, MAX_UPGRADE_LEVEL,
  GameMode, generateWave,
  ROCKET_START_SPEED, ROCKET_MAX_SPEED, ROCKET_ACCELERATION, ROCKET_TURN_SPEED
} from './constants';
import { Cell, Enemy, Tower, Projectile, FlowDirection, PassiveRocket } from './types';
import { calculateFlowField, isPathPossible } from './utils/pathfinding';
import { initAudio, playShootSound, playDeathSound, playRocketHitSound, setSoundEnabled } from './utils/audio';
import { GameScene } from './components/GameScene';
import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ScoreEntry {
  name: string;
  wave: number;
  money: number;
  mode: string;
  date: string;
}

interface WaveProgress {
  waveIndex: number;
  enemiesSpawned: number;
  timeSinceLastSpawn: number;
  complete: boolean;
  enemyHp: number; 
  enemyReward: number;
}

export default function App() {
  const [view, setView] = useState<'menu' | 'playing'>('menu');
  const [menuSubView, setMenuSubView] = useState<'splash' | 'mode_select'>('splash');
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [wave, setWave] = useState(0); 
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [unlimitedCash, setUnlimitedCash] = useState(false);
  
  const [mode, setMode] = useState<GameMode>(GameMode.MISSION);
  const [missionTarget, setMissionTarget] = useState<number>(10);

  const [soundOn, setSoundOn] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [localLeaderboard, setLocalLeaderboard] = useState<ScoreEntry[]>([]);

  const [buildType, setBuildType] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);

  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const flowFieldRef = useRef<FlowDirection[][]>([]);
  const gridRef = useRef<Cell[][]>([]);
  const frameRef = useRef<number>(0);
  const controlsRef = useRef<any>(null);
  
  const activeWavesRef = useRef<WaveProgress[]>([]);
  const [tick, setTick] = useState(0); // Used to force UI updates

  useEffect(() => {
    resetGame();
    loadLeaderboard();
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  const loadLeaderboard = () => {
    const saved = localStorage.getItem('frontline_ww2_scores');
    if (saved) {
      try {
        setLocalLeaderboard(JSON.parse(saved));
      } catch (e) {
        setLocalLeaderboard([]);
      }
    }
  };

  const saveScore = () => {
    const newEntry: ScoreEntry = {
      name: playerName || 'Unknown Soldier',
      wave: wave,
      money: money,
      mode: mode === GameMode.MISSION ? `Op ${missionTarget}` : 'Frontline',
      date: new Date().toLocaleDateString()
    };
    const updated = [...localLeaderboard, newEntry].sort((a, b) => {
        if (b.wave !== a.wave) return b.wave - a.wave;
        return b.money - a.money;
    }).slice(15);
    setLocalLeaderboard(updated);
    localStorage.setItem('frontline_ww2_scores', JSON.stringify(updated));
    setShowEntryModal(false);
    setShowLeaderboard(true);
  };

  const resetGame = () => {
    const newGrid: Cell[][] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const col: Cell[] = [];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        col.push({ x, y, isWall: false, towerId: null });
      }
      newGrid.push(col);
    }
    setGrid(newGrid);
    gridRef.current = newGrid;
    flowFieldRef.current = calculateFlowField(newGrid, END_POS);

    setMoney(unlimitedCash ? 99999999 : INITIAL_MONEY);
    setLives(INITIAL_LIVES);
    setWave(0);
    setGameOver(false);
    setGameWon(false);
    setGameActive(false);
    setIsPaused(false);
    setSelectedTowerId(null);
    setBuildType(null);
    setShowEntryModal(false);

    enemiesRef.current = [];
    projectilesRef.current = [];
    towersRef.current = [];
    activeWavesRef.current = [];
  };

  const adjustCamera = (yawDelta: number, pitchDelta: number) => {
    if (controlsRef.current) {
        const controls = controlsRef.current;
        const camera = controls.object;
        
        const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        
        spherical.theta -= yawDelta; 
        spherical.phi -= pitchDelta; 
        
        // Clamp pitch to reasonable values (prevent going underground or flipping)
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.2, spherical.phi));
        
        spherical.makeSafe();
        
        const newOffset = new THREE.Vector3().setFromSpherical(spherical);
        camera.position.copy(controls.target).add(newOffset);
        controls.update();
    }
  };

  const setCameraPreset = (type: 'TOP' | 'ISO' | 'ANGLE') => {
    if (controlsRef.current) {
        const controls = controlsRef.current;
        const camera = controls.object;
        
        // Reset target to center
        controls.target.set(0, 0, 0);

        if (type === 'TOP') {
            camera.position.set(0, 25, 0);
        } else if (type === 'ISO') {
            camera.position.set(-20, 20, 20);
        } else if (type === 'ANGLE') {
            camera.position.set(0, 15, 20);
        }
        
        controls.update();
    }
  };

  // Game Loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      if (gameOver || gameWon || isPaused) return;
      updateGame();
      setTick(prev => prev + 1); 
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameActive, gameOver, gameWon, isPaused, wave]);

  const updateGame = () => {
    frameRef.current++;
    handleWaveSpawning();
    if (gameActive) {
      moveEnemies();
      handleProjectiles();
      handleTowers();
      cleanupEnemies();
      checkWinLoss();
    } else {
      handleTowers(); // Allow passive animations (like idle turret rotation if implemented) or projectiles finishing
    }
  };

  const handleWaveSpawning = () => {
    const activeWaves = activeWavesRef.current;
    if (activeWaves.length === 0 && !gameActive) return;

    let allSpawningFinished = true;

    for (let i = 0; i < activeWaves.length; i++) {
        const wp = activeWaves[i];
        if (wp.complete) continue;
        
        allSpawningFinished = false;
        const currentWaveConfig = generateWave(wp.waveIndex);
        
        wp.timeSinceLastSpawn++;
        if (wp.timeSinceLastSpawn >= currentWaveConfig.interval) {
            spawnEnemy(currentWaveConfig.type, wp.enemyHp);
            wp.enemiesSpawned++;
            wp.timeSinceLastSpawn = 0;
            
            if (wp.enemiesSpawned >= currentWaveConfig.count) {
                wp.complete = true;
            }
        }
    }

    if (enemiesRef.current.length === 0 && allSpawningFinished && activeWaves.length > 0) {
        if (mode === GameMode.MISSION && activeWaves[activeWaves.length - 1].waveIndex >= missionTarget - 1) {
            setGameWon(true);
            setGameActive(false);
            setShowEntryModal(true);
        } else if (gameActive) {
            setGameActive(false);
        }
    }
  };

  const spawnEnemy = (type: EnemyType, hp: number) => {
    const flow = flowFieldRef.current[START_POS.x][START_POS.y];
    const enemy: Enemy = {
      id: generateId(),
      type,
      x: START_POS.x + 0.5 + (Math.random() - 0.5) * 0.1,
      y: START_POS.y + 0.5 + (Math.random() - 0.5) * 0.1,
      tx: START_POS.x + (flow.dist !== Infinity ? flow.dx : 0),
      ty: START_POS.y + (flow.dist !== Infinity ? flow.dy : 0),
      hp: hp,
      maxHp: hp,
      speed: ENEMY_STATS[type].speed,
      frozen: 0,
      pathIndex: 0,
      distanceTraveled: 0
    };
    enemiesRef.current.push(enemy);
  };

  const moveEnemies = () => {
    for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
      const enemy = enemiesRef.current[i];
      const distToEnd = Math.sqrt(Math.pow(enemy.x - (END_POS.x + 0.5), 2) + Math.pow(enemy.y - (END_POS.y + 0.5), 2));
      if (distToEnd < 0.5) {
        setLives(l => {
            const next = Math.max(0, l - 1);
            if (next === 0) {
              setGameOver(true);
              setGameActive(false);
              setShowEntryModal(true);
            }
            return next;
        });
        enemiesRef.current.splice(i, 1);
        continue;
      }
      const cx = Math.floor(enemy.x), cy = Math.floor(enemy.y);
      if (enemy.tx >= 0 && enemy.tx < GRID_WIDTH && enemy.ty >= 0 && enemy.ty < GRID_HEIGHT && gridRef.current[enemy.tx][enemy.ty].isWall) {
        if (gridRef.current[cx]?.[cy]?.isWall) { enemiesRef.current.splice(i, 1); continue; }
        const flow = flowFieldRef.current[cx][cy];
        if (flow.dist !== Infinity) { enemy.tx = cx + flow.dx; enemy.ty = cy + flow.dy; }
      }
      const dx = (enemy.tx + 0.5) - enemy.x, dy = (enemy.ty + 0.5) - enemy.y;
      const distToTarget = Math.sqrt(dx*dx + dy*dy), moveSpeed = enemy.speed * 0.055; 
      if (distToTarget <= moveSpeed) {
        enemy.x = enemy.tx + 0.5; enemy.y = enemy.ty + 0.5;
        enemy.distanceTraveled += distToTarget;
        const ncx = Math.floor(enemy.x), ncy = Math.floor(enemy.y);
        if (ncx >= 0 && ncx < GRID_WIDTH && ncy >= 0 && ncy < GRID_HEIGHT) {
            const flow = flowFieldRef.current[ncx][ncy];
            if (flow.dist !== Infinity) { enemy.tx = ncx + flow.dx; enemy.ty = ncy + flow.dy; }
        }
      } else {
        enemy.x += (dx / distToTarget) * moveSpeed;
        enemy.y += (dy / distToTarget) * moveSpeed;
        enemy.distanceTraveled += moveSpeed;
      }
    }
  };

  const handleTowers = () => {
    towersRef.current.forEach(tower => {
      const stats = TOWER_STATS[tower.type];
      let dMult = 0.25, rMult = 0.12, rMaxMult = 0.06, cMult = 0.75; 
      if (tower.type === TowerType.ROCKET) { dMult = 0.5; rMaxMult = 0.05; cMult = 0.8; }
      else if (tower.type === TowerType.TESLA) { dMult = 0.15; cMult = 0.7; }
      
      const damage = stats.damage * (1 + (tower.damageLevel * dMult));
      const range = stats.range * (1 + (tower.rangeLevel * (tower.type === TowerType.ROCKET ? rMaxMult : rMult)));
      const cooldownMax = stats.cooldown * Math.pow(cMult, tower.speedLevel);

      // Rocket special logic (Passive Rockets)
      if (tower.type === TowerType.ROCKET && tower.rangeLevel >= 3 && tower.speedLevel >= 2) {
        if (!tower.passiveRockets) tower.passiveRockets = [];
        if (tower.cooldownRemaining > 0) tower.cooldownRemaining--;
        if (tower.cooldownRemaining <= 0 && tower.passiveRockets.length < 5) {
          tower.cooldownRemaining = cooldownMax;
          playShootSound(TowerType.ROCKET);
          const spawnAngle = (tower.passiveRockets.length * Math.PI * 2) / 5;
          tower.passiveRockets.push({
            id: generateId(),
            x: tower.x + 0.5,
            y: tower.y + 0.5,
            targetId: null,
            state: 'deploying',
            angle: spawnAngle,
            rotation: spawnAngle, // Start facing outward
            currentSpeed: ROCKET_START_SPEED
          });
        }
        
        tower.passiveRockets.forEach(rocket => {
          if (rocket.state === 'deploying') {
            const targetOrbitX = tower.x + 0.5 + Math.cos(rocket.angle) * 2.0;
            const targetOrbitY = tower.y + 0.5 + Math.sin(rocket.angle) * 2.0;
            const dx = targetOrbitX - rocket.x, dy = targetOrbitY - rocket.y, dist = Math.sqrt(dx*dx + dy*dy);
            
            // Look towards target orbit position
            rocket.rotation = Math.atan2(dy, dx);
            
            if (dist < 0.1) {
                rocket.state = 'orbit'; 
            } else { 
                rocket.x += (dx / dist) * 0.12; 
                rocket.y += (dy / dist) * 0.12; 
            }
          }
          else if (rocket.state === 'orbit') {
            rocket.angle += 0.03; // Slower orbit
            // Calculate position on circle
            const targetX = tower.x + 0.5 + Math.cos(rocket.angle) * 2.0;
            const targetY = tower.y + 0.5 + Math.sin(rocket.angle) * 2.0;
            
            // Move towards circle point
            rocket.x += (targetX - rocket.x) * 0.1;
            rocket.y += (targetY - rocket.y) * 0.1;
            
            // Set rotation to tangent of circle
            rocket.rotation = rocket.angle + Math.PI / 2;

            if (gameActive) {
              const enemyInRange = enemiesRef.current.find(e => {
                const d = Math.sqrt(Math.pow(e.x - (tower.x + 0.5), 2) + Math.pow(e.y - (tower.y + 0.5), 2));
                return d <= range && !tower.passiveRockets?.some(r => r.targetId === e.id);
              });
              if (enemyInRange) { 
                rocket.targetId = enemyInRange.id; 
                rocket.state = 'pursuing'; 
                rocket.currentSpeed = ROCKET_START_SPEED;
              }
            }
          }
          else if (rocket.state === 'pursuing') {
            const target = enemiesRef.current.find(e => e.id === rocket.targetId);
            if (!target) { 
                rocket.state = 'orbit'; 
                rocket.targetId = null; 
            } else {
              const dx = target.x - rocket.x;
              const dy = target.y - rocket.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const targetAngle = Math.atan2(dy, dx);

              // Steering Behavior
              let diff = targetAngle - rocket.rotation;
              // Normalize angle to -PI to PI
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              
              // Turn towards target
              const turnAmount = Math.min(Math.abs(diff), ROCKET_TURN_SPEED);
              rocket.rotation += Math.sign(diff) * turnAmount;

              // Accelerate
              if (rocket.currentSpeed < ROCKET_MAX_SPEED) {
                  rocket.currentSpeed += ROCKET_ACCELERATION;
              }

              // Move forward based on current rotation
              rocket.x += Math.cos(rocket.rotation) * rocket.currentSpeed;
              rocket.y += Math.sin(rocket.rotation) * rocket.currentSpeed;

              // Hit detection
              if (dist < 0.4) {
                enemiesRef.current.forEach(e => { if (Math.sqrt(Math.pow(e.x - target.x, 2) + Math.pow(e.y - target.y, 2)) <= 2.2) e.hp -= damage; });
                playRocketHitSound();
                tower.passiveRockets = tower.passiveRockets?.filter(r => r.id !== rocket.id);
              }
            }
          }
        });
      }

      if (!gameActive) return;
      if (tower.type === TowerType.WALL) return;
      if (tower.type !== TowerType.ROCKET || (tower.rangeLevel < 3 || tower.speedLevel < 2)) {
        if (tower.cooldownRemaining > 0) tower.cooldownRemaining--;
        let targets: Enemy[] = [];
        if (tower.type === TowerType.TESLA) {
            const inRange = enemiesRef.current.filter(e => Math.sqrt(Math.pow(e.x - (tower.x + 0.5), 2) + Math.pow(e.y - (tower.y + 0.5), 2)) <= range);
            inRange.sort((a, b) => b.distanceTraveled - a.distanceTraveled);
            targets = inRange.slice(0, 4);
        } else {
            let best: Enemy | null = null, maxT = -1;
            for (const e of enemiesRef.current) {
              const d = Math.sqrt(Math.pow(e.x - (tower.x + 0.5), 2) + Math.pow(e.y - (tower.y + 0.5), 2));
              if (d <= range && e.distanceTraveled > maxT) { maxT = e.distanceTraveled; best = e; }
            }
            if (best) targets.push(best);
        }
        
        if (targets.length > 0) {
          const primaryTarget = targets[0], dx = primaryTarget.x - (tower.x + 0.5), dy = primaryTarget.y - (tower.y + 0.5);
          
          const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
          const currentAngle = tower.rotation;
          const delta = ((targetAngle - currentAngle + 540) % 360) - 180;
          const turnSpeed = 10; 
          
          if (Math.abs(delta) < turnSpeed) {
            tower.rotation += delta;
          } else {
            tower.rotation += Math.sign(delta) * turnSpeed;
          }

          const alignmentThreshold = tower.type === TowerType.RAPID ? 30 : 20;

          if (Math.abs(delta) < alignmentThreshold && tower.cooldownRemaining <= 0) {
            tower.cooldownRemaining = cooldownMax;
            playShootSound(tower.type);
            
            targets.forEach(t => {
                const isRocket = tower.type === TowerType.ROCKET;
                const spawnRotation = (tower.rotation * Math.PI) / 180;
                
                projectilesRef.current.push({ 
                    id: generateId(), 
                    x: tower.x + 0.5, 
                    y: tower.y + 0.5, 
                    startX: tower.x + 0.5, 
                    startY: tower.y + 0.5, 
                    targetId: t.id, 
                    damage, 
                    // Rockets start slow, others fast
                    speed: isRocket ? ROCKET_START_SPEED : (tower.type === TowerType.TESLA ? 1.0 : PROJECTILE_SPEED * 1.2), 
                    color: stats.color, 
                    hit: false, 
                    age: 0, 
                    splashRadius: isRocket ? 2.2 : 0, 
                    isBeam: tower.type === TowerType.TESLA, 
                    isRocket: isRocket,
                    rotation: spawnRotation
                });
            });
          }
        }
      }
    });
  };

  const handleProjectiles = () => {
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const proj = projectilesRef.current[i];
      proj.age++; 
      if (proj.isBeam && proj.age > 10) { projectilesRef.current.splice(i, 1); continue; }
      const target = enemiesRef.current.find(e => e.id === proj.targetId);
      
      // If target is dead, rockets fly off in current direction, others fizzle
      if (!target) { 
          if (proj.isRocket) {
            proj.x += Math.cos(proj.rotation || 0) * proj.speed;
            proj.y += Math.sin(proj.rotation || 0) * proj.speed;
            if (proj.age > 100) projectilesRef.current.splice(i, 1);
          } else {
            projectilesRef.current.splice(i, 1); 
          }
          continue; 
      }
      
      const dx = target.x - proj.x, dy = target.y - proj.y, dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < (proj.isBeam ? 12.0 : 0.5)) {
        if (!proj.hit) {
            if (proj.isRocket) {
                playRocketHitSound();
            }

            if (proj.splashRadius && proj.splashRadius > 0) {
                enemiesRef.current.forEach(e => { if (Math.sqrt(Math.pow(e.x - target.x, 2) + Math.pow(e.y - target.y, 2)) <= proj.splashRadius!) e.hp -= proj.damage; });
            } else { target.hp -= proj.damage; }
            proj.hit = true;
        }
        if (!proj.isBeam) projectilesRef.current.splice(i, 1);
      } else { 
          if (proj.isRocket) {
              // Active Rocket Steering Logic
              const targetAngle = Math.atan2(dy, dx);
              
              if (proj.rotation === undefined) proj.rotation = targetAngle;

              let diff = targetAngle - proj.rotation;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              
              const turnAmount = Math.min(Math.abs(diff), ROCKET_TURN_SPEED);
              proj.rotation += Math.sign(diff) * turnAmount;

              // Accelerate
              if (proj.speed < ROCKET_MAX_SPEED) {
                  proj.speed += ROCKET_ACCELERATION;
              }

              proj.x += Math.cos(proj.rotation) * proj.speed;
              proj.y += Math.sin(proj.rotation) * proj.speed;
          } else {
              // Standard homing for bullets (instant turn)
              proj.x += (dx / dist) * proj.speed; 
              proj.y += (dy / dist) * proj.speed; 
          }
      }
    }
  };

  const cleanupEnemies = () => {
    for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
        const e = enemiesRef.current[j];
        if (e.hp <= 0) {
            playDeathSound();
            const reward = activeWavesRef.current.find(aw => aw.waveIndex === wave - 1)?.enemyReward || 5;
            setMoney(m => m + reward);
            enemiesRef.current.splice(j, 1);
        }
    }
  };

  const checkWinLoss = () => { if (lives <= 0) { setGameOver(true); setGameActive(false); setShowEntryModal(true); } };

  const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); setSelectedTowerId(null); setBuildType(null); };

  const toggleSound = () => { const newState = !soundOn; setSoundOn(newState); setSoundEnabled(newState); if (newState) initAudio(); };
  const toggleFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); };
  
  const startGame = (selectedMode: GameMode, target: number = 10) => { 
    setMode(selectedMode); 
    setMissionTarget(target);
    initAudio(); 
    resetGame(); 
    setView('playing'); 
  };

  const handleCellClick = (x: number, y: number) => {
    if (gameOver || gameWon || isPaused) return;
    initAudio(); 
    const cell = grid[x][y];
    if (cell.towerId) { setSelectedTowerId(cell.towerId); setBuildType(null); return; }
    if (selectedTowerId) { setSelectedTowerId(null); return; }
    if (!buildType || cell.isWall || (x === START_POS.x && y === START_POS.y) || (x === END_POS.x && y === END_POS.y)) return;
    const stats = TOWER_STATS[buildType];
    if (money < stats.cost) return;
    if (enemiesRef.current.some(e => Math.abs(e.x - (x + 0.5)) < 0.6 && Math.abs(e.y - (y + 0.5)) < 0.6)) return;
    const tempGrid = grid.map(col => col.map(c => ({ ...c })));
    tempGrid[x][y].isWall = true;
    if (!isPathPossible(tempGrid, START_POS, END_POS)) return;
    setMoney(m => m - stats.cost);
    const newGrid = [...grid];
    newGrid[x] = [...newGrid[x]];
    newGrid[x][y] = { ...newGrid[x][y], isWall: true, towerId: generateId() };
    setGrid(newGrid);
    towersRef.current.push({ id: newGrid[x][y].towerId!, type: buildType, x, y, cooldownRemaining: 0, totalDamageDealt: 0, damageLevel: 0, rangeLevel: 0, speedLevel: 0, investment: stats.cost, rotation: 0 });
    flowFieldRef.current = calculateFlowField(newGrid, END_POS);
  };

  const handleUpgrade = (type: 'damage' | 'range' | 'speed', updateMode: 'once' | 'max' = 'once') => {
    if (!selectedTowerId) return;
    const tower = towersRef.current.find(t => t.id === selectedTowerId);
    if (!tower) return;
    const stats = TOWER_STATS[tower.type], getCostForLevel = (lvl: number) => Math.floor(stats.cost * 0.5 * (lvl + 1));
    if (updateMode === 'once') {
        const currentLvl = type === 'damage' ? tower.damageLevel : type === 'range' ? tower.rangeLevel : tower.speedLevel;
        if (currentLvl >= MAX_UPGRADE_LEVEL) return;
        const cost = getCostForLevel(currentLvl);
        if (money >= cost) { setMoney(prev => prev - cost); tower.investment += cost; if (type === 'damage') tower.damageLevel++; else if (type === 'range') tower.rangeLevel++; else tower.speedLevel++; setTick(t => t + 1); }
    } else {
        let totalCost = 0, levelsGained = 0, currentLvl = type === 'damage' ? tower.damageLevel : type === 'range' ? tower.rangeLevel : tower.speedLevel, tempMoney = money;
        while (currentLvl < MAX_UPGRADE_LEVEL) {
            const cost = getCostForLevel(currentLvl);
            if (tempMoney >= cost) { tempMoney -= cost; totalCost += cost; levelsGained++; currentLvl++; } else break;
        }
        if (levelsGained > 0) { setMoney(prev => prev - totalCost); tower.investment += totalCost; if (type === 'damage') tower.damageLevel += levelsGained; else if (type === 'range') tower.rangeLevel += levelsGained; else tower.speedLevel += levelsGained; setTick(t => t + 1); }
    }
  };

  const handleSell = () => {
    if (!selectedTowerId) return;
    const idx = towersRef.current.findIndex(t => t.id === selectedTowerId);
    if (idx === -1) return;
    const tower = towersRef.current[idx];
    setMoney(m => m + Math.floor(tower.investment * 0.7));
    const { x, y } = tower;
    towersRef.current.splice(idx, 1);
    const newGrid = [...grid];
    newGrid[x] = [...newGrid[x]];
    newGrid[x][y] = { ...newGrid[x][y], isWall: false, towerId: null };
    setGrid(newGrid);
    flowFieldRef.current = calculateFlowField(newGrid, END_POS);
    setSelectedTowerId(null);
  };

  const startNextWave = () => { 
    initAudio(); 
    const currentConfig = generateWave(wave);
    activeWavesRef.current.push({
      waveIndex: wave,
      enemiesSpawned: 0,
      timeSinceLastSpawn: 1000, 
      complete: false,
      enemyHp: currentConfig.hp,
      enemyReward: currentConfig.reward
    });
    setWave(prev => prev + 1);
    setGameActive(true);
    setIsPaused(false);
  };

  const renderSidebar = () => {
    if (selectedTowerId) {
        const tower = towersRef.current.find(t => t.id === selectedTowerId);
        if (!tower) return null;
        const stats = TOWER_STATS[tower.type], sellV = Math.floor(tower.investment * 0.7);
        let dMult = 0.25, rMult = 0.12, rMaxMult = 0.06, cMult = 0.75; 
        if (tower.type === TowerType.ROCKET) { dMult = 0.5; rMaxMult = 0.05; cMult = 0.8; }
        else if (tower.type === TowerType.TESLA) { dMult = 0.15; cMult = 0.7; }
        const curDamage = stats.damage * (1 + (tower.damageLevel * dMult)), curRange = stats.range * (1 + (tower.rangeLevel * (tower.type === TowerType.ROCKET ? rMaxMult : rMult))), curCooldown = stats.cooldown * Math.pow(cMult, tower.speedLevel), curRate = (60 / curCooldown).toFixed(1);
        const attributes = [ { id: 'damage', label: 'Firepower', current: tower.damageLevel, val: curDamage.toFixed(1) }, { id: 'range', label: 'Detection', current: tower.rangeLevel, val: curRange.toFixed(1) }, { id: 'speed', label: 'Cycle Rate', current: tower.speedLevel, val: `${curRate}/s` } ];
        return (
          <div className="flex flex-col h-full pointer-events-auto border-l border-gray-800 bg-[#121416]">
              <div className="p-4 border-b border-gray-800 bg-gray-900/40">
                  <div className="flex justify-between items-center mb-1"><h2 className="text-xl font-black text-gray-100 uppercase tracking-tighter">{stats.name}</h2><button onClick={() => setSelectedTowerId(null)} className="text-gray-600 hover:text-white p-1">✕</button></div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Unit Classification: Tactical</div>
              </div>
              <div className="p-4 space-y-4 border-b border-gray-800">
                  {attributes.map(attr => (
                    <div key={attr.id} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest"><span>{attr.label}: <span className="text-gray-100">{attr.val}</span></span><span>Lvl {attr.current}</span></div>
                        <div className="h-1.5 w-full bg-gray-950 rounded flex overflow-hidden">{Array.from({ length: MAX_UPGRADE_LEVEL }).map((_, i) => (<div key={i} className={`flex-1 border-r border-gray-900 last:border-0 ${i < attr.current ? 'bg-orange-500' : 'bg-gray-800'}`} />))}</div>
                    </div>
                  ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {attributes.map(attr => {
                      const cost = attr.current < MAX_UPGRADE_LEVEL ? Math.floor(stats.cost * 0.5 * (attr.current + 1)) : null, isMaxed = attr.current >= MAX_UPGRADE_LEVEL;
                      return (
                        <div key={attr.id} className="space-y-2">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-500 uppercase">{attr.label}</span>{isMaxed && <span className="text-[9px] bg-green-900/30 text-green-500 px-1.5 rounded font-black border border-green-800/50">MAXED</span>}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button disabled={isMaxed || money < (cost || 0)} onClick={() => handleUpgrade(attr.id as any, 'once')} className={`py-2 text-[10px] font-black rounded border flex flex-col items-center justify-center transition-all ${isMaxed ? 'bg-gray-900 border-gray-800 text-gray-700' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 active:bg-gray-600'}`}><span>UPGRADE X1</span><span className="text-yellow-600 font-mono">{isMaxed ? '---' : `$${cost}`}</span></button>
                                <button disabled={isMaxed || money < (cost || 0)} onClick={() => handleUpgrade(attr.id as any, 'max')} className={`py-2 text-[10px] font-black rounded border flex flex-col items-center justify-center transition-all ${isMaxed ? 'bg-gray-900 border-gray-800 text-gray-700' : 'bg-orange-950/20 hover:bg-orange-950/40 border-orange-900/50 text-orange-400 active:bg-orange-900'}`}><span>PRIORITY</span><span className="text-orange-600">MAX OUT</span></button>
                            </div>
                        </div>
                      );
                  })}
              </div>
              <div className="p-4 border-t border-gray-800 bg-gray-900/20"><button onClick={handleSell} className="w-full py-3 bg-gray-950 hover:bg-red-950/40 border border-gray-800 text-gray-500 font-bold rounded flex justify-between px-4 transition-colors"><span>Decommission</span><span>+${sellV}</span></button></div>
          </div>
        );
    }
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pointer-events-auto border-l border-gray-800 bg-[#121416]">
            <h2 className="text-sm font-black text-gray-400 mb-4 border-b border-gray-800 pb-2 uppercase tracking-[0.2em]">Deployment Ops</h2>
            {Object.values(TowerType).map((type) => {
              const stats = TOWER_STATS[type];
              return ( <button key={type} onClick={() => { setBuildType(type); setSelectedTowerId(null); }} className={`w-full flex flex-col p-3 rounded border-2 text-left transition-all ${buildType === type ? 'border-orange-600 bg-orange-600/10' : 'border-gray-800 bg-gray-900/30 hover:bg-gray-800 hover:border-gray-700'}`}><div className="flex justify-between w-full font-black uppercase text-xs"><span>{stats.name}</span><span className="text-green-600 font-mono">${stats.cost}</span></div><div className="text-[10px] text-gray-500 mt-1 uppercase font-bold">{stats.description}</div></button> );
            })}
        </div>
    );
  };

  if (view === 'menu') {
    return (
      <div className="h-screen w-full bg-[#121416] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Simple visual background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2c3539_0%,_#121416_70%)]" />
        
        <div className="z-10 text-center space-y-12 max-w-4xl w-full flex flex-col items-center">
          <div className="relative">
            <h1 className="text-7xl font-black text-gray-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4 uppercase italic tracking-tighter"> 
              Frontline Defense 
            </h1>
            <div className="bg-orange-600 text-white px-4 py-1 text-xs font-black tracking-[0.5em] absolute -bottom-2 right-0 rotate-1 shadow-xl">TACTICAL COMMAND</div> 
          </div>
          
          {menuSubView === 'splash' ? (
            <div className="space-y-6 w-full max-w-sm flex flex-col">
              <button 
                onClick={() => setMenuSubView('mode_select')}
                className="group relative w-full py-7 bg-orange-700 hover:bg-orange-600 text-white font-black text-2xl rounded shadow-2xl transition transform active:scale-95 border-b-4 border-orange-900 flex items-center justify-center gap-4 overflow-hidden"
              >
                <span>DEPLOY TO FRONT</span>
                <span className="text-3xl opacity-50">⚡</span>
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowLeaderboard(true)} className="py-4 bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-100 hover:border-gray-600 rounded font-black transition flex items-center justify-center gap-2 uppercase text-xs tracking-widest">Intelligence</button>
                <button onClick={toggleSound} className={`py-4 rounded border font-black transition flex items-center justify-center gap-2 uppercase text-xs tracking-widest ${soundOn ? 'bg-gray-900 border-orange-900/50 text-orange-600' : 'bg-gray-950 border-gray-800 text-gray-600'}`}>
                  {soundOn ? 'Radio On' : 'Radio Off'}
                </button>
              </div>

              <button onClick={toggleFullscreen} className="w-full py-3 bg-gray-950 border border-gray-900 text-gray-700 hover:text-gray-400 rounded font-bold transition uppercase tracking-widest text-[10px]">
                {isFullscreen ? 'Exit Combat Zone' : 'Full Screen View'}
              </button>
            </div>
          ) : (
            <div className="w-full animate-in fade-in zoom-in duration-300 max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-lg space-y-6 flex flex-col h-full shadow-2xl">
                  <div className="space-y-2 text-left">
                    <h2 className="text-xl font-black text-orange-600 uppercase tracking-widest italic">Campaign Ops</h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold leading-tight">Structured skirmishes with set objectives and defined end states.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 flex-1">
                    {[15, 30, 50].map(val => (
                       <button key={val} onClick={() => startGame(GameMode.MISSION, val)} className="py-5 bg-gray-950/60 hover:bg-gray-800 text-gray-300 font-black rounded transition-all border border-gray-800 group flex justify-between px-6 items-center">
                        <div className="flex flex-col items-start">
                          <span className="text-base uppercase tracking-tighter">Operation {val}</span>
                          <span className="text-[9px] text-gray-600 group-hover:text-gray-400">Survival Goal: {val} Waves</span>
                        </div>
                        <span className="bg-gray-900 group-hover:bg-orange-700 text-gray-600 group-hover:text-white px-3 py-1 rounded text-[10px] font-black border border-gray-800">DEPLOY</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-lg space-y-6 flex flex-col h-full shadow-2xl">
                   <div className="space-y-2 text-left">
                    <h2 className="text-xl font-black text-gray-400 uppercase tracking-widest italic">Endless War</h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold leading-tight">Defend until total collapse. Enemy pressure increases exponentially.</p>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <button onClick={() => startGame(GameMode.ENDLESS)} className="w-full py-16 bg-gray-950 hover:bg-orange-950/30 text-gray-100 font-black text-3xl rounded shadow-2xl transition transform active:scale-95 border-2 border-gray-800 flex flex-col items-center gap-3">
                      <span className="tracking-tighter uppercase italic">Total Defense</span>
                      <span className="text-[9px] font-bold text-orange-600 uppercase tracking-[0.4em] opacity-80">No Evacuation Authorized</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-12 flex flex-col items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${unlimitedCash ? 'border-orange-600 bg-orange-600/20 shadow-[0_0_15px_rgba(234,88,12,0.3)]' : 'border-gray-800 bg-gray-950 hover:border-gray-700'}`}>
                    {unlimitedCash && <div className="w-3 h-3 bg-orange-600 shadow-[0_0_10px_orange]" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={unlimitedCash} 
                    onChange={() => setUnlimitedCash(!unlimitedCash)} 
                  />
                  <span className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${unlimitedCash ? 'text-orange-500' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    Unlimited Cash Flow
                  </span>
                </label>

                <button 
                  onClick={() => setMenuSubView('splash')}
                  className="px-10 py-3 bg-gray-950 border border-gray-900 text-gray-700 hover:text-gray-300 hover:border-gray-700 rounded-full font-black transition flex items-center gap-3 uppercase text-[10px] tracking-[0.3em]"
                >
                  <span>⬅</span>
                  <span>Return to HQ</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {showLeaderboard && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-6">
            <div className="bg-[#121416] border border-gray-800 rounded-lg w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/20"><h2 className="text-lg font-black text-orange-600 uppercase italic">Intelligence Brief</h2><button onClick={() => setShowLeaderboard(false)} className="text-gray-700 hover:text-white">✕</button></div>
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                {localLeaderboard.length === 0 ? <div className="text-center text-gray-700 py-12 uppercase text-[10px] font-bold tracking-widest">No service records found.</div> : localLeaderboard.map((r, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-gray-950 border border-gray-900 rounded">
                    <span className="font-black text-gray-700 w-10">#{i+1}</span>
                    <div className="flex-1 flex flex-col">
                      <span className="text-gray-300 font-black uppercase tracking-tight">{r.name}</span>
                      <span className="text-[8px] text-gray-600 uppercase font-bold">{r.mode} • {r.date}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-orange-600 font-black italic text-sm">WAVE {r.wave}</span>
                      <span className="text-gray-700 text-[9px] font-mono">${r.money.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-900/10 text-center"><button onClick={() => setShowLeaderboard(false)} className="text-gray-500 hover:text-gray-300 font-black uppercase tracking-[0.2em] text-[10px]">Return to Base</button></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b1121] text-gray-300 font-sans select-none overflow-hidden" onContextMenu={handleContextMenu}>
      {/* HUD Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#121416] border-b border-gray-800 shadow-2xl z-30 relative backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button onClick={() => setIsPaused(true)} className="bg-gray-900 hover:bg-gray-800 text-gray-500 px-4 py-2 rounded border border-gray-800 text-[10px] font-black uppercase tracking-widest transition-colors">Abort Ops</button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic leading-none text-gray-100 uppercase tracking-tighter">Frontline Defense</h1>
            <span className="text-[8px] text-orange-700 font-black tracking-[0.4em] uppercase">{mode === GameMode.MISSION ? `Mission Objective: ${missionTarget} Waves` : 'Operation: Total Defense'}</span>
          </div>
        </div>
        <div className="flex gap-12 bg-gray-950 px-8 py-2 rounded-full border border-gray-900 shadow-inner">
            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Wave Status</span><span className="text-xl font-black text-orange-600 italic">{Math.max(1, wave)}</span></div>
            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Defenders</span><span className="text-xl font-black text-gray-200">{lives}</span></div>
            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Reserve Funds</span><span className="text-xl font-black text-green-700 font-mono">${money.toLocaleString()}</span></div>
        </div>
        <div>
           {(mode === GameMode.ENDLESS || wave < missionTarget) ? (
             <button onClick={startNextWave} className="px-10 py-3 bg-orange-700 hover:bg-orange-600 text-white font-black rounded shadow-xl transform transition active:scale-95 uppercase tracking-widest text-[11px] border-b-4 border-orange-900">
                {wave === 0 ? 'Commence Op' : 'Next Wave'}
             </button>
           ) : (
             <div className="px-10 py-3 bg-gray-900 rounded border border-gray-800 text-gray-600 font-black tracking-widest uppercase text-[11px] italic">Sector Secured</div>
           )}
        </div>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Tactical Map (3D Area) - Now Canvas */}
        <div className="flex-1 bg-[#121416] relative flex items-center justify-center scene-container">
            
            {/* Camera Controls Overlay */}
            <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-auto">
                <div className="flex gap-1 mb-2">
                    <button onClick={() => setCameraPreset('TOP')} className="px-3 py-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-400 rounded text-[9px] font-black uppercase tracking-widest">TOP</button>
                    <button onClick={() => setCameraPreset('ISO')} className="px-3 py-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-400 rounded text-[9px] font-black uppercase tracking-widest">ISO</button>
                    <button onClick={() => setCameraPreset('ANGLE')} className="px-3 py-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-gray-400 rounded text-[9px] font-black uppercase tracking-widest">SIDE</button>
                </div>
                
                <div className="flex flex-col gap-2 items-center">
                    <button onClick={() => adjustCamera(0, 0.15)} className="w-10 h-10 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 rounded flex items-center justify-center text-gray-400 active:scale-95 transition">
                        <span className="transform rotate-180 text-xl font-black">▲</span>
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => adjustCamera(0.15, 0)} className="w-10 h-10 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 rounded flex items-center justify-center text-gray-400 active:scale-95 transition">
                            <span className="transform -rotate-90 text-xl font-black">▲</span>
                        </button>
                        <button onClick={() => adjustCamera(-0.15, 0)} className="w-10 h-10 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 rounded flex items-center justify-center text-gray-400 active:scale-95 transition">
                            <span className="transform rotate-90 text-xl font-black">▲</span>
                        </button>
                    </div>
                    <button onClick={() => adjustCamera(0, -0.15)} className="w-10 h-10 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 rounded flex items-center justify-center text-gray-400 active:scale-95 transition">
                        <span className="text-xl font-black">▲</span>
                    </button>
                </div>
            </div>

            {isPaused && !gameOver && !gameWon && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md">
                <div className="bg-[#121416] border border-gray-800 p-10 rounded-lg w-full max-w-sm shadow-2xl flex flex-col space-y-5">
                  <h2 className="text-2xl font-black text-center text-gray-100 uppercase italic mb-4">Command Paused</h2>
                  <button onClick={() => setIsPaused(false)} className="w-full py-4 bg-orange-700 hover:bg-orange-600 text-white rounded font-black transition-colors uppercase tracking-widest text-xs border-b-4 border-orange-900">Return to Front</button>
                  <button onClick={toggleSound} className={`w-full py-4 rounded font-black border transition-colors uppercase tracking-widest text-xs ${soundOn ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-gray-900 border-red-900/50 text-red-600'}`}>
                    {soundOn ? 'Disable Comms' : 'Enable Comms'}
                  </button>
                  <button onClick={resetGame} className="w-full py-4 bg-gray-950 hover:bg-gray-900 border border-gray-800 text-gray-600 rounded font-black transition-colors uppercase tracking-widest text-xs">Full Tactical Reset</button>
                  <button onClick={() => { setView('menu'); setMenuSubView('splash'); setIsPaused(false); }} className="w-full py-4 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 rounded font-black text-red-600 transition-colors uppercase tracking-widest text-xs">Abandon Sector</button>
                </div>
              </div>
            )}
            
            {showEntryModal && (
              <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                <div className="bg-[#121416] border border-gray-800 rounded-lg w-full max-w-sm overflow-hidden shadow-2xl p-10 space-y-8">
                  <div className="text-center space-y-2">
                    <div className={`text-4xl font-black uppercase italic ${gameWon ? 'text-green-600' : 'text-orange-700'}`}>{gameWon ? 'Op Success' : 'Op Failure'}</div>
                    <div className="text-[10px] text-gray-600 uppercase font-black tracking-[0.3em]">Sector Assessment Complete</div>
                  </div>
                  <div className="flex justify-between bg-gray-950 p-6 rounded border border-gray-900 shadow-inner">
                    <div className="text-center flex-1"><div className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Final Rank</div><div className="text-3xl font-black text-orange-600 italic">W{wave}</div></div>
                    <div className="w-px bg-gray-800 h-10 self-center" />
                    <div className="text-center flex-1"><div className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Funds Spent</div><div className="text-2xl font-black text-gray-200 font-mono">${money.toLocaleString()}</div></div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em]">Sign Service Record</label>
                    <input autoFocus maxLength={15} value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="SOLDIER NAME" className="w-full bg-black border border-gray-800 p-5 rounded text-white font-black tracking-widest focus:border-orange-900 outline-none uppercase text-sm" />
                  </div>
                  <div className="space-y-3 pt-4">
                    <button onClick={saveScore} className="w-full py-5 bg-orange-700 rounded text-white font-black tracking-widest hover:bg-orange-600 active:scale-95 transition shadow-xl border-b-4 border-orange-900 uppercase">Archive Report</button>
                    <button onClick={() => { setShowEntryModal(false); setView('menu'); setMenuSubView('splash'); }} className="w-full py-3 text-gray-700 font-black hover:text-gray-400 transition uppercase text-[10px] tracking-widest">Skip Debrief</button>
                  </div>
                </div>
              </div>
            )}

            <Canvas shadows camera={{ position: [0, 15, 20], fov: 45 }}>
                <Suspense fallback={<Text color="white">Loading Assets...</Text>}>
                    <GameScene 
                        grid={gridRef.current}
                        enemies={enemiesRef.current}
                        projectiles={projectilesRef.current}
                        towers={towersRef.current}
                        selectedTowerId={selectedTowerId}
                        onCellClick={handleCellClick}
                        gameActive={gameActive}
                        buildType={buildType}
                        controlsRef={controlsRef}
                    />
                </Suspense>
            </Canvas>
        </div>

        {/* Sidebar Build Menu */}
        <div className="w-80 bg-[#121416] flex flex-col z-40 shadow-2xl relative">
            {renderSidebar()}
        </div>
      </div>
    </div>
  );
}