export const pointCategories = ['transport', 'worship', 'institution', 'commerce', 'other'];
const groups = {
  transport: ['bus', 'bus_stop', 'bus_station', 'rail', 'railway', 'station', 'airport', 'ferry', 'tram_stop', 'subway_entrance'],
  worship: ['place_of_worship', 'worship', 'church', 'mosque', 'synagogue', 'temple'],
  institution: ['school', 'college', 'university', 'kindergarten', 'hospital', 'clinic', 'health', 'education', 'institution', 'townhall', 'police', 'fire_station', 'post', 'post_office', 'library', 'government'],
  commerce: ['shop', 'grocery', 'supermarket', 'convenience', 'mall', 'retail', 'commercial', 'restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'food', 'drink', 'hotel', 'lodging', 'office', 'bank', 'pharmacy', 'fuel', 'furniture', 'florist', 'clothing_store', 'entertainment']
};
export function categoryExpression() {
  const branches = Object.entries(groups).flatMap(([category, values]) => [['any', ['in', ['coalesce', ['get', 'class'], ''], ['literal', values]], ['in', ['coalesce', ['get', 'subclass'], ''], ['literal', values]], ['in', ['coalesce', ['get', 'category'], ''], ['literal', values]]], category]);
  return ['case', ...branches, 'other'];
}
export function pointFilter(categories) {
  return ['in', categoryExpression(), ['literal', categories]];
}

export class MapDisplay {
  constructor(map, layers) {
    this.map = map;
    this.layers = layers;
    this.buildings = layers.filter(layer => layer.type === 'fill-extrusion');
    this.points = layers.filter(layer => layer['source-layer'] === 'poi' || layer['source-layer'] === 'aerodrome_label');
    this.settings = null;
    this.visibility = new Map();
  }

  visible(id, enabled) {
    if (this.visibility.get(id) === enabled) return;
    this.visibility.set(id, enabled);
    this.map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
  }

  apply(settings) {
    const key = JSON.stringify(settings);
    if (key === this.settings) return;
    this.settings = key;
    const satellite = settings.basemap === 'satellite';
    this.visible('satellite-image', satellite);
    for (const layer of this.layers) {
      if (layer.type === 'fill-extrusion' || this.points.includes(layer)) continue;
      this.visible(layer.id, !satellite || layer.type === 'symbol');
    }
    const categoryKey = settings.categories.join(':');
    if (categoryKey !== this.categoryKey) {
      this.categoryKey = categoryKey;
      for (const layer of this.points) {
        this.visible(layer.id, settings.categories.length > 0);
        this.map.setFilter(layer.id, ['all', layer.filter ?? true, pointFilter(settings.categories)]);
      }
      this.map.setFilter('poi-icons', pointFilter(settings.categories));
    }
    for (const layer of this.buildings) this.visible(layer.id, settings.buildings);
    if (this.quality !== settings.quality) {
      this.quality = settings.quality;
      this.map.setPixelRatio(settings.quality === 'light' ? 0.85 : Math.min(window.devicePixelRatio || 1, 1.25));
    }
    const terrain = settings.terrain && this.map.getPitch() > 0;
    if (terrain !== !!this.map.getTerrain()) this.map.setTerrain(terrain ? { source: 'terrain', exaggeration: 1 } : null);
    this.map.setPaintProperty('solar-line', 'line-color', satellite ? '#ffffff' : '#777777');
  }
}
