import GeographicLib from 'geographiclib-geodesic';

const geodesic = GeographicLib.Geodesic.WGS84;
export function offsetPoint(latitude, longitude, east, north) {
  const destination = geodesic.Direct(latitude, longitude, Math.atan2(east, north) * 180 / Math.PI, Math.hypot(east, north));
  const unwrapped = longitude + ((destination.lon2 - longitude + 540) % 360) - 180;
  return [unwrapped, destination.lat2];
}
