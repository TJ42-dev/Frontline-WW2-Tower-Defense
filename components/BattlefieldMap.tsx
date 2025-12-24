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
    if (!scene) return null;
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

  if (!clonedScene) return null;

  return (
    <group position={position}>
      <primitive
        object={clonedScene}
        scale={scale}
      />
    </group>
  );
};

// Error boundary for the map - renders nothing if map fails to load
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('BattlefieldMap failed to load:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const BattlefieldMap: React.FC<BattlefieldMapProps> = (props) => {
  return (
    <MapErrorBoundary>
      <Suspense fallback={null}>
        <BattlefieldMapModel {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
};
