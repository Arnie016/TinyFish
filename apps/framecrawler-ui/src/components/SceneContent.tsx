import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import { useFrameCrawlerStore } from '../store/framecrawler-store';
import { MOCK_SCENE_METADATA } from '../store/mock-data';
import { SceneObject3D } from './SceneObject';
import { LightVis } from './LightVis';

export function SceneContent() {
  const visibleObjectIds = useFrameCrawlerStore((s) => s.visibleObjectIds);
  const visibleLightIds = useFrameCrawlerStore((s) => s.visibleLightIds);
  const cameraAnimating = useFrameCrawlerStore((s) => s.cameraAnimating);
  const controlsRef = useRef<ReturnType<typeof OrbitControls> | null>(null);
  const { camera } = useThree();
  const pathProgress = useRef(0);
  const pathActive = useRef(false);

  const allObjects = MOCK_SCENE_METADATA.objects;
  const allLights = MOCK_SCENE_METADATA.lighting.lights;
  const cameraPath = MOCK_SCENE_METADATA.camera.path;

  useFrame((_, delta) => {
    if (cameraAnimating && !pathActive.current) {
      pathActive.current = true;
      pathProgress.current = 0;
    }

    if (pathActive.current) {
      pathProgress.current += delta / 6; // 6 seconds for full path

      if (pathProgress.current >= 1) {
        pathActive.current = false;
        pathProgress.current = 0;
        return;
      }

      const t = pathProgress.current;
      const totalSegments = cameraPath.length - 1;
      const segmentFloat = t * totalSegments;
      const segmentIndex = Math.min(Math.floor(segmentFloat), totalSegments - 1);
      const segmentT = segmentFloat - segmentIndex;

      const from = cameraPath[segmentIndex];
      const to = cameraPath[segmentIndex + 1];

      const eased = MathUtils.smoothstep(segmentT, 0, 1);

      camera.position.set(
        MathUtils.lerp(from[0], to[0], eased),
        MathUtils.lerp(from[1], to[1], eased),
        MathUtils.lerp(from[2], to[2], eased),
      );

      camera.lookAt(new Vector3(0, 1.5, 0));
    }
  });

  const visibleObjects = allObjects.filter((obj) => visibleObjectIds.includes(obj.id));
  const visibleLights = allLights.filter((light) => visibleLightIds.includes(light.id));

  return (
    <>
      {/* Fog & ambient */}
      <fog attach="fog" args={['#0a0a10', 8, 25]} />
      <ambientLight intensity={0.12} color="#6366f1" />

      {/* Grid */}
      <gridHelper args={[20, 20, '#2a2a40', '#1e1e30']} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a0a10" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Scene objects */}
      {visibleObjects.map((obj, i) => (
        <SceneObject3D key={obj.id} object={obj} delay={i * 50} />
      ))}

      {/* Scene lights */}
      {visibleLights.map((light, i) => (
        <LightVis key={light.id} light={light} delay={i * 50} />
      ))}

      {/* Controls */}
      <OrbitControls
        ref={controlsRef as never}
        autoRotate={!cameraAnimating}
        autoRotateSpeed={0.4}
        enableZoom={true}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={20}
        enabled={!cameraAnimating}
      />
    </>
  );
}
