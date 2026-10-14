import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadDrawing } from '../web/cad-export.js';
import { imageryTile } from '../web/satellite.js';

test('DXF contém desenho 3D em metros e preserva vento calmo com direção', () => {
  const report = { version: 'test', instant: '2026-06-21T15:00:00Z', timeZone: 'America/Sao_Paulo', map: { radiusMeters: 120 }, location: { latitude: -23.55, longitude: -46.63, elevationMeters: 760.5 }, solar: { samples: [{ altitude: 0, azimuth: 90, localTime: '07:00' }, { altitude: 45, azimuth: 0, localTime: '12:00' }, { altitude: -10, azimuth: 270 }] }, weather: { selected: { speed: 0, from: 90, to: 270 } } };
  const drawing = cadDrawing(report);
  assert.match(drawing, /CIRCLE\r\n8\r\nATLAS_RADIUS/);
  assert.match(drawing, /40\r\n120\r\n/);
  assert.match(drawing, /ATLAS_SOLAR_3D/);
  assert.match(drawing, /ATLAS_WIND/);
  assert.match(drawing, /Wind 10 m: 0 m\/s/);
  assert.ok(drawing.endsWith('0\r\nEOF\r\n'));
  report.weather = null;
  assert.match(cadDrawing(report), /Wind: unavailable/);
  assert.doesNotMatch(cadDrawing(report), /ATLAS_WIND/);
});

test('consulta de cobertura usa a mesma localização das imagens Esri', () => {
  assert.deepEqual(imageryTile(-47.92232, -15.17862, 17), { x: 48088, y: 71128 });
  assert.deepEqual(imageryTile(-47.92232 + 360, -15.17862, 17), imageryTile(-47.92232, -15.17862, 17));
});
