import { solarPoint, localParts } from './solar.js';
import { windRose, windStrength, windGlyph } from './wind.js';

const namespace = 'http://www.w3.org/2000/svg';
function node(type, attributes, text) {
  const element = document.createElementNS(namespace, type);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
function frame(svg) {
  svg.replaceChildren();
  for (const radius of [30, 60, 90]) svg.append(node('circle', { cx: 110, cy: 110, r: radius, fill: 'none', stroke: '#d8d8d8' }));
  svg.append(node('path', { d: 'M20 110H200M110 20V200', stroke: '#dddddd', fill: 'none' }));
  for (const [label, x, y] of [['N', 110, 12], ['L', 210, 114], ['S', 110, 217], ['O', 8, 114]]) svg.append(node('text', { x, y, 'text-anchor': 'middle', 'font-size': 11, fill: '#333333' }, label));
}
export function solarDiagram(svg, study, current, timeZone) {
  const project = sample => { const point = solarPoint(sample, 90); return [110 + point.east, 110 - point.north]; };
  if (svg.study !== study) {
  svg.study = study;
  frame(svg);
  let path = '', visible = false;
  for (const sample of study.samples) {
    if (sample.altitude < 0) { visible = false; continue; }
    const [x, y] = project(sample); path += `${visible ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `; visible = true;
    const time = sample.localTime ?? localParts(sample.instant, timeZone).time;
    if (time.endsWith(':00') && sample.instant < study.end) svg.append(node('text', { x: x + 5, y: y - 5, 'font-size': 10, fill: '#805000' }, time.slice(0, 2)));
  }
  svg.append(node('path', { d: path, fill: 'none', stroke: '#bf7800', 'stroke-width': 2 }));
  }
  svg.querySelector('[data-current]')?.remove();
  if (current.altitude >= 0) { const [cx, cy] = project(current); svg.append(node('circle', { cx, cy, r: 5, fill: '#e1a322', stroke: '#ffffff', 'stroke-width': 1.5, 'data-current': true })); }
}
export function windDiagram(svg, selected, series) {
  frame(svg);
  const rose = windRose(series);
  for (const bin of rose.bins) {
    const angle = bin.direction * Math.PI / 180;
    const length = 85 * Math.sqrt(bin.frequency);
    svg.append(node('line', { x1: 110, y1: 110, x2: 110 + Math.sin(angle) * length, y2: 110 - Math.cos(angle) * length, stroke: '#a1bbc8', 'stroke-width': 9 }));
  }
  if (selected) {
    const strength = windStrength(selected.speed), angle = selected.from * Math.PI / 180;
    const group = node('g', { transform: `translate(${110 + Math.sin(angle) * 90} ${110 - Math.cos(angle) * 90}) rotate(${selected.to - 90}) scale(.65)`, 'aria-label': `${strength.label}: ${strength.icons} ícones`, 'data-wind-icons': strength.icons });
    for (let index = 0; index < strength.icons; index++) group.append(node('path', { d: windGlyph, transform: `translate(${index * 34 - strength.icons * 17} -13)`, stroke: '#236d8e', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }));
    svg.append(group);
  } else svg.append(node('text', { x: 110, y: 114, 'text-anchor': 'middle', 'font-size': 12, fill: '#555555' }, selected ? 'Calmo' : 'Sem dados'));
}
