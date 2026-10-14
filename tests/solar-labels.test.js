import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeSolarLabels } from '../web/solar-labels.js';

test('horários próximos recebem posições separadas dentro da tela', () => {
  const points = Array.from({ length: 13 }, (_, index) => ({ x: 220 + index * 2, y: 180 + index * 3, visible: true }));
  const labels = placeSolarLabels(points, 500, 400);
  assert.equal(labels.filter(Boolean).length, points.length);
  for (let index = 0; index < labels.length; index++) {
    const box = labels[index].box;
    assert.ok(box.left >= 0 && box.right <= 500 && box.top >= 0 && box.bottom <= 400);
    for (const other of labels.slice(index + 1)) assert.ok(box.right <= other.box.left || box.left >= other.box.right || box.bottom <= other.box.top || box.top >= other.box.bottom);
  }
});

test('a redução da janela não força sobreposição e omite pontos fora da tela', () => {
  const labels = placeSolarLabels([{ x: -400, y: 100, visible: true }, ...Array.from({ length: 12 }, () => ({ x: 30, y: 30, visible: true }))], 60, 60);
  assert.equal(labels[0], null);
  assert.equal(labels.filter(Boolean).length, 1);
});
