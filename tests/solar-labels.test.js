import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeSolarLabels } from '../web/solar-labels.js';

test('horários separados permanecem colados aos pontos da curva', () => {
  const points = Array.from({ length: 13 }, (_, index) => ({ x: 40 + index * 60, y: 180, visible: true }));
  const labels = placeSolarLabels(points, 900, 400);
  assert.equal(labels.filter(Boolean).length, points.length);
  for (let index = 0; index < labels.length; index++) {
    const box = labels[index].box;
    assert.equal(labels[index].x, points[index].x); assert.equal(labels[index].y, points[index].y);
    assert.ok(box.left >= 0 && box.right <= 900 && box.top >= 0 && box.bottom <= 400);
    for (const other of labels.slice(index + 1)) assert.ok(box.right <= other.box.left || box.left >= other.box.right || box.bottom <= other.box.top || box.top >= other.box.bottom);
  }
});

test('o horário de baixo desaparece quando sobrepõe o de cima', () => {
  const labels = placeSolarLabels([{ x: 100, y: 106, visible: true }, { x: 100, y: 100, visible: true }], 300, 300);
  assert.equal(labels[0], null); assert.deepEqual([labels[1].x, labels[1].y], [100, 100]);
});

test('a redução da janela não força sobreposição e omite pontos fora da tela', () => {
  const labels = placeSolarLabels([{ x: -400, y: 100, visible: true }, ...Array.from({ length: 12 }, () => ({ x: 30, y: 30, visible: true }))], 60, 60);
  assert.equal(labels[0], null);
  assert.equal(labels.filter(Boolean).length, 1);
});
