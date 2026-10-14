import { measurePath } from './geometry.js';

const feature = (type, coordinates, properties) => ({ type: 'Feature', geometry: { type, coordinates }, properties });
const meters = value => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`;

export class MapSketch {
  constructor(map, onChange) {
    this.map = map; this.onChange = onChange; this.tool = 'select'; this.outline = []; this.measure = []; this.closed = false;
    try {
      const saved = JSON.parse(localStorage.getItem('kobb-atlas-sketch'));
      const valid = points => Array.isArray(points) && points.length <= 500 && points.every(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 85);
      if (saved && valid(saved.outline) && valid(saved.measurement)) { this.outline = saved.outline; this.measure = saved.measurement; this.closed = saved.closed && saved.outline.length >= 3; }
    } catch {}
    map.addSource('sketch', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'sketch-fill', type: 'fill', source: 'sketch', filter: ['==', ['get', 'role'], 'area'], paint: { 'fill-color': '#d32f2f', 'fill-opacity': .06 } });
    map.addLayer({ id: 'sketch-lines', type: 'line', source: 'sketch', filter: ['in', ['get', 'role'], ['literal', ['outline', 'measure']]], paint: { 'line-color': ['match', ['get', 'role'], 'outline', '#d32f2f', '#235c83'], 'line-width': 3 } });
    map.addLayer({ id: 'sketch-vertices', type: 'circle', source: 'sketch', filter: ['==', ['get', 'role'], 'vertex'], paint: { 'circle-radius': 5, 'circle-color': ['match', ['get', 'tool'], 'outline', '#d32f2f', '#235c83'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'sketch-lengths', type: 'symbol', source: 'sketch', filter: ['==', ['get', 'role'], 'length'], layout: { 'text-field': ['get', 'text'], 'text-size': 12, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, -.9] }, paint: { 'text-color': '#235c83', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
    map.on('mousedown', () => { this.suppressClick = false; });
    map.on('mousedown', 'sketch-vertices', event => {
      if (event.originalEvent.button !== 0 || this.tool === 'select') return;
      const properties = event.features[0].properties;
      if (properties.tool !== this.tool) return;
      event.preventDefault(); this.drag = Number(properties.index); this.moved = false;
      this.panEnabled = map.dragPan.isEnabled(); map.dragPan.disable();
    });
    map.on('mousemove', event => {
      if (this.drag === undefined) return;
      this.moved = true; this[this.tool][this.drag] = [event.lngLat.wrap().lng, event.lngLat.lat];
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.render(); });
    });
    const end = () => {
      if (this.drag === undefined) return;
      cancelAnimationFrame(this.frame); this.frame = null; this.render();
      this.drag = undefined; this.suppressClick = this.moved;
      if (this.panEnabled) map.dragPan.enable();
    };
    map.on('mouseup', end); window.addEventListener('mouseup', end); window.addEventListener('blur', end);
    map.getCanvas().addEventListener('keydown', event => {
      if (this.tool === 'select') return;
      if (event.key === 'Escape') this.setTool('select');
      if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); this.undo(); }
      if (event.key === 'Enter') { event.preventDefault(); if (this.tool === 'outline') this.close(); else this.setTool('select'); }
    });
    this.render();
  }
  setTool(tool) {
    if (!['select', 'outline', 'measure'].includes(tool)) return;
    this.tool = tool; this.map.getCanvas().style.cursor = tool === 'select' ? '' : 'crosshair'; this.render();
  }
  consumeClick(event) {
    if (this.suppressClick) { this.suppressClick = false; return true; }
    if (this.tool === 'select') return false;
    if (!this.map.queryRenderedFeatures(event.point, { layers: ['sketch-vertices'] }).some(item => item.properties.tool === this.tool) && this[this.tool].length < 500) {
      this[this.tool].push([event.lngLat.wrap().lng, event.lngLat.lat]); this.render();
    }
    return true;
  }
  close() { if (this.outline.length >= 3) { this.closed = true; this.setTool('select'); } }
  undo() { if (this.tool !== 'select') { this[this.tool].pop(); if (this.tool === 'outline' && this.outline.length < 3) this.closed = false; this.render(); } }
  clear(tool) { if (tool === 'outline' || tool === 'measure') { this[tool] = []; if (tool === 'outline') this.closed = false; this.render(); } }
  snapshot() {
    return { outline: this.outline.map(point => [...point]), closed: this.closed, measurement: this.measure.map(point => [...point]), horizontalMeters: measurePath(this.measure).meters, perimeterMeters: measurePath(this.outline, this.closed).meters, datum: 'WGS84', nature: 'Traçado manual e distâncias horizontais geodésicas; não constitui levantamento topográfico.' };
  }
  render() {
    const features = [];
    if (this.closed && this.outline.length >= 3) features.push(feature('Polygon', [[...this.outline, this.outline[0]]], { role: 'area' }));
    for (const tool of ['outline', 'measure']) {
      const points = this[tool];
      if (points.length > 1) features.push(feature('LineString', tool === 'outline' && this.closed ? [...points, points[0]] : points, { role: tool }));
      points.forEach((point, index) => features.push(feature('Point', point, { role: 'vertex', tool, index })));
    }
    for (const segment of measurePath(this.measure).segments) features.push(feature('Point', segment.midpoint, { role: 'length', text: meters(segment.meters) }));
    this.map.getSource('sketch').setData({ type: 'FeatureCollection', features });
    const snapshot = this.snapshot();
    localStorage.setItem('kobb-atlas-sketch', JSON.stringify(snapshot));
    this.onChange({ ...snapshot, tool: this.tool });
  }
}
