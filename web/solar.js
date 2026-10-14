import * as Astronomy from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';

export const radians = value => value * Math.PI / 180;
export const degrees = value => value * 180 / Math.PI;
export const normalize = value => ((value % 360) + 360) % 360;
const seasonCache = new Map();

export function validateLocation(latitude, longitude, elevation = 0) {
  if (![latitude, longitude, elevation].every(Number.isFinite) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180 || elevation < -500 || elevation > 9000)
    throw new Error('Informe latitude entre −85° e 85°, longitude entre −180° e 180° e altitude entre −500 e 9.000 m.');
}

export function instantFromLocal(date, time, timeZone) {
  const value = Temporal.PlainDateTime.from(`${date}T${time}`);
  if (value.year < 1900 || value.year > 2100) throw new Error('Escolha um ano entre 1900 e 2100.');
  try { return new Date(Number(value.toZonedDateTime(timeZone, { disambiguation: 'reject' }).epochMilliseconds)); }
  catch { throw new Error('Esse horário é inexistente ou ambíguo no fuso escolhido. Ajuste o horário ou o fuso.'); }
}

export function localParts(instant, timeZone) {
  const local = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timeZone);
  return { date: local.toPlainDate().toString(), time: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`, offset: local.offset };
}

export function sunPosition(instant, latitude, longitude, elevation = 0) {
  validateLocation(latitude, longitude, elevation);
  const observer = new Astronomy.Observer(latitude, longitude, elevation);
  const equator = Astronomy.Equator('Sun', instant, observer, true, true);
  const apparent = Astronomy.Horizon(instant, observer, equator.ra, equator.dec, 'normal');
  const geometric = Astronomy.Horizon(instant, observer, equator.ra, equator.dec);
  return { azimuth: normalize(apparent.azimuth), altitude: apparent.altitude, geometricAltitude: geometric.altitude };
}

export function dayStudy(date, timeZone, latitude, longitude, elevation = 0) {
  validateLocation(latitude, longitude, elevation);
  const day = Temporal.PlainDate.from(date);
  const start = new Date(Number(day.toZonedDateTime(timeZone).epochMilliseconds));
  const end = new Date(Number(day.add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds));
  const observer = new Astronomy.Observer(latitude, longitude, elevation);
  const within = event => event && event.date >= start && event.date < end ? event.date : null;
  const sunrise = within(Astronomy.SearchRiseSet('Sun', observer, 1, start, 2));
  const sunset = within(Astronomy.SearchRiseSet('Sun', observer, -1, start, 2));
  const noon = within(Astronomy.SearchHourAngle('Sun', observer, 0, start, 1).time);
  const night = within(Astronomy.SearchAltitude('Sun', observer, -1, start, 2, -18));
  const samples = [];
  for (let tick = start.getTime(); tick <= end.getTime(); tick += 5 * 60_000) {
    const instant = new Date(tick);
    samples.push({ instant, ...sunPosition(instant, latitude, longitude, elevation) });
  }
  return { start, end, sunrise, sunset, noon, night, samples };
}

export function seasonEvents(year, latitude) {
  const key = `${year}:${latitude >= 0}`;
  if (seasonCache.has(key)) return seasonCache.get(key);
  const seasons = Astronomy.Seasons(year);
  const north = latitude >= 0;
  const result = [
    { name: north ? 'Primavera' : 'Outono', kind: 'Equinócio', instant: seasons.mar_equinox.date },
    { name: north ? 'Verão' : 'Inverno', kind: 'Solstício', instant: seasons.jun_solstice.date },
    { name: north ? 'Outono' : 'Primavera', kind: 'Equinócio', instant: seasons.sep_equinox.date },
    { name: north ? 'Inverno' : 'Verão', kind: 'Solstício', instant: seasons.dec_solstice.date }
  ];
  seasonCache.set(key, result);
  return result;
}
export function solarVector(position, radius) {
  const horizontal = radius * Math.cos(radians(position.altitude));
  return { east: horizontal * Math.sin(radians(position.azimuth)), north: horizontal * Math.cos(radians(position.azimuth)), up: radius * Math.sin(radians(position.altitude)) };
}

export function seasonAt(instant, latitude) {
  const year = instant.getUTCFullYear();
  const events = [...seasonEvents(year - 1, latitude), ...seasonEvents(year, latitude)].filter(event => event.instant <= instant);
  return events.at(-1)?.name ?? '—';
}

export function solarPhase(altitude) {
  if (altitude >= 0) return 'Dia';
  if (altitude >= -6) return 'Crepúsculo civil';
  if (altitude >= -12) return 'Crepúsculo náutico';
  if (altitude >= -18) return 'Crepúsculo astronômico';
  return 'Noite';
}

export function incidence(position, surfaceAzimuth, tilt) {
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90) throw new Error('A inclinação deve estar entre 0° e 90°.');
  const altitude = radians(position.geometricAltitude);
  const cosine = Math.sin(altitude) * Math.cos(radians(tilt)) + Math.cos(altitude) * Math.sin(radians(tilt)) * Math.cos(radians(position.azimuth - surfaceAzimuth));
  return { angle: degrees(Math.acos(Math.min(1, Math.max(-1, cosine)))), exposed: position.geometricAltitude > 0 && cosine > 0, cosine: position.geometricAltitude > 0 ? Math.max(0, cosine) : 0 };
}

export function shadow(position, height) {
  if (!Number.isFinite(height) || height <= 0) throw new Error('Informe uma altura positiva.');
  if (position.altitude <= 0) return null;
  return { azimuth: normalize(position.azimuth + 180), length: height / Math.tan(radians(position.altitude)) };
}

export function solarPoint(position, radius) {
  const distance = radius * Math.tan(radians((90 - position.altitude) / 2));
  return { east: distance * Math.sin(radians(position.azimuth)), north: distance * Math.cos(radians(position.azimuth)) };
}
