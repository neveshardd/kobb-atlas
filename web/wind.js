import { normalize, radians } from './solar.js';

export function windVector(speed, from) {
  if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(from)) return null;
  return { speed, from: normalize(from), to: normalize(from + 180), east: -speed * Math.sin(radians(from)), north: -speed * Math.cos(radians(from)) };
}
export function windStrength(speed) {
  if (!Number.isFinite(speed) || speed < 0) return null;
  return speed < 3.4 ? { icons: 1, label: 'Leve' } : speed < 10.8 ? { icons: 2, label: 'Médio' } : { icons: 3, label: 'Forte' };
}
export const windGlyph = 'M2 8H15C20 8 20 1 16 1C14 1 13 3 14 4M2 13H22C28 13 28 5 24 5M2 18H13C19 18 19 25 15 25C13 25 12 23 13 22';

export function nearestWind(series, instant) {
  if (!series?.length) return null;
  const target = instant.getTime();
  if (target < new Date(series[0].time).getTime() || target > new Date(series.at(-1).time).getTime() + 3_600_000) return null;
  let candidate = null;
  let distance = Infinity;
  for (const entry of series) {
    const difference = Math.abs(new Date(entry.time).getTime() - target);
    if (difference < distance) { candidate = entry; distance = difference; }
  }
  if (distance > 3_600_000) return null;
  const vector = windVector(candidate.speed, candidate.direction);
  return vector ? { ...candidate, ...vector } : null;
}

export function windRose(series) {
  const bins = Array.from({ length: 16 }, (_, index) => ({ direction: index * 22.5, count: 0, speed: 0 }));
  let calm = 0;
  let valid = 0;
  for (const entry of series ?? []) {
    const vector = windVector(entry.speed, entry.direction);
    if (!vector) continue;
    valid++;
    if (vector.speed < .5) { calm++; continue; }
    const bin = bins[Math.round(vector.from / 22.5) % 16];
    bin.count++;
    bin.speed += vector.speed;
  }
  return { bins: bins.map(bin => ({ ...bin, frequency: valid ? bin.count / valid : 0, speed: bin.count ? bin.speed / bin.count : 0 })), calm: valid ? calm / valid : 0, samples: valid };
}
