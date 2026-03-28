import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight as PointLightType } from 'three';
import { MathUtils } from 'three';
import type { SceneLight } from '../store/types';

interface LightVisProps {
  light: SceneLight;
  delay: number;
}

export function LightVis({ light, delay }: LightVisProps) {
  const lightRef = useRef<PointLightType>(null);
  const [intensity, setIntensity] = useState(0);
  const [started, setStarted] = useState(false);
  const startTime = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!started) {
      if (clock.getElapsedTime() * 1000 > delay) {
        setStarted(true);
        startTime.current = clock.getElapsedTime();
      }
      return;
    }

    if (startTime.current === null) return;

    const elapsed = clock.getElapsedTime() - startTime.current;
    const t = MathUtils.clamp(elapsed / 1.0, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const currentIntensity = light.intensity * eased;
    setIntensity(currentIntensity);

    if (lightRef.current) {
      lightRef.current.intensity = currentIntensity;
    }
  });

  if (!started) return null;

  return (
    <group position={light.position}>
      {/* The actual light */}
      <pointLight
        ref={lightRef}
        color={light.color}
        intensity={intensity}
        distance={15}
        decay={2}
      />

      {/* Visual indicator sphere */}
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={light.color} transparent opacity={Math.min(intensity / light.intensity, 1)} />
      </mesh>

      {/* Outer glow sphere */}
      <mesh>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial
          color={light.color}
          transparent
          opacity={Math.min(intensity / light.intensity, 1) * 0.15}
        />
      </mesh>
    </group>
  );
}
