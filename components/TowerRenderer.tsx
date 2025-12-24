
import React, { useMemo, useEffect } from 'react';
import { Tower } from '../types';
import { TOWER_STATS, TowerType } from '../constants';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

// Preload models using relative paths
useGLTF.preload('./towers/mg42.glb');
useGLTF.preload('./towers/m45.glb');
useGLTF.preload('./towers/rocket_tower.glb');
useGLTF.preload('./towers/rockets.glb');

interface TowerRendererProps {
  tower: Tower;
  isSelected: boolean;
}

export const MissileBody = ({ color = '#7c3f00' }: { color?: string }) => {
  const { scene } = useGLTF('./towers/rockets.glb');
  
  const clone = useMemo(() => {
      const c = scene.clone();
      c.traverse((child: any) => {
          if (child.isMesh) {
              child.castShadow = true;
              // If no texture map, apply a generic missile style
              if (!child.material.map) {
                   child.material = new THREE.MeshStandardMaterial({
                      color: color,
                      roughness: 0.5,
                      metalness: 0.5
                  });
              }
          }
      });
      return c;
  }, [scene, color]);

  return (
    // Corrected: Model is likely Z-aligned. Removed rotation. Reduced scale.
    <group rotation={[0, 0, 0]} scale={0.45}> 
       <primitive object={clone} />
    </group>
  );
};

