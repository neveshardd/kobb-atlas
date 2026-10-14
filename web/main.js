import './style.css';
import logo from '../assets/kobb-studio.png';
import atlasLogo from '../assets/atlas-logo.png';
import { version } from '../package.json';
import timeZoneAt from 'tz-lookup';
import { StudyMap } from './map.js';
import { pointCategories } from './map-display.js';
import { phaseIcon } from './phase-icon.js';
import { SolarStudyClient } from './solar-client.js';
import { solarDiagram, windDiagram } from './diagrams.js';
import { validateLocation, localParts, instantFromLocal, sunPosition, seasonEvents, solarPhase, incidence, shadow } from './solar.js';
import { nearestWind, windRose } from './wind.js';
import { query, nativeRequest, weatherKind, weatherSeries, noiseUse } from './services.js';

const element = id => document.getElementById(id);
const text = (id, value) => { element(id).textContent = value; };
const format = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const numeric = (id, minimum, maximum) => {
  const input = element(id);
  if (input.value.trim() === '' || !input.checkValidity()) { input.focus(); throw new Error('Confira os campos destacados.'); }
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < minimum || value > maximum) { input.focus(); throw new Error('Confira os campos destacados.'); }
  return value;
};
let state = { latitude: -23.5505, longitude: -46.6333, elevation: 0, elevationOrigin: 'Referência 0 m; confirmar altitude', timeZone: 'America/Sao_Paulo', radius: 120, noiseRadius: 500, surfaceAzimuth: 0, surfaceTilt: 90, shadowHeight: 3, solar: true, wind: true, noise: false, buildings: false };
try { const saved = JSON.parse(localStorage.getItem('kobb-atlas-study')); if (saved) { validateLocation(saved.latitude, saved.longitude, saved.elevation); instantFromLocal('2026-01-01', '12:00', saved.timeZone); state = { ...state, latitude: saved.latitude, longitude: saved.longitude, elevation: saved.elevation, elevationOrigin: saved.elevationOrigin ?? 'Informada pelo usuário', timeZone: saved.timeZone }; } } catch {}
Object.assign(state, localParts(new Date(), state.timeZone));
let study, position, selectedWind, weather, series = [], dailySeries = [], pois = [], noiseEnvelope;
let weatherSerial = 0, noiseSerial = 0, refreshSerial = 0, studyKey = '', weatherKey = '', noiseKey = '';
const solarClient = new SolarStudyClient();
function showPoi(properties) {
  text('poi-name', properties.name); text('poi-kind', `${properties.label} · ${properties.role}`); text('poi-noise', 'Nível sonoro não medido'); element('poi-card').hidden = false;
}
const map = new StudyMap((latitude, longitude) => guarded(() => setLocation(latitude, longitude, 'Ponto selecionado', null, null, false)), showPoi, message => { text('map-status', message); element('map-status').hidden = !message; }, threeDimensional => {
  element('view-2d').setAttribute('aria-pressed', String(!threeDimensional));
  element('view-3d').setAttribute('aria-pressed', String(threeDimensional));
}, updateSketch);
element('brand-logo').src = logo;
element('atlas-logo').style.maskImage = `url("${atlasLogo}")`;
for (const zone of ['America/Sao_Paulo', 'America/Manaus', 'America/Recife', 'America/Rio_Branco', 'Europe/Lisbon', 'UTC']) { const option = document.createElement('option'); option.value = zone; element('timezones').append(option); }

