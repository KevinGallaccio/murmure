import { useEffect, useState } from 'react';
import { MOCK_FRENCH_LINES } from '../shared/constants';

type Line = { id: string; text: string; partial: boolean };

export function useMockText(enabled: boolean, maxLines: number): Line[] {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!enabled) {
      setLines([]);
      return;
    }

    let cancelled = false;
    let lineIndex = 0;
    let counter = 0;

    async function tick(): Promise<void> {
      while (!cancelled) {
        const sentence = MOCK_FRENCH_LINES[lineIndex % MOCK_FRENCH_LINES.length];
        const turnId = `mock-${counter++}`;
        const words = sentence.split(' ');
        let acc = '';
        for (let i = 0; i < words.length; i++) {
          if (cancelled) return;
          acc = (acc ? acc + ' ' : '') + words[i];
          setLines((prev) => mergePartial(prev, { id: turnId, text: acc, partial: true }, maxLines));
          await sleep(140 + Math.random() * 120);
        }
        if (cancelled) return;
        setLines((prev) => commitFinal(prev, { id: turnId, text: sentence, partial: false }, maxLines));
        await sleep(900);
        lineIndex++;
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [enabled, maxLines]);

  return lines;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mergePartial(prev: Line[], next: Line, maxLines: number): Line[] {
  const withoutAnyPartial = prev.filter((l) => !l.partial);
  return [...withoutAnyPartial, next].slice(-maxLines);
}

function commitFinal(prev: Line[], finalLine: Line, maxLines: number): Line[] {
  const withoutPartials = prev.filter((l) => !l.partial);
  const dedup = withoutPartials.filter((l) => l.id !== finalLine.id);
  return [...dedup, finalLine].slice(-maxLines);
}
