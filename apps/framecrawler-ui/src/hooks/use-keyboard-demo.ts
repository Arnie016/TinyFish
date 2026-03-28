import { useEffect } from 'react';
import { useFrameCrawlerStore } from '../store/framecrawler-store';

export function useKeyboardDemo() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const s = useFrameCrawlerStore.getState();

      switch (e.key) {
        case '1': s.demoPrompt(); break;
        case '2': s.demoResearch(); break;
        case '3': s.demoExtract(); break;
        case '4': s.demoPlan(); break;
        case '5': s.demoBuild(); break;
        case '6': s.demoLight(); break;
        case '7': s.demoCamera(); break;
        case '8': s.demoReview(); break;
        case '0': s.demoReset(); break;
        case 'a':
        case 'A': s.demoRunAll(); break;
        case 'b':
        case 'B': s.pushToBlender(); break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
