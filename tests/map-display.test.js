import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import { pointCategories, pointFilter } from '../web/map-display.js';

test('filtros cartográficos selecionam categorias e ocultam todos os pontos', () => {
  const fixtures = [
    ['transport', { class: 'bus', subclass: 'bus_stop' }],
    ['worship', { class: 'place_of_worship', subclass: 'church' }],
    ['institution', { class: 'school', subclass: 'kindergarten' }],
    ['commerce', { class: 'shop', subclass: 'bakery' }],
    ['other', { class: 'viewpoint' }],
    ['worship', { category: 'worship' }],
    ['institution', { category: 'health' }],
    ['other', { category: 'industrial' }]
  ];
  for (const enabled of [[], pointCategories, ...pointCategories.map(category => [category])]) {
    const result = createExpression(pointFilter(enabled), { type: 'boolean' });
    assert.equal(result.result, 'success', JSON.stringify(result.value));
    for (const [category, properties] of fixtures) {
      assert.equal(result.value.evaluate({ zoom: 16 }, { properties, type: 1 }), enabled.includes(category), `${category}: ${enabled.join(',')}`);
    }
  }
});
