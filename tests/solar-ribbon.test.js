import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { solarRibbonEdges } from '../web/solar-ribbon.js';
import { solarVector } from '../web/solar.js';

test('a faixa solar tem bordas em metros centradas na trajetoria tridimensional', () => {
  for (const altitude of [0, 30, 60, 90]) {
    const position = { altitude, azimuth: 120 };
    const edges = solarRibbonEdges(position, 1000);
    const center = solarVector(position, 1000);
    for (const axis of ['east', 'north', 'up']) {
      assert.ok(Math.abs((edges.inner[axis] + edges.outer[axis]) / 2 - center[axis]) < 1e-9);
    }
    assert.equal(edges.outer.up, center.up);
    assert.equal(edges.inner.up, center.up);
    assert.ok(Math.abs(Math.hypot(edges.outer.east - edges.inner.east, edges.outer.north - edges.inner.north) - 120) < 1e-9);
    assert.ok(edges.inner.up >= 0);
  }
});

test('a largura projetada muda com a perspectiva e a posicao solar', () => {
  const camera = new PerspectiveCamera(50, 1, 1, 10000);
  camera.position.set(0, -2000, 500);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 200);
  camera.updateMatrixWorld();
  const projection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const widths = [30, 90, 150].map(azimuth => {
    const edges = solarRibbonEdges({ altitude: 40, azimuth }, 1000);
    const project = v => new Vector3(v.east, v.north, v.up).applyMatrix4(projection);
    return project(edges.inner).distanceTo(project(edges.outer));
  });
  assert.ok(Math.max(...widths) / Math.min(...widths) > 1.1);
});

test('a face larga fica para cima e perpendicular ao percurso da ponte', () => {
  const previous = { altitude: 40, azimuth: 80 }, next = { altitude: 60, azimuth: 100 };
  const edges = solarRibbonEdges({ altitude: 50, azimuth: 90 }, 1000, previous, next);
  const before = solarVector(previous, 1000), after = solarVector(next, 1000);
  const east = edges.outer.east - edges.inner.east, north = edges.outer.north - edges.inner.north;
  assert.equal(edges.outer.up, edges.inner.up);
  assert.ok(Math.abs(east * (after.east - before.east) + north * (after.north - before.north)) < 1e-8);
});
