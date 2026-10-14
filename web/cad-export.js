import { solarVector } from './solar.js';

export function cadDrawing(report) {
  const output = [];
  const pair = (code, value) => output.push(String(code), String(value));
  const point = (vector, offset = 0) => { pair(10 + offset, vector.east); pair(20 + offset, vector.north); pair(30 + offset, vector.up ?? 0); };
  const line = (layer, from, to) => { pair(0, 'LINE'); pair(8, layer); point(from); point(to, 1); };
  const radius = report.map.radiusMeters;
  const text = (value, east, north, up = 0) => {
    pair(0, 'TEXT'); pair(8, 'ATLAS_NOTES'); point({ east, north, up }); pair(40, radius * .035);
    pair(1, String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\r\n]/g, ' '));
  };
  pair(0, 'SECTION'); pair(2, 'HEADER'); pair(9, '$ACADVER'); pair(1, 'AC1009'); pair(9, '$MEASUREMENT'); pair(70, 1); pair(0, 'ENDSEC');
  pair(0, 'SECTION'); pair(2, 'ENTITIES');
  pair(0, 'CIRCLE'); pair(8, 'ATLAS_RADIUS'); point({ east: 0, north: 0 }); pair(40, radius);
  pair(0, 'POINT'); pair(8, 'ATLAS_ORIGIN'); point({ east: 0, north: 0 });
  line('ATLAS_NORTH', { east: 0, north: radius * 1.1 }, { east: 0, north: radius * 1.35 });
  text('N', -radius * .02, radius * 1.4);
  let previous;
  for (const sample of report.solar.samples) {
    if (sample.altitude < 0) { previous = null; continue; }
    const vector = solarVector(sample, radius);
    if (previous) line('ATLAS_SOLAR_3D', previous, vector);
    previous = vector;
    if (sample.localTime?.endsWith(':00')) text(sample.localTime, vector.east, vector.north, vector.up);
  }
  const wind = report.weather?.selected;
  if (wind && Number.isFinite(wind.from) && Number.isFinite(wind.to)) {
    const from = wind.from * Math.PI / 180, to = wind.to * Math.PI / 180;
    const tail = { east: Math.sin(from) * radius, north: Math.cos(from) * radius };
    const tip = { east: tail.east + Math.sin(to) * radius * .22, north: tail.north + Math.cos(to) * radius * .22 };
    line('ATLAS_WIND', tail, tip);
    for (const side of [-1, 1]) line('ATLAS_WIND', tip, { east: tip.east - Math.sin(to + side * .5) * radius * .06, north: tip.north - Math.cos(to + side * .5) * radius * .06 });
    text(`Wind 10 m: ${wind.speed} m/s; from ${wind.from} deg`, -radius, -radius * 1.22);
  } else text('Wind: unavailable for the selected time', -radius, -radius * 1.22);
  text(`KOBB Atlas ${report.version} | ${report.instant} | ${report.timeZone}`, -radius, -radius * 1.35);
  text(`WGS84: ${report.location.latitude}, ${report.location.longitude} | elevation ${report.location.elevationMeters} m`, -radius, -radius * 1.45);
  text(`Local origin (0,0,0); X east, Y north, Z up; drawing units: meters; radius ${radius} m`, -radius, -radius * 1.55);
  text('Graphic solar scale; not a cadastral survey or terrain model. Astronomy Engine; Open-Meteo.', -radius, -radius * 1.65);
  pair(0, 'ENDSEC'); pair(0, 'EOF');
  return output.join('\r\n') + '\r\n';
}
