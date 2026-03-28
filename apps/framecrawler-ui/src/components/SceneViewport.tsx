import { Canvas } from '@react-three/fiber';
import { SceneContent } from './SceneContent';

export function SceneViewport() {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-border">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0a0a10' }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
