import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurePath, offsetPoint, localPoint } from '../web/geometry.js';

test('a trena soma segmentos WGS84 em metros e fecha o perímetro', () => {
  const origin = [0, 0], east = offsetPoint(0, 0, 100, 0), northeast = offsetPoint(0, 0, 100, 100);
  const open = measurePath([origin, east, northeast]);
  assert.ok(Math.abs(open.meters - 200) < .001); assert.equal(open.segments.length, 2);
  assert.ok(Math.abs(measurePath([origin, east, northeast], true).meters - (200 + Math.sqrt(20000))) < .001);
  const local = localPoint(0, 0, northeast);
  assert.ok(Math.abs(local.east - 100) < .001); assert.ok(Math.abs(local.north - 100) < .001);
  assert.equal(measurePath([]).meters, 0);
});

test('a trena mede o trecho curto ao cruzar o antimeridiano', () => {
  const result = measurePath([[179.999, 0], [-179.999, 0]]);
  assert.ok(result.meters > 220 && result.meters < 225);
});
