import test from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, dayStudy, instantFromLocal, localParts, seasonEvents, shadow, incidence, solarPoint } from '../web/solar.js';
import { windVector, nearestWind, windRose, windStrength } from '../web/wind.js';
import { solarVector } from '../web/solar.js';

test('ícones seguem intensidade e caminho solar usa uma esfera tridimensional', () => {
  assert.equal(windStrength(0).icons, 1);
  assert.equal(windStrength(3.399).icons, 1);
  assert.equal(windStrength(3.4).icons, 2);
  assert.equal(windStrength(10.799).icons, 2);
  assert.equal(windStrength(10.8).icons, 3);
  for (const altitude of [0, 30, 60, 90]) {
    const vector = solarVector({ azimuth: 90, altitude }, 120);
    assert.ok(Math.abs(Math.hypot(vector.east, vector.north, vector.up) - 120) < 1e-9);
    assert.ok(Math.abs(vector.up - 120 * Math.sin(altitude * Math.PI / 180)) < 1e-9);
  }
});
import { noiseUse, apiUrl, weatherSeries } from '../web/services.js';
import { offsetPoint } from '../web/geometry.js';
import GeographicLib from 'geographiclib-geodesic';

test('posição solar corresponde ao caso de referência NREL SPA', () => {
  const sun = sunPosition(new Date('2003-10-17T19:30:30Z'), 39.742476, -105.1786, 1830.14);
  assert.ok(Math.abs(sun.azimuth - 194.34024) < .02);
  assert.ok(Math.abs(sun.altitude - 39.888378) < .02);
});
test('fuso local e horário de verão preservam instantes reais', () => {
  assert.equal(instantFromLocal('2026-10-13', '12:00', 'America/Sao_Paulo').toISOString(), '2026-10-13T15:00:00.000Z');
  assert.equal(localParts(new Date('2026-10-13T15:00:00Z'), 'America/Sao_Paulo').time, '12:00');
  assert.throws(() => instantFromLocal('2026-03-08', '02:30', 'America/New_York'));
  assert.throws(() => instantFromLocal('2026-11-01', '01:30', 'America/New_York'));
  const day = dayStudy('2026-03-08', 'America/New_York', 40.7, -74);
  assert.equal((day.end - day.start) / 3_600_000, 23);
});
test('eventos astronômicos usam o hemisfério e não datas fixas', () => {
  const south = seasonEvents(2026, -23.5), north = seasonEvents(2026, 40);
  assert.equal(south[1].name, 'Inverno'); assert.equal(north[1].name, 'Verão');
  assert.equal(south[1].instant.toISOString().slice(0, 10), '2026-06-21');
  const polar = dayStudy('2026-06-21', 'UTC', 80, 0);
  assert.equal(polar.sunrise, null); assert.equal(polar.sunset, null); assert.equal(polar.night, null);
});
test('projeção solar, incidência e sombra têm geometria consistente', () => {
  const horizon = solarPoint({ azimuth: 90, altitude: 0 }, 100); assert.ok(Math.abs(horizon.east - 100) < 1e-9);
  assert.equal(solarPoint({ azimuth: 0, altitude: 90 }, 100).north, 0);
  const cast = shadow({ azimuth: 0, altitude: 60 }, 3); assert.equal(cast.azimuth, 180); assert.ok(Math.abs(cast.length - Math.sqrt(3)) < 1e-9);
  assert.equal(shadow({ azimuth: 0, altitude: -1 }, 3), null);
  assert.ok(incidence({ azimuth: 0, geometricAltitude: 90 }, 0, 0).angle < 1e-6);
  assert.equal(incidence({ azimuth: 0, geometricAltitude: 10 }, 180, 90).exposed, false);
});
test('vento meteorológico vem do norte e segue para o sul', () => {
  const north = windVector(4, 0); assert.equal(north.to, 180); assert.equal(north.north, -4);
  const west = windVector(4, 270); assert.equal(west.to, 90); assert.ok(Math.abs(west.east - 4) < 1e-9);
  assert.equal(windVector(.2, 270).to, 90); assert.equal(windVector(0, 45).to, 225);
  assert.equal(windVector(null, 0), null); assert.equal(windVector(2, null), null);
  const series = [{ time: '2026-10-13T12:00:00Z', speed: 3, direction: 90 }];
  assert.equal(nearestWind(series, new Date('2026-10-13T17:00:00Z')), null);
  const rose = windRose([{ speed: 2, direction: 359 }, { speed: 2, direction: 1 }, { speed: 0, direction: 0 }, { speed: null, direction: 0 }]);
  assert.equal(rose.samples, 3); assert.equal(rose.bins[0].count, 2); assert.equal(rose.calm, 1 / 3);
});
test('dados ausentes não são convertidos em zero e histórico é ERA5', () => {
  const entries = weatherSeries({ payload: { hourly: { time: ['2026-10-13T12:00'], wind_speed_10m: [null], wind_direction_10m: [null] } } });
  assert.equal(entries[0].speed, null); assert.equal(nearestWind(entries, new Date(entries[0].time)), null);
  const url = apiUrl('history', { latitude: -23.5, longitude: -46.6, date: '2020-01-01' });
  assert.ok(url.includes('models=era5')); assert.ok(url.includes('start_date=2019-12-31')); assert.ok(url.includes('end_date=2020-01-02'));
});
test('uso cadastrado distingue fontes potenciais de receptores sensíveis', () => {
  assert.equal(noiseUse({ building: 'industrial' }).role, 'Fonte potencial');
  assert.equal(noiseUse({ amenity: 'place_of_worship' }).role, 'Fonte potencial');
  assert.equal(noiseUse({ amenity: 'school' }).role, 'Receptor sensível');
  assert.equal(noiseUse({ amenity: 'hospital' }).role, 'Receptor sensível');
  assert.equal(noiseUse({ building: 'house' }), null);
  assert.equal(Object.hasOwn(noiseUse({ building: 'industrial' }), 'decibels'), false);
});
test('geometria WGS84 preserva escala, norte e continuidade no antimeridiano', () => {
  const north = offsetPoint(-23.55, -46.63, 0, 100);
  const inverse = GeographicLib.Geodesic.WGS84.Inverse(-23.55, -46.63, north[1], north[0]);
  assert.ok(Math.abs(inverse.s12 - 100) < 1e-6); assert.ok(Math.abs(inverse.azi1) < 1e-6);
  assert.ok(offsetPoint(0, 180, 100, 0)[0] > 180);
});
