import { solarVector } from './solar.js';

export function solarRibbonEdges(position, radius) {
  return {
    inner: solarVector(position, radius * 0.94),
    outer: solarVector(position, radius * 1.06)
  };
}
