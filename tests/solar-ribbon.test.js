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
    assert.ok(Math.abs(Math.hypot(...Object.values(edges.outer)) - 1060) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...Object.values(edges.inner)) - 940) < 1e-9);
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