export const TowerRenderer: React.FC<TowerRendererProps> = ({ tower, isSelected }) => {
    const stats = TOWER_STATS[tower.type];
    // Convert rotation from degrees to radians and adjust for model orientation
    const rotationY = -(tower.rotation * Math.PI) / 180; 
    
    // Range ring calculation (visual only)
    const rangeVal = stats.range; 
    
    // Load Models using relative paths
    const mg42 = useGLTF('./towers/mg42.glb');
    const m45 = useGLTF('./towers/m45.glb');
    const rocketTower = useGLTF('./towers/rocket_tower.glb');

    // Clone scenes to allow multiple instances
    const mg42Scene = useMemo(() => mg42.scene.clone(), [mg42.scene]);
    const m45Scene = useMemo(() => m45.scene.clone(), [m45.scene]);
    const rocketTowerScene = useMemo(() => rocketTower.scene.clone(), [rocketTower.scene]);

    // Apply Gun-metal grey to MG42
    useEffect(() => {
        mg42Scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Gun-metal grey material override
                child.material = new THREE.MeshStandardMaterial({
                    color: '#525b63', // Gun metal grey
                    roughness: 0.4,
                    metalness: 0.6
                });
            }
        });
    }, [mg42Scene]);

    // Apply Olive Drab to Rocket Tower
    useEffect(() => {
        rocketTowerScene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.material.map) {
                     child.material = new THREE.MeshStandardMaterial({
                        color: '#4a503d', // Olive Drab
                        roughness: 0.6,
                        metalness: 0.3
                    });
                }
            }
        });
    }, [rocketTowerScene]);

    return (
        <group>
            {isSelected && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
                    <ringGeometry args={[rangeVal - 0.1, rangeVal, 64]} />
                    <meshBasicMaterial color="orange" opacity={0.5} transparent side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* WALL: Sandbags */}
            {tower.type === TowerType.WALL && (
                <group position={[0, 0.25, 0]}>
                   <mesh position={[0, 0, 0]}>
                     <boxGeometry args={[0.8, 0.5, 0.8]} />
                     <meshStandardMaterial color="#c2b280" map={null} roughness={0.9} />
                   </mesh>
                   {/* Sandbag details */}
                   <mesh position={[0, 0.25, 0.2]}>
                      <boxGeometry args={[0.7, 0.2, 0.3]} />
                      <meshStandardMaterial color="#b0a070" />
                   </mesh>
                   <mesh position={[0, 0.25, -0.2]}>
                      <boxGeometry args={[0.7, 0.2, 0.3]} />
                      <meshStandardMaterial color="#b0a070" />
                   </mesh>
                </group>
            )}
            
            {/* TURRET: MG42 GLB */}
            {tower.type === TowerType.TURRET && (
                <group>
                    {/* Base */}
                    <mesh position={[0, 0.1, 0]}>
                        <cylinderGeometry args={[0.4, 0.45, 0.2, 16]} />
                        <meshStandardMaterial color="#3d431a" />
                    </mesh>
                    {/* Model - Scaled down, centered, and lifted */}
                    <group position={[0, 0.2, 0]} rotation={[0, rotationY, 0]}>
                        {/* Offset group to shift pivot point "forward" (model moves back/down relative to pivot) */}
                        <group position={[0, 0, 0.3]}>
                            <Center top>
                                <primitive 
                                    object={mg42Scene} 
                                    scale={0.6} 
                                />
                            </Center>
                        </group>
                    </group>
                </group>
            )}
            
            {/* SNIPER: Geometric Construction */}
            {tower.type === TowerType.SNIPER && (
                <group>
                    {/* Tripod legs */}
                    <mesh position={[0, 0.15, 0]}>
                        <cylinderGeometry args={[0.1, 0.3, 0.3, 3]} />
                        <meshStandardMaterial color="#2c3539" />
                    </mesh>
                    {/* Rotating Head */}
                    <group rotation={[0, rotationY, 0]} position={[0, 0.4, 0]}>
                        {/* Body */}
                        <mesh position={[0, 0, 0]}>
                            <boxGeometry args={[0.3, 0.3, 0.6]} />
                            <meshStandardMaterial color="#6b7c72" />
                        </mesh>
                        {/* Long Barrel */}
                        <mesh position={[0, 0, 0.6]} rotation={[Math.PI/2, 0, 0]}>
                            <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
                            <meshStandardMaterial color="#1a1c1e" roughness={0.2} />
                        </mesh>
                        {/* Muzzle Brake */}
                        <mesh position={[0, 0, 1.2]}>
                             <boxGeometry args={[0.1, 0.1, 0.2]} />
                             <meshStandardMaterial color="#000" />
                        </mesh>
                    </group>
                </group>
            )}
            
            {/* RAPID: M45 GLB */}
            {tower.type === TowerType.RAPID && (
                <group>
                    {/* Base */}
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.7, 0.2, 0.7]} />
                        <meshStandardMaterial color="#2c3539" />
                    </mesh>
                     {/* Model - Significantly scaled down */}
                     <primitive 
                        object={m45Scene} 
                        scale={0.4} 
                        rotation={[0, rotationY, 0]} 
                        position={[0, 0.2, 0]} 
                    />
                </group>
            )}
            
            {/* ROCKET: Rocket Tower GLB */}
            {tower.type === TowerType.ROCKET && (
                <group>
                     {/* Base Platform */}
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.8, 0.25, 0.8]} />
                        <meshStandardMaterial color="#2F3530" />
                    </mesh>
                    
                    {/* Rotating Tower Part */}
                    <group position={[0, 0.25, 0]} rotation={[0, rotationY, 0]}>
                         {/* Centered Model with offset */}
                         {/* Offset X (Right/Forward) and Z (Down/Side) relative to rotation to align with visual preferences */}
                         <group position={[-0.4, 0, 0]}> 
                             <Center top>
                                 <primitive 
                                    object={rocketTowerScene} 
                                    scale={0.25}
                                    // Flipped rotation to 90 degrees to face +X (Right) instead of -X (Left)
                                    rotation={[0, Math.PI / 2, 0]}
                                 />
                             </Center>
                         </group>
                    </group>
                </group>
            )}
            
            {/* TESLA: Experimental */}
            {tower.type === TowerType.TESLA && (
                <group>
                    <mesh position={[0, 0.1, 0]}>
                        <cylinderGeometry args={[0.4, 0.5, 0.2, 8]} />
                        <meshStandardMaterial color="#1a1c1e" />
                    </mesh>
                    {/* Coil */}
                    <mesh position={[0, 0.6, 0]}>
                        <cylinderGeometry args={[0.1, 0.1, 0.8, 8]} />
                        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} />
                    </mesh>
                    {/* Rings */}
                    <mesh position={[0, 0.8, 0]} rotation={[Math.PI/2, 0, 0]}>
                         <torusGeometry args={[0.3, 0.02, 16, 32]} />
                         <meshStandardMaterial color="white" emissive="white" />
                    </mesh>
                    {/* Spark */}
                    <mesh position={[0, 1.1, 0]}>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color="white" emissive="cyan" emissiveIntensity={2} />
                    </mesh>
                </group>
            )}
        </group>
    );
};
