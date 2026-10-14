import GeographicLib from 'geographiclib-geodesic';

const geodesic = GeographicLib.Geodesic.WGS84;
export function measurePath(coordinates, closed = false) {
  const points = closed && coordinates.length > 2 ? [...coordinates, coordinates[0]] : coordinates;
  const segments = [];
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1], to = points[index];
    const inverse = geodesic.Inverse(from[1], from[0], to[1], to[0]);
    const middle = geodesic.Direct(from[1], from[0], inverse.azi1, inverse.s12 / 2);
    segments.push({ meters: inverse.s12, midpoint: [middle.lon2, middle.lat2] });
  }
  return { meters: segments.reduce((total, segment) => total + segment.meters, 0), segments };
}
export function localPoint(latitude, longitude, coordinate) {
  const inverse = geodesic.Inverse(latitude, longitude, coordinate[1], coordinate[0]);
  const angle = inverse.azi1 * Math.PI / 180;
  return { east: Math.sin(angle) * inverse.s12, north: Math.cos(angle) * inverse.s12, up: 0 };
}
export function offsetPoint(latitude, longitude, east, north) {
  const destination = geodesic.Direct(latitude, longitude, Math.atan2(east, north) * 180 / Math.PI, Math.hypot(east, north));
  const unwrapped = longitude + ((destination.lon2 - longitude + 540) % 360) - 180;
  return [unwrapped, destination.lat2];
}
