import { useEffect } from 'react';
import { useRadarStore } from '../store/radar-store';

export function useKeyboardDemo() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const s = useRadarStore.getState();

      switch (e.key) {
        case '1':
          s.demoStartScan();
          break;
        case '2':
          s.demoShowSpec();
          break;
        case '3':
          s.demoFindSimilar();
          break;
        case '4':
          s.demoCompile();
          break;
        case '5':
          s.demoRunSkill();
          break;
        case '6':
          s.demoPatchDetect();
          break;
        case '7':
          s.demoPatchApply();
          break;
        case '0':
          s.demoReset();
          break;
        case 'a':
        case 'A':
          s.demoRunAll();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