function guarded(action) {
  try { const result = action(); if (result?.catch) result.catch(error => text('status', error.message)); }
  catch (error) { text('status', error.message); }
}
function fields() {
  for (const [id, key] of [['latitude', 'latitude'], ['longitude', 'longitude'], ['elevation', 'elevation'], ['timezone', 'timeZone'], ['date', 'date'], ['time', 'time']]) element(id).value = state[key];
}
function setLocation(latitude, longitude, name = 'Ponto selecionado', elevation = null, timeZone = null, focus = true) {
  validateLocation(latitude, longitude, elevation ?? 0);
  state = { ...state, latitude, longitude, elevation: elevation ?? 0, elevationOrigin: elevation === null ? 'Referência 0 m; confirmar altitude' : 'Informada ou geocodificada', timeZone: timeZone ?? timeZoneAt(latitude, longitude) };
  localStorage.setItem('kobb-atlas-study', JSON.stringify(state));
  text('place-name', name); fields();
  const updated = refresh(), movement = focus ? map.focus(latitude, longitude) : Promise.resolve();
  if (elevation === null) loadElevation();
  return Promise.all([updated, movement]);
}
async function loadElevation() {
  const latitude = state.latitude, longitude = state.longitude;
  try {
    const envelope = await query('elevation', { latitude, longitude });
    const elevation = envelope.payload.elevation?.[0];
    if (latitude !== state.latitude || longitude !== state.longitude || !Number.isFinite(elevation) || state.elevationOrigin !== 'Referência 0 m; confirmar altitude') return;
    state.elevation = elevation; state.elevationOrigin = 'Open-Meteo DEM Copernicus GLO-90'; element('elevation').value = elevation; localStorage.setItem('kobb-atlas-study', JSON.stringify(state)); refresh();
  } catch { if (latitude === state.latitude && longitude === state.longitude) text('status', 'Altitude indisponível. Informe a altitude do ponto.'); }
}
function read() {
  const next = { ...state, latitude: numeric('latitude', -85, 85), longitude: numeric('longitude', -180, 180), elevation: numeric('elevation', -500, 9000), date: element('date').value, time: element('time').value, timeZone: element('timezone').value.trim(), radius: numeric('radius', .02, 1000) * 1000, surfaceAzimuth: numeric('surface-azimuth', 0, 359.9), surfaceTilt: numeric('surface-tilt', 0, 90), shadowHeight: numeric('shadow-height', .1, 300) };
  validateLocation(next.latitude, next.longitude, next.elevation);
  instantFromLocal(next.date, next.time, next.timeZone);
  for (const key of ['solar', 'wind', 'noise', 'buildings']) next[key] = element(`${key}-layer`).checked;
  if (next.latitude !== state.latitude || next.longitude !== state.longitude) text('place-name', 'Ponto informado');
  state = next;
  localStorage.setItem('kobb-atlas-study', JSON.stringify(state));
}
function hourLabel(instant) { return instant ? localParts(instant, state.timeZone).time : '—'; }
function bearing(value) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'L', 'LSE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return `${directions[Math.round(value / 22.5) % 16]} · ${format(value, 0)}°`;
}
function updateSeasons() {
  const chosen = element('season').value;
  const select = element('season'); select.replaceChildren();
  const free = document.createElement('option'); free.value = 'free'; free.textContent = 'Data livre'; select.append(free);
  for (const event of seasonEvents(Number(state.date.slice(0, 4)), state.latitude)) {
    const option = document.createElement('option'); option.value = event.instant.toISOString(); option.textContent = event.name; select.append(option);
  }
  if ([...select.options].some(option => option.value === chosen)) select.value = chosen;
}
function refresh() { return renderStudy().catch(error => text('status', error.message)); }
async function renderStudy() {
  read();
  const serial = ++refreshSerial;
  element('export-button').disabled = true;
  const instant = instantFromLocal(state.date, state.time, state.timeZone);
  const key = [state.date, state.timeZone, state.latitude, state.longitude, state.elevation].join(':');
  if (key !== studyKey) {
    const nextStudy = await solarClient.study({ ...state });
    if (serial !== refreshSerial) return;
    study = nextStudy; studyKey = key; updateSeasons();
  }
  position = sunPosition(instant, state.latitude, state.longitude, state.elevation);
  selectedWind = nearestWind(series, instant);
  dailySeries = series.filter(entry => { const date = new Date(entry.time); return date >= study.start && date < study.end; });
  const plane = incidence(position, state.surfaceAzimuth, state.surfaceTilt), cast = shadow(position, state.shadowHeight);
  solarDiagram(element('solar-diagram'), study, position, state.timeZone);
  windDiagram(element('wind-diagram'), selectedWind, dailySeries);
  map.update(state, study, position, selectedWind); configureMap();
  phaseIcon(element('phase'), solarPhase(position.altitude), position.altitude);
  text('coordinates', `${format(state.latitude, 5)}°, ${format(state.longitude, 5)}°`);
  text('solar-azimuth', `${format(position.azimuth)}°`); text('solar-altitude', `${format(position.altitude)}°`);
  text('incidence', plane.exposed ? `${format(plane.angle)}°` : 'Sem sol direto'); text('shadow', cast ? `${format(cast.length)} m` : 'Sem sombra solar');
  text('sunrise-sunset', `Nascer ${hourLabel(study.sunrise)} · Pôr ${hourLabel(study.sunset)}`);
  text('wind-speed', selectedWind ? `${format(selectedWind.speed)} m/s` : '—');
  text('wind-from', selectedWind ? bearing(selectedWind.from) : '—');
  text('wind-to', selectedWind ? bearing(selectedWind.to) : '—');
  text('temperature', selectedWind && Number.isFinite(selectedWind.temperature) ? `${format(selectedWind.temperature)} °C` : '—');
  text('wind-meta', selectedWind ? `${hourLabel(new Date(selectedWind.time))} · Rosa diária: ${windRose(dailySeries).samples} horas · norte geográfico` : 'Sem dados para este horário');
  const [hour, minute] = state.time.split(':').map(Number); element('hour-slider').value = hour * 60 + minute; text('hour-output', `${state.time} ${localParts(instant, state.timeZone).offset}`);
  element('morning').disabled = !study.sunrise; element('noon').disabled = !study.noon; element('night').disabled = !study.night;
  element('noise-legend').hidden = !state.noise;
  if (!state.noise) { map.pois([]); element('poi-card').hidden = true; }
  if (!state.noise) text('status', '');
  loadWeather(); if (state.noise) loadNoise();
  element('export-button').disabled = false;
}
async function loadWeather() {
  const kind = weatherKind(state.date), key = `${kind}:${state.latitude}:${state.longitude}:${state.date}`;
  if (key === weatherKey) return;
  weatherKey = key; const serial = ++weatherSerial;
  series = []; selectedWind = null; weather = null;
  text('wind-kind', 'Consultando…');
  windDiagram(element('wind-diagram'), null, []); map.update(state, study, position, null);
  for (const id of ['wind-speed', 'wind-from', 'wind-to', 'temperature']) text(id, '—');
  text('wind-meta', 'Consultando a fonte');
  try {
    const envelope = await query(kind, { latitude: state.latitude, longitude: state.longitude, date: state.date });
    if (serial !== weatherSerial) return;
    series = weatherSeries(envelope); weather = { ...envelope, kind };
    text('wind-kind', kind === 'history' ? 'Reanálise ERA5' : 'Previsão / modelo'); await refresh();
    if (!selectedWind) text('wind-kind', 'Sem dados');
  } catch (error) {
    if (serial !== weatherSerial) return;
    text('wind-kind', 'Indisponível'); text('wind-meta', 'Sem dados da fonte'); text('status', `Vento: ${error.message}`);
  }
}
async function loadNoise() {
  const key = `${state.latitude}:${state.longitude}:${state.noiseRadius}`;
  if (key === noiseKey) { map.pois(pois); return; }
  noiseKey = key; const serial = ++noiseSerial;
  pois = []; noiseEnvelope = null; map.pois([]); text('status', 'Consultando usos do entorno…');
  try {
    const envelope = await query('noise', { latitude: state.latitude, longitude: state.longitude, radius: state.noiseRadius });
    if (serial !== noiseSerial) return;
    if (envelope.payload.remark && !envelope.payload.elements?.length) throw new Error('A fonte não concluiu a consulta.');
    noiseEnvelope = envelope;
    const seen = new Set();
    pois = (envelope.payload.elements ?? []).flatMap(item => {
      const use = noiseUse(item.tags ?? {}), point = item.center ?? item;
      const id = `${item.type}/${item.id}`;
      if (!use || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || seen.has(id)) return [];
      seen.add(id); return [{ ...use, latitude: point.lat, longitude: point.lon, name: item.tags?.name ?? use.label, osmId: id, soundLevel: null }];
    });
    if (state.noise) map.pois(pois);
    text('status', envelope.payload.remark ? `Consulta incompleta · ${pois.length} usos cadastrados` : pois.length ? `${pois.length} usos cadastrados · níveis sonoros não medidos` : 'Nenhum uso identificado no cadastro consultado');
  } catch (error) { if (serial === noiseSerial) { noiseKey = ''; text('status', `Entorno: ${error.message}`); } }
}
function report() {
  return { product: 'KOBB Atlas', version, exportedAt: new Date().toISOString(), localDate: state.date, annotations: map.sketchReport(), location: { latitude: state.latitude, longitude: state.longitude, elevationMeters: state.elevation, datum: 'WGS84', altitudeOrigin: state.elevationOrigin }, instant: instantFromLocal(state.date, state.time, state.timeZone).toISOString(), timeZone: state.timeZone, solar: { ...position, engine: 'Astronomy Engine 2.1.19', refraction: 'padrão', sunrise: study.sunrise, sunset: study.sunset, solarNoon: study.noon, plane: { azimuth: state.surfaceAzimuth, tilt: state.surfaceTilt, ...incidence(position, state.surfaceAzimuth, state.surfaceTilt) }, shadow: { height: state.shadowHeight, result: shadow(position, state.shadowHeight), model: 'plano horizontal sem obstruções' }, samples: study.samples }, weather: weather ? { provider: 'Open-Meteo', kind: weather.kind, retrievedAt: weather.retrievedAt, grid: { latitude: weather.payload.latitude, longitude: weather.payload.longitude, elevation: weather.payload.elevation }, units: weather.payload.hourly_units, selected: selectedWind, daily: dailySeries } : null, surroundings: { enabled: state.noise, provider: 'OpenStreetMap / Overpass', retrievedAt: noiseEnvelope?.retrievedAt ?? null, radiusMeters: state.noiseRadius, items: state.noise ? pois : [], measuredSoundLevels: false }, map: { radiusMeters: state.radius, provider: element('basemap').value === 'satellite' ? 'Esri World Imagery' : 'OpenFreeMap / OpenStreetMap', pointCategories: pointCategories.filter(category => element(`points-${category}`).checked), terrain: element('terrain-layer').checked ? 'Mapterhorn 30 m' : null, verticalExaggeration: 1, buildingHeightsMayBeEstimated: true }, scope: 'Estudo ambiental preliminar. Não constitui avaliação normativa, medição acústica, vento estrutural ou simulação de obstruções.' };
}
let customMapColors = false;
const palette = { land: '#edf0e8', water: '#c0dfeb', roads: '#ffffff', buildings: '#c2c5bd', labels: '#39433c' };
try {
  const saved = JSON.parse(localStorage.getItem('kobb-atlas-appearance'));
  if (saved && Number.isFinite(saved.intensity) && saved.intensity >= 0 && saved.intensity <= 100) {
    element('map-intensity').value = saved.intensity;
    for (const key of Object.keys(palette)) if (/^#[0-9a-f]{6}$/i.test(saved[key])) element(`color-${key}`).value = saved[key];
    customMapColors = saved.custom === true;
  }
} catch {}
function updateSketch(data) {
  for (const tool of ['select', 'outline', 'measure']) { element(`tool-${tool}`).disabled = false; element(`tool-${tool}`).setAttribute('aria-pressed', String(data.tool === tool)); }
  element('close-outline').disabled = data.outline.length < 3 || data.closed;
  element('sketch-undo').disabled = data.tool === 'select' || !(data.tool === 'outline' ? data.outline.length : data.measurement.length);
  element('clear-outline').disabled = !data.outline.length; element('clear-measure').disabled = !data.measurement.length;
  text('sketch-help', data.tool === 'outline' ? 'Clique para desenhar. Arraste os pontos para editar. Enter fecha o contorno; Esc volta ao ponto.' : data.tool === 'measure' ? 'Clique nos extremos para medir. Arraste os pontos para ajustar. Esc conclui a trena.' : 'Selecione um ponto do estudo ou escolha Contorno e Trena.');
  text('outline-result', data.outline.length ? `Contorno: ${data.outline.length} pontos · ${data.closed ? 'perímetro' : 'comprimento'} ${format(data.perimeterMeters, 2)} m` : '');
  text('measure-result', `Trena: ${format(data.horizontalMeters, 2)} m`);
}
for (const tool of ['select', 'outline', 'measure']) element(`tool-${tool}`).addEventListener('click', () => map.tool(tool));
element('close-outline').addEventListener('click', () => map.sketchAction('close'));
element('sketch-undo').addEventListener('click', () => map.sketchAction('undo'));
for (const tool of ['outline', 'measure']) element(`clear-${tool}`).addEventListener('click', () => map.sketchAction('clear', tool));
for (const key of Object.keys(palette)) element(`color-${key}`).addEventListener('input', () => { customMapColors = true; configureMap(); });
element('map-intensity').addEventListener('input', configureMap);
element('reset-appearance').addEventListener('click', () => { customMapColors = false; for (const [key, color] of Object.entries(palette)) element(`color-${key}`).value = color; element('map-intensity').value = 100; configureMap(); });
function configureMap() {
  const categories = pointCategories.filter(category => element(`points-${category}`).checked);
  const all = element('points-all'); all.checked = categories.length === pointCategories.length; all.indeterminate = categories.length > 0 && !all.checked;
  const satellite = element('basemap').value === 'satellite';
  element('map-appearance').disabled = satellite;
  text('map-intensity-value', `${element('map-intensity').value}%`);
  const appearance = { intensity: Number(element('map-intensity').value), custom: customMapColors, ...Object.fromEntries(Object.keys(palette).map(key => [key, element(`color-${key}`).value])) };
  localStorage.setItem('kobb-atlas-appearance', JSON.stringify(appearance));
  map.configure({ appearance, basemap: element('basemap').value, quality: element('map-quality').value, terrain: element('terrain-layer').checked, buildings: element('buildings-layer').checked, categories });
}
for (const id of ['basemap', 'map-quality', 'terrain-layer', ...pointCategories.map(category => `points-${category}`)]) element(id).addEventListener('change', configureMap);
element('points-all').addEventListener('change', () => {
  for (const category of pointCategories) element(`points-${category}`).checked = element('points-all').checked;
  configureMap();
});
element('apply-location').addEventListener('click', () => guarded(() => setLocation(numeric('latitude', -85, 85), numeric('longitude', -180, 180), 'Ponto informado', numeric('elevation', -500, 9000))));
const liveFields = ['latitude', 'longitude', 'elevation', 'date', 'time', 'timezone', 'radius', 'surface-azimuth', 'surface-tilt', 'shadow-height'];
let liveTimer;
function updateLive() {
  clearTimeout(liveTimer);
  if (liveFields.some(id => !element(id).value.trim() || !element(id).checkValidity())) return;
  try { instantFromLocal(element('date').value, element('time').value, element('timezone').value.trim()); }
  catch { return; }
  guarded(refresh);
}
for (const id of liveFields) {
  element(id).addEventListener('input', () => { clearTimeout(liveTimer); liveTimer = setTimeout(updateLive, 120); });
  element(id).addEventListener('change', updateLive);
}
for (const id of ['solar-layer', 'wind-layer', 'noise-layer', 'buildings-layer']) element(id).addEventListener('change', () => guarded(refresh));
let sliderFrame;
element('hour-slider').addEventListener('input', () => { cancelAnimationFrame(sliderFrame); sliderFrame = requestAnimationFrame(() => guarded(() => { const minutes = Number(element('hour-slider').value); element('time').value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; refresh(); })); });
element('now').addEventListener('click', () => guarded(() => { Object.assign(state, localParts(new Date(), state.timeZone)); fields(); refresh(); }));
for (const [id, key] of [['morning', 'sunrise'], ['noon', 'noon'], ['night', 'night']]) element(id).addEventListener('click', () => guarded(() => { if (!study[key]) return; const event = new Date(study[key].getTime() + (id === 'morning' ? 30 : id === 'night' ? 5 : 0) * 60_000); Object.assign(state, localParts(event, state.timeZone)); fields(); refresh(); }));
element('season').addEventListener('change', () => guarded(() => { if (element('season').value === 'free') return; Object.assign(state, localParts(new Date(element('season').value), state.timeZone)); fields(); refresh(); }));
element('search-form').addEventListener('submit', event => {
  event.preventDefault(); guarded(async () => {
    const name = element('search').value.trim(); if (name.length < 2) { element('search').focus(); return; }
    const target = element('search-results'); target.replaceChildren(); text('status', 'Buscando cidade…');
    const envelope = await query('geocode', { query: name });
    for (const place of envelope.payload.results ?? []) { const button = document.createElement('button'); const label = [place.name, place.admin1, place.country].filter(Boolean).join(' · '); button.textContent = label; button.addEventListener('click', () => guarded(() => { setLocation(place.latitude, place.longitude, label, place.elevation ?? 0, place.timezone); target.replaceChildren(); })); target.append(button); }
    text('status', target.childElementCount ? '' : 'Cidade não encontrada');
  });
});
element('locate').addEventListener('click', () => guarded(async () => {
  const button = element('locate'), icon = button.innerHTML, label = button.getAttribute('aria-label');
  button.disabled = true; button.setAttribute('aria-busy', 'true'); button.setAttribute('aria-label', 'Obtendo localização'); button.innerHTML = '<span class="locating-spinner" aria-hidden="true"></span>';
  text('status', 'Obtendo localização...');
  try {
    const location = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15_000, maximumAge: 60_000 }));
    await setLocation(location.coords.latitude, location.coords.longitude, 'Minha localização', location.coords.altitude ?? null);
  } catch { text('status', 'Localização indisponível. Busque a cidade ou informe o ponto.'); }
  finally { button.disabled = false; button.setAttribute('aria-busy', 'false'); button.setAttribute('aria-label', label); button.innerHTML = icon; }
}));
for (const dimension of ['2d', '3d']) element(`view-${dimension}`).addEventListener('click', () => { map.view(dimension === '3d'); });
element('focus-point').addEventListener('click', () => map.focus(state.latitude, state.longitude));
element('close-poi').addEventListener('click', () => { element('poi-card').hidden = true; });
element('sources-button').addEventListener('click', () => { text('source-time', weather ? `Consulta meteorológica: ${new Date(weather.retrievedAt).toLocaleString('pt-BR')} · uso gratuito não comercial` : 'Dados meteorológicos indisponíveis · uso gratuito não comercial'); element('sources-dialog').showModal(); });
for (const id of ['close-sources', 'sources-done']) element(id).addEventListener('click', () => element('sources-dialog').close());
element('export-button').addEventListener('click', () => element('export-dialog').showModal());
element('close-export').addEventListener('click', () => element('export-dialog').close());
if (window.chrome?.webview) nativeRequest('export-capabilities', {}).then(result => { element('export-format').querySelector('[value="dwg"]').disabled = !result.dwg; }).catch(() => {});
element('export-save').addEventListener('click', () => guarded(async () => {
  const button = element('export-save'); button.disabled = true;
  text('status', 'Preparando arquivo...');
  try {
    const data = report();
    const { exportStudy } = await import('./study-export.js');
    const result = await exportStudy(element('export-format').value, map, data);
    if (result.saved) { text('status', result.path ? `Arquivo salvo: ${result.path}` : 'Estudo exportado'); element('export-dialog').close(); }
    else text('status', '');
  } finally { button.disabled = false; }
}));

element('elevation').addEventListener('input', () => { state.elevationOrigin = 'Informada pelo usuário'; });
fields(); guarded(refresh); map.focus(state.latitude, state.longitude); if (state.elevationOrigin === 'Referência 0 m; confirmar altitude') loadElevation();
