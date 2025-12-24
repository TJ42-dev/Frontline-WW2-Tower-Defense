import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

// Preload the battlefield map
useGLTF.preload('./maps/battlefield.glb');

interface BattlefieldMapProps {
  position?: [number, number, number];
  scale?: number;
}

export const BattlefieldMap: React.FC<BattlefieldMapProps> = ({
  position = [0, 0, 0],
  scale = 1
}) => {
  const { scene } = useGLTF('./maps/battlefield.glb');

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Ensure materials render properly
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position}>
      <primitive
        object={clonedScene}
        scale={scale}
      />
    </group>
  );
};
