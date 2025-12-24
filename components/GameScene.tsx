
import React, { useMemo } from 'react';
import { Text, MapControls, Stars, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Cell, Enemy, Projectile, Tower, PassiveRocket } from '../types';
import { GRID_WIDTH, GRID_HEIGHT, ENEMY_STATS, START_POS, END_POS, EnemyType } from '../constants';
import { TowerRenderer, MissileBody } from './TowerRenderer';
import { BattlefieldMap } from './BattlefieldMap';

interface GameSceneProps {
    grid: Cell[][];
    enemies: Enemy[];
    projectiles: Projectile[];
    towers: Tower[];
    selectedTowerId: string | null;
    onCellClick: (x: number, y: number) => void;
    gameActive: boolean;
    buildType: any;
    controlsRef: any;
}

const EnemyModel = ({ type, color, hp, maxHp }: { type: EnemyType, color: string, hp: number, maxHp: number }) => {
    const scale = hp / maxHp;
    
    const renderShape = () => {
        switch (type) {
            case EnemyType.BASIC: // Infantry - Capsule
                return (
                    <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
                        <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
                        <meshStandardMaterial color={color} />
                    </mesh>
                );
            case EnemyType.FAST: // Motorcycle - Box
                return (
                    <group>
                        <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
                            <boxGeometry args={[0.2, 0.3, 0.6]} />
                            <meshStandardMaterial color={color} />
                        </mesh>
                        <mesh position={[0, 0.1, 0.2]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.1, 0.1, 0.1]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                        <mesh position={[0, 0.1, -0.2]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.1, 0.1, 0.1]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                    </group>
                );
            case EnemyType.TANK: // Tank - Composite
                return (
                    <group>
                        {/* Hull */}
                        <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
                            <boxGeometry args={[0.5, 0.25, 0.7]} />
                            <meshStandardMaterial color={color} roughness={0.7} />
                        </mesh>
                        {/* Turret */}
                        <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
                            <boxGeometry args={[0.3, 0.15, 0.4]} />
                            <meshStandardMaterial color={color} roughness={0.7} />
                        </mesh>
                        {/* Barrel */}
                        <mesh position={[0, 0.4, 0.4]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.04, 0.04, 0.6]} />
                            <meshStandardMaterial color="#222" />
                        </mesh>
                    </group>
                );
            case EnemyType.BOSS: // Heavy Tank
            case EnemyType.BOSS_TITAN: // Titan
                const isTitan = type === EnemyType.BOSS_TITAN;
                const sizeMult = isTitan ? 1.5 : 1.2;
                return (
                    <group scale={sizeMult}>
                         <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
                            <boxGeometry args={[0.6, 0.3, 0.8]} />
                            <meshStandardMaterial color={color} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
                            <boxGeometry args={[0.4, 0.25, 0.5]} />
                            <meshStandardMaterial color={color} />
                        </mesh>
                        <mesh position={[0.15, 0.5, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.06, 0.06, 0.8]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                        <mesh position={[-0.15, 0.5, 0.5]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.06, 0.06, 0.8]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                    </group>
                );
            default:
                return (
                    <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
                        <sphereGeometry args={[0.3]} />
                        <meshStandardMaterial color={color} />
                    </mesh>
                );
        }
    };

    return (
        <group>
            {renderShape()}
            {/* HP Bar */}
            <group position={[0, 0.8, 0]} rotation={[0, 0, 0]}>
                <mesh position={[0, 0, 0]}>
                    <planeGeometry args={[0.8, 0.1]} />
                    <meshBasicMaterial color="black" side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[-0.4 + (0.4 * scale), 0, 0.01]}>
                    <planeGeometry args={[0.8 * scale, 0.08]} />
                    <meshBasicMaterial color={scale < 0.3 ? '#ef4444' : '#22c55e'} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </group>
    );
};

