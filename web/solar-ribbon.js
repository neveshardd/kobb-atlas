import { solarVector } from './solar.js';

export function solarRibbonEdges(position, radius, previous = position, next = position) {
  const center = solarVector(position, radius);
  const before = solarVector(previous, radius), after = solarVector(next, radius);
  const east = after.east - before.east, north = after.north - before.north;
  const length = Math.hypot(east, north);
  const azimuth = position.azimuth * Math.PI / 180;
  const lateralEast = length > radius * 1e-8 ? -north / length : Math.sin(azimuth);
  const lateralNorth = length > radius * 1e-8 ? east / length : Math.cos(azimuth);
  const offset = radius * 0.06;
  return {
    inner: { east: center.east - lateralEast * offset, north: center.north - lateralNorth * offset, up: center.up },
    outer: { east: center.east + lateralEast * offset, north: center.north + lateralNorth * offset, up: center.up }
  };
}
