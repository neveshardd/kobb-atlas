import { MercatorCoordinate } from 'maplibre-gl';
import { Matrix4, Vector3 } from 'three';
import { solarVector } from './solar.js';
import { placeSolarLabels } from './solar-labels.js';

const namespace = 'http://www.w3.org/2000/svg';
function node(type, attributes, text) {
  const element = document.createElementNS(namespace, type);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
export class SolarLayer {
  constructor() { this.id = 'solar-sky'; this.type = 'custom'; this.renderingMode = '3d'; this.key = ''; this.projection = new Matrix4(); this.model = new Matrix4(); this.clip = new Vector3(); this.scaleVector = new Vector3(); }
  onAdd(map) {
    this.map = map; this.canvas = node('svg', { 'aria-hidden': 'true' });
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' });
    map.getCanvasContainer().append(this.canvas);
    this.path = node('path', { fill: 'none', stroke: '#ff7900', 'stroke-width': 34, 'stroke-opacity': 0.78, 'stroke-linejoin': 'bevel', 'stroke-linecap': 'butt' });
    this.labels = node('g', {});
    this.sun = node('circle', { r: 6, fill: '#e1a322', stroke: '#ffffff', 'stroke-width': 2 });
    this.canvas.append(this.path, this.labels, this.sun);
  }
  update(state, study, current) {
    this.state = { ...state }; this.current = current;
    const key = [study.start.toISOString(), state.latitude, state.longitude, state.elevation, state.radius].join(':');
    if (key !== this.key) {
      this.key = key; this.labels.replaceChildren();
      this.samples = study.samples.filter((sample, index, samples) => index % 3 === 0 || index === samples.length - 1 || sample.localTime?.endsWith(':00') || sample.altitude >= 0 !== (samples[Math.max(0, index - 1)].altitude >= 0)).map(sample => ({ ...sample, vector: solarVector(sample, state.radius), label: sample.altitude >= 0 && sample.localTime?.endsWith(':00') && sample.instant < study.end ? node('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Arial', 'font-size': 11, fill: '#663e00', stroke: '#ffffff', 'stroke-width': 1.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, sample.localTime) : null }));
      for (const sample of this.samples) if (sample.label) this.labels.append(sample.label);
    }
    this.map.triggerRepaint();
  }
  render(context, input) {
    if (!this.state) return;
    this.canvas.style.display = this.state.solar ? '' : 'none';
    if (!this.state.solar) return;
    const canvas = this.map.getCanvas(), width = canvas.clientWidth, height = canvas.clientHeight;
    this.canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const ground = this.map.getTerrain() ? this.map.queryTerrainElevation([this.state.longitude, this.state.latitude]) : 0;
    const matrix = input.defaultProjectionData.mainMatrix;
    const renderKey = [this.key, this.current.azimuth, this.current.altitude, ground, width, height, ...matrix].join(':');
    if (renderKey === this.renderKey) return;
    this.renderKey = renderKey;
    const origin = MercatorCoordinate.fromLngLat([this.state.longitude, this.state.latitude], Number.isFinite(ground) ? ground : this.state.elevation);
    const scale = origin.meterInMercatorCoordinateUnits();
    const model = this.model.makeTranslation(origin.x, origin.y, origin.z).scale(this.scaleVector.set(scale, -scale, scale));
    const projection = this.projection.fromArray(matrix).multiply(model);
    const project = vector => {
      const clip = this.clip.set(vector.east, vector.north, vector.up).applyMatrix4(projection);
      return { x: (clip.x + 1) * width / 2, y: (1 - clip.y) * height / 2, visible: clip.z >= -1 && clip.z <= 1 && Number.isFinite(clip.x) && Number.isFinite(clip.y) };
    };
    let path = '', continuous = false;
    const labelSamples = [], labelPoints = [];
    for (const sample of this.samples) {
      const point = project(sample.vector), visible = sample.altitude >= 0 && point.visible;
      if (sample.label) { labelSamples.push(sample); labelPoints.push({ ...point, visible }); }
      if (!visible) { continuous = false; continue; }
      path += `${continuous ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)} `; continuous = true;
    }
    this.path.setAttribute('d', path);
    const placements = placeSolarLabels(labelPoints, width, height);
    for (let index = 0; index < labelSamples.length; index++) {
      const sample = labelSamples[index], placement = placements[index];
      sample.label.style.display = placement ? '' : 'none';
      if (!placement) continue;
      sample.label.setAttribute('x', placement.x); sample.label.setAttribute('y', placement.y);

    }
    const point = project(solarVector(this.current, this.state.radius));
    this.sun.style.display = this.current.altitude >= 0 && point.visible ? '' : 'none';
    this.sun.setAttribute('cx', point.x); this.sun.setAttribute('cy', point.y);
  }
  onRemove() { this.canvas.remove(); }
}
