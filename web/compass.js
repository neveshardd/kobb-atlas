const namespace = 'http://www.w3.org/2000/svg';
const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
function node(name, attributes, text) {
  const element = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

export class MapCompass {
  constructor(map, container) {
    this.map = map;
    this.container = container;
    this.svg = node('svg', { viewBox: '0 0 180 180', 'aria-hidden': 'true' });
    this.readout = document.createElement('span');
    this.readout.className = 'compass-readout';
    container.append(this.svg, this.readout);
    this.parts = new Map();
    const schedule = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = null; this.update(); });
    };
    map.on('rotate', schedule);
    map.on('pitch', schedule);
    this.update();
  }

  part(key, name, attributes, text) {
    let element = this.parts.get(key);
    if (!element) { element = node(name, attributes, text); this.parts.set(key, element); this.svg.append(element); }
    else for (const [attribute, value] of Object.entries(attributes)) if (element.getAttribute(attribute) !== String(value)) element.setAttribute(attribute, value);
  }

  update() {
    const bearing = this.map.getBearing(), pitch = this.map.getPitch();
    const radians = Math.PI / 180, tilt = pitch * radians;
    const project = (angle, radius, height = 0) => {
      const direction = (angle - bearing) * radians;
      const east = Math.sin(direction) * radius, north = Math.cos(direction) * radius;
      const depth = north * Math.sin(tilt) + height * Math.cos(tilt);
      const perspective = 340 / (340 + depth);
      return [90 + east * perspective, 88 - (north * Math.cos(tilt) + height * Math.sin(tilt)) * perspective];
    };
    const path = points => points.map((point, index) => `${index ? 'L' : 'M'}${point.join(' ')}`).join(' ') + 'Z';
    const ring = Array.from({ length: 65 }, (_, index) => project(index * 360 / 64, 55));
    this.part('ring', 'path', { d: path(ring), fill: 'none', stroke: '#b6bdb1', 'stroke-width': 1 });
    for (let index = 0; index < 8; index++) {
      const angle = index * 45, cardinal = index % 2 === 0, diagonal = true;
      const tip = project(angle, diagonal ? 51 : 47, 5);
      const left = project(angle - (cardinal ? 24 : 13), cardinal ? 13 : 10, 5);
      const right = project(angle + (cardinal ? 24 : 13), cardinal ? 13 : 10, 5);
      const origin = project(angle, 0, 5);
      this.part(`side-${index}`, 'path', { d: path([left, tip, project(angle, diagonal ? 51 : 47), project(angle - (cardinal ? 24 : 13), cardinal ? 13 : 10)]), fill: index === 0 ? '#70430a' : '#777f75' });
      this.part(`left-${index}`, 'path', { d: path([origin, left, tip]), fill: index === 0 ? '#ad6b0a' : cardinal ? '#263a30' : '#a3afa0' });
      this.part(`right-${index}`, 'path', { d: path([origin, tip, right]), fill: index === 0 ? '#e2b66a' : '#d1d9cc' });
      const label = project(angle, cardinal ? 73 : 72, 5);
      this.part(`label-${index}`, 'text', { x: label[0], y: label[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': cardinal ? 12 : 8, 'font-weight': cardinal ? 700 : 400, fill: index === 0 ? '#915700' : '#263a30' }, directions[index]);
    }
    const center = project(0, 0, 5);
    this.part('center', 'circle', { cx: center[0], cy: center[1], r: 3, fill: '#263a30' });
    const heading = ((bearing % 360) + 360) % 360;
    this.readout.textContent = `${Math.round(heading) % 360}°`;
    this.container.setAttribute('aria-label', `Rosa dos ventos. Norte geográfico. Azimute da câmera ${Math.round(heading) % 360} graus; inclinação ${Math.round(pitch)} graus.`);
  }
}
