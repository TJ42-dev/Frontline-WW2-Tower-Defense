
import React, { Suspense } from 'react';
import { useGLTF, OrbitControls, Stars, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';

interface MapPreviewSceneProps {
    mapPath: string;
    controlsRef?: any;
}

const BattlefieldModel = ({ path }: { path: string }) => {
    const { scene } = useGLTF(path);

    // Center the model and apply shadows
    React.useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [scene]);

    return <primitive object={scene} position={[0, 0, 0]} />;
};

export const MapPreviewScene: React.FC<MapPreviewSceneProps> = ({
    mapPath,
    controlsRef
}) => {
    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight
                position={[30, 50, 30]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-50}
                shadow-camera-right={50}
                shadow-camera-top={50}
                shadow-camera-bottom={-50}
            />
            <Environment preset="dawn" />
            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
            <fog attach="fog" args={['#1a1c1e', 20, 150]} />

            {/* Ground Plane (backup if model doesn't have ground) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color="#1a1c1e" roughness={0.9} />
            </mesh>

            <Suspense fallback={
                <Text position={[0, 2, 0]} fontSize={1} color="white">
                    Loading Map...
                </Text>
            }>
                <BattlefieldModel path={mapPath} />
            </Suspense>

            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.1}
                minDistance={5}
                maxDistance={100}
                maxPolarAngle={Math.PI / 2.1}
                target={[0, 0, 0]}
            />
        </>
    );
};

// Preload the battlefield map
useGLTF.preload('/battlefield.glb');
