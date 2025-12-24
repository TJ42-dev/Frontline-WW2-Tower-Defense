import React, { useMemo, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface BattlefieldMapProps {
  position?: [number, number, number];
  scale?: number;
}

const BattlefieldMapModel: React.FC<BattlefieldMapProps> = ({
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

export const BattlefieldMap: React.FC<BattlefieldMapProps> = (props) => {
  return (
    <Suspense fallback={null}>
      <BattlefieldMapModel {...props} />
    </Suspense>
  );
};
