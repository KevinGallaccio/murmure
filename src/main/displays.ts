import { screen, type Display } from 'electron';
import type { DisplayInfo } from '../shared/ipc';

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, idx) => toDisplayInfo(d, primaryId, idx));
}

export function findDisplay(displayId?: number | null): Display | null {
  const all = screen.getAllDisplays();
  if (displayId !== undefined && displayId !== null) {
    const match = all.find((d) => d.id === displayId);
    if (match) return match;
  }
  const primaryId = screen.getPrimaryDisplay().id;
  const secondary = all.find((d) => d.id !== primaryId);
  return secondary ?? null;
}

export function getPrimaryDisplay(): Display {
  return screen.getPrimaryDisplay();
}

function toDisplayInfo(d: Display, primaryId: number, idx: number): DisplayInfo {
  const isPrimary = d.id === primaryId;
  const label = `${isPrimary ? 'Écran principal' : `Écran ${idx + 1}`} — ${d.size.width}×${d.size.height}`;
  return {
    id: d.id,
    label,
    isPrimary,
    bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
  };
}
