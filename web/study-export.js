import { cadDrawing } from './cad-export.js';
import { nativeRequest } from './services.js';

function imageFrom(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Não foi possível preparar a imagem do estudo.')); image.src = url;
  });
}
async function svgImage(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const box = svg.viewBox.baseVal;
  clone.setAttribute('width', box.width || 220); clone.setAttribute('height', box.height || 220);
  clone.style.width = `${box.width || 220}px`; clone.style.height = `${box.height || 220}px`;
  for (const label of clone.querySelectorAll('text')) if (svg.closest('#map-compass')) { label.setAttribute('stroke', '#ffffff'); label.setAttribute('stroke-width', '2'); label.setAttribute('paint-order', 'stroke'); }
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try { return await imageFrom(url); } finally { URL.revokeObjectURL(url); }
}
const number = value => Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 'Indisponível';

export async function studyCanvas(map, report) {
  const snapshot = await map.snapshot();
  const [solar, wind, compass] = await Promise.all(['solar-diagram', 'wind-diagram', 'map-compass'].map(id => svgImage(document.querySelector(id === 'map-compass' ? '#map-compass svg' : `#${id}`))));
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1550;
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  const text = (value, x, y, size = 20, color = '#263a30') => { context.fillStyle = color; context.font = `${size}px Arial`; context.fillText(value, x, y); };
  text('KOBB ATLAS — ESTUDO AMBIENTAL', 50, 65, 30);
  const localTime = value => new Intl.DateTimeFormat('pt-BR', { timeZone: report.timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  text(`${localTime(report.instant)} · ${report.timeZone}`, 50, 103);
  text(`Latitude ${report.location.latitude}° · Longitude ${report.location.longitude}° · Altitude ${number(report.location.elevationMeters)} m`, 50, 137);
  text(`Raio ${number(report.map.radiusMeters / 1000)} km · ${report.map.provider}`, 50, 169);
  const scale = Math.min(1500 / snapshot.width, 720 / snapshot.height);
  const mapWidth = snapshot.width * scale, mapHeight = snapshot.height * scale, mapX = (1600 - mapWidth) / 2;
  context.drawImage(snapshot, mapX, 200, mapWidth, mapHeight);
  const overlay = document.querySelector('#map > .maplibregl-canvas-container > svg');
  if (overlay) context.drawImage(await svgImage(overlay), mapX, 200, mapWidth, mapHeight);
  const cssScale = mapWidth / document.getElementById('map').clientWidth;
  context.drawImage(compass, mapX + mapWidth - 196 * cssScale, 200 + 16 * cssScale, 180 * cssScale, 180 * cssScale);
  const attribution = document.querySelector('.maplibregl-ctrl-attrib-inner')?.textContent?.trim() ?? report.map.provider;
  text(attribution, 50, 200 + mapHeight + 27, 15, '#626861');
  const row = 200 + mapHeight + 75;
  text('SOL', 50, row, 25); text('VENTO', 825, row, 25);
  context.drawImage(solar, 50, row + 25, 260, 260); context.drawImage(wind, 825, row + 25, 260, 260);
  const solarRows = [['Azimute', `${number(report.solar.azimuth)}°`], ['Altitude aparente', `${number(report.solar.altitude)}°`], ['Incidência no plano', document.getElementById('incidence').textContent], ['Sombra em plano', document.getElementById('shadow').textContent]];
  const selected = report.weather?.selected;
  const windRows = [['Velocidade a 10 m', selected ? `${number(selected.speed)} m/s` : 'Indisponível'], ['Vem de', selected ? `${number(selected.from)}°` : 'Indisponível'], ['Vai para', selected ? `${number(selected.to)}°` : 'Indisponível'], ['Temperatura a 2 m', selected ? `${number(selected.temperature)} °C` : 'Indisponível']];
  solarRows.forEach(([label, value], index) => text(`${label}: ${value}`, 340, row + 75 + index * 40));
  windRows.forEach(([label, value], index) => text(`${label}: ${value}`, 1115, row + 75 + index * 40));
  let bottom = row + 315;
  text(`Sol: Astronomy Engine · ${document.getElementById('sunrise-sunset').textContent}`, 50, bottom, 17);
  text(`Vento: Open-Meteo · ${report.weather?.kind === 'history' ? 'Reanálise ERA5' : report.weather ? 'Previsão / modelo' : 'Dados indisponíveis'} · ${document.getElementById('wind-meta').textContent}`, 50, bottom += 30, 17);
  if (report.weather) text(`Consulta meteorológica: ${localTime(report.weather.retrievedAt)} · ${report.timeZone}`, 50, bottom += 30, 17);
  text(`Entorno: OpenStreetMap / Overpass · ${report.surroundings.items.length} usos · níveis sonoros não medidos`, 50, bottom += 30, 17);
  text('Norte geográfico · imagens cartográficas sem garantia de data atual · estudo preliminar, sem certificação normativa.', 50, bottom += 30, 17);
  text(`Exportado em ${localTime(report.exportedAt)} · ${report.timeZone}`, 50, bottom += 30, 15, '#626861');
  const cropped = document.createElement('canvas'); cropped.width = canvas.width; cropped.height = Math.min(canvas.height, bottom + 45);
  cropped.getContext('2d').drawImage(canvas, 0, 0);
  return cropped;
}

export async function exportStudy(format, map, report) {
  let blob;
  if (format === 'dxf' || format === 'dwg') blob = new Blob([cadDrawing(report)], { type: 'application/dxf' });
  else if (format === 'json') blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  else {
    const canvas = await studyCanvas(map, report);
    if (format === 'png') blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const height = 190 * canvas.height / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', 10, 10, 190, height);
      pdf.setProperties({ title: 'KOBB Atlas — estudo ambiental', author: 'KOBB Studio', subject: `${report.instant} | ${report.location.latitude}, ${report.location.longitude}` });
      blob = pdf.output('blob');
    }
  }
  if (!blob) throw new Error('Não foi possível gerar o arquivo do estudo.');
  const filename = `atlas-${report.localDate ?? report.instant.slice(0, 10)}.${format}`;
  if (window.chrome?.webview) {
    const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    return nativeRequest('export-file', { format, filename, content });
  }
  if (format === 'dwg') throw new Error('A exportação DWG requer o Atlas para Windows e AutoCAD instalado. Use DXF neste navegador.');
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true };
}