export const GameScene: React.FC<GameSceneProps> = ({ 
    grid, 
    enemies, 
    projectiles, 
    towers, 
    selectedTowerId, 
    onCellClick, 
    buildType,
    controlsRef
}) => {
    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight 
                position={[20, 30, 15]} 
                intensity={1.5} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
            />
            <Environment preset="night" />
            <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            <fog attach="fog" args={['#121416', 5, 55]} />

            {/* Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#0a0c0e" roughness={0.8} />
            </mesh>

            {/* Battlefield Map - positioned at center, scaled to fit grid */}
            <BattlefieldMap
                position={[0, 0, 0]}
                scale={1}
            />

            <group position={[-GRID_WIDTH / 2, 0, -GRID_HEIGHT / 2]}>
                {/* GRID */}
                {grid.map((col: Cell[], x: number) => col.map((cell: Cell, y: number) => {
                     const isStart = x === START_POS.x && y === START_POS.y;
                     const isEnd = x === END_POS.x && y === END_POS.y;
                     const tower = cell.towerId ? towers.find((t: Tower) => t.id === cell.towerId) : null;
                     const isSelected = cell.towerId === selectedTowerId;
                     
                     return (
                        <group key={`${x}-${y}`} position={[x, 0, y]}>
                            {/* Cell Base */}
                            <mesh 
                                rotation={[-Math.PI / 2, 0, 0]} 
                                position={[0, 0.01, 0]}
                                receiveShadow
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCellClick(x, y);
                                }}
                                onPointerOver={(e) => {
                                    e.stopPropagation();
                                    document.body.style.cursor = 'pointer';
                                }}
                                onPointerOut={() => {
                                    document.body.style.cursor = 'default';
                                }}
                            >
                                <planeGeometry args={[0.95, 0.95]} />
                                <meshStandardMaterial
                                    color={isStart ? '#15803d' : isEnd ? '#b91c1c' : cell.isWall ? '#000000' : '#1f2937'}
                                    opacity={cell.isWall ? 0 : 0.25}
                                    transparent
                                    roughness={0.8}
                                    depthWrite={false}
                                />
                            </mesh>
                            
                            {/* Selection / Hover Highlights */}
                            {buildType && !cell.isWall && !tower && (
                                <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
                                    <planeGeometry args={[0.9, 0.9]} />
                                    <meshBasicMaterial color="orange" opacity={0.2} transparent />
                                </mesh>
                            )}
                            
                            {isSelected && (
                                <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
                                    <planeGeometry args={[0.95, 0.95]} />
                                    <meshBasicMaterial color="white" opacity={0.2} transparent />
                                </mesh>
                            )}

                            {isStart && (
                                <Text position={[0, 0.1, 0]} rotation={[-Math.PI/2,0,0]} fontSize={0.3} color="#4ade80" fontWeight="bold">
                                    DEPLOY
                                </Text>
                            )}
                            {isEnd && (
                                <Text position={[0, 0.1, 0]} rotation={[-Math.PI/2,0,0]} fontSize={0.3} color="#ef4444" fontWeight="bold">
                                    HQ
                                </Text>
                            )}

                            {tower && <TowerRenderer tower={tower} isSelected={isSelected} />}
                        </group>
                     );
                }))}

                {/* ENEMIES */}
                {enemies.map((enemy: Enemy) => (
                    <group key={enemy.id} position={[enemy.x - 0.5, 0, enemy.y - 0.5]}>
                        <EnemyModel 
                            type={enemy.type} 
                            color={ENEMY_STATS[enemy.type].color} 
                            hp={enemy.hp}
                            maxHp={enemy.maxHp}
                        />
                    </group>
                ))}

                {/* PROJECTILES */}
                {projectiles.map((proj: Projectile) => {
                     if (proj.isBeam) {
                         const target = enemies.find((e: Enemy) => e.id === proj.targetId);
                         if (!target) return null;
                         const start = new THREE.Vector3(proj.startX - 0.5, 0.6, proj.startY - 0.5);
                         const end = new THREE.Vector3(target.x - 0.5, 0.3, target.y - 0.5);
                         const dist = start.distanceTo(end);
                         const mid = start.clone().add(end).multiplyScalar(0.5);
                         
                         return (
                            <group key={proj.id} position={mid} lookAt={end}>
                                <mesh rotation={[Math.PI / 2, 0, 0]}>
                                    <cylinderGeometry args={[0.03, 0.03, dist, 4]} />
                                    <meshBasicMaterial color="cyan" transparent opacity={0.6} />
                                </mesh>
                            </group>
                         );
                     }
                     
                     // Standard Projectile / Missile
                     let fallbackRotation = 0;
                     if (proj.rotation === undefined) {
                        const target = enemies.find(e => e.id === proj.targetId);
                        if (target) {
                           const dx = target.x - proj.x;
                           const dy = target.y - proj.y;
                           // Use Math.atan2(dx, dy) to get the angle relative to Z-axis for ThreeJS Y-rotation
                           fallbackRotation = Math.atan2(dx, dy); 
                        }
                     }

                     // Convert Math Angle (0 = East/+X) to ThreeJS RotationY for +Z forward model.
                     // Formula: (PI / 2) - MathAngle
                     const rotation = proj.rotation !== undefined ? (Math.PI / 2) - proj.rotation : fallbackRotation;

                     return (
                        <group key={proj.id} position={[proj.x - 0.5, 0.5, proj.y - 0.5]} rotation={[0, rotation, 0]}>
                             {proj.isRocket ? (
                                <MissileBody color={proj.color} />
                             ) : (
                                <mesh>
                                    <sphereGeometry args={[0.08, 8, 8]} />
                                    <meshBasicMaterial color={proj.color} />
                                </mesh>
                             )}
                        </group>
                     );
                })}

                {/* PASSIVE ROCKETS (Orbiting) */}
                {towers.map((tower: Tower) => tower.passiveRockets?.map((rocket: PassiveRocket) => (
                    <group key={rocket.id} position={[rocket.x - 0.5, 0.8, rocket.y - 0.5]}>
                        {/* Apply same rotation correction: (PI/2) - angle */}
                        <group scale={0.3} rotation={[0, (Math.PI / 2) - rocket.rotation, 0]}>
                            <MissileBody />
                        </group>
                    </group>
                )))}
            </group>
            
            <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={50} blur={2.5} far={4} color="#000000" />
            <MapControls 
                ref={controlsRef}
                enableDamping 
                dampingFactor={0.1} 
                minZoom={10} 
                maxZoom={60} 
                maxPolarAngle={Math.PI / 2.2} 
                target={[0, 0, 0]}
            />
        </>
    );
};