import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { Mesh } from 'three';
import { MathUtils } from 'three';
import type { SceneObject as SceneObjectType } from '../store/types';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

interface SceneObjectProps {
  object: SceneObjectType;
  delay: number;
}

export function SceneObject3D({ object, delay }: SceneObjectProps) {
  const meshRef = useRef<Mesh>(null);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);
  const startTime = useRef<number | null>(null);
  const hoveredObjectId = useFrameCrawlerStore((s) => s.hoveredObjectId);
  const isHovered = hoveredObjectId === object.id;

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
    const t = MathUtils.clamp(elapsed / 0.6, 0, 1);
    // Spring-like easing
    const spring = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2);
    const p = MathUtils.clamp(spring, 0, 1);
    setProgress(p);

    if (meshRef.current) {
      meshRef.current.scale.set(
        object.scale[0] * p,
        object.scale[1] * p,
        object.scale[2] * p,
      );
      meshRef.current.position.y = object.position[1] + (1 - p) * 2;
    }
  });

  if (!started) return null;

  const Geometry = () => {
    switch (object.geometry) {
      case 'sphere': return <sphereGeometry args={[0.5, 16, 16]} />;
      case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 16]} />;
      case 'cone': return <coneGeometry args={[0.5, 1, 16]} />;
      case 'plane': return <planeGeometry args={[1, 1]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const edgeOpacity = isHovered ? 0.9 : progress < 1 ? 0.8 : 0.3;

  return (
    <mesh
      ref={meshRef}
      position={[object.position[0], object.position[1] + (1 - progress) * 2, object.position[2]]}
    >
      <Geometry />
      <meshStandardMaterial
        color={object.color}
        transparent
        opacity={progress * 0.85}
        metalness={0.3}
        roughness={0.7}
      />
      <Edges
        threshold={15}
        color={isHovered ? '#06B6D4' : '#7C3AED'}
        linewidth={isHovered ? 2 : 1}
        scale={1.001}
        renderOrder={1000}
      >
        <lineBasicMaterial
          transparent
          opacity={edgeOpacity}
          color={isHovered ? '#06B6D4' : '#7C3AED'}
        />
      </Edges>
    </mesh>
  );
}
