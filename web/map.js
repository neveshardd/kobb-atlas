import { Map as LibreMap, NavigationControl, setWorkerUrl, setWorkerCount } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { offsetPoint } from './geometry.js';
import { SolarLayer } from './solar-layer.js';
import { TerrainOrbit } from './orbit.js';
import { MapCompass } from './compass.js';
import { MapDisplay } from './map-display.js';
import { windStrength, windGlyph } from './wind.js';

setWorkerUrl(workerUrl);
setWorkerCount(Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 4) - 1)));
const collection = features => ({ type: 'FeatureCollection', features });
const feature = (type, coordinates, properties = {}) => ({ type: 'Feature', properties, geometry: { type, coordinates } });

export class StudyMap {
  constructor(onPoint, onPoi, onState, onView = () => {}) {
    this.ready = false;
    this.map = new LibreMap({ container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-46.6333, -23.5505], zoom: 16, pitch: 50, maxPitch: 60, pixelRatio: 0.85, maxTileCacheSize: 80, maxTileCacheZoomLevels: 2, fadeDuration: 0, attributionControl: true, locale: { 'Map.Title': 'Mapa do estudo', 'NavigationControl.ZoomIn': 'Aproximar', 'NavigationControl.ZoomOut': 'Afastar', 'NavigationControl.ResetBearing': 'Girar mapa; clique para alinhar ao norte', 'AttributionControl.ToggleAttribution': 'Mostrar fontes do mapa' } });
    const syncView = () => onView(this.map.getPitch() > 0.01);
    this.map.on('pitch', syncView);
    syncView();
    this.compass = new MapCompass(this.map, document.getElementById('map-compass'));
    this.map.dragRotate.disable();
    this.orbit = new TerrainOrbit(this.map);
    this.map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    this.map.on('error', event => { if (!this.ready) onState('Mapa indisponível. Verifique a conexão.'); });
    this.map.on('click', event => {
      if (event.originalEvent.button !== 0) return;
      if (this.ready && this.map.queryRenderedFeatures(event.point, { layers: ['poi-icons'] }).length) return;
      onPoint(event.lngLat.lat, event.lngLat.wrap().lng);
    });
    this.map.on('load', () => {
      const baseLayers = this.map.getStyle().layers;
      this.map.addSource('satellite', { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community' });
      this.map.addLayer({ id: 'satellite-image', type: 'raster', source: 'satellite', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } }, baseLayers[0].id);
      this.map.addSource('terrain', { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', tileSize: 512, maxzoom: 12, encoding: 'terrarium', attribution: '© <a href="https://mapterhorn.com/attribution/">Mapterhorn</a>' });
      for (const id of ['solar', 'wind', 'point', 'poi']) this.map.addSource(id, { type: 'geojson', data: collection([]) });
      this.map.addLayer({ id: 'solar-line', type: 'line', source: 'solar', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': ['match', ['get', 'kind'], 'ring', '#777777', '#bf7800'], 'line-width': ['match', ['get', 'kind'], 'ring', 1, 3] } });
      this.sky = new SolarLayer(); this.map.addLayer(this.sky);
      this.addWindIcons();
      this.map.addLayer({ id: 'wind-icons', type: 'symbol', source: 'wind', layout: { 'icon-image': ['get', 'icon'], 'icon-size': .8, 'icon-rotate': ['get', 'rotation'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true } });
      this.map.addLayer({ id: 'study-point', type: 'circle', source: 'point', paint: { 'circle-radius': 5, 'circle-color': '#111111', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      this.addIcons();
      this.map.addLayer({ id: 'poi-icons', type: 'symbol', source: 'poi', layout: { 'icon-image': ['get', 'category'], 'icon-size': 0.75, 'icon-allow-overlap': true, 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport' } });
      this.map.moveLayer('solar-sky');
      this.map.on('click', 'poi-icons', event => onPoi(event.features[0].properties));
      this.map.on('mouseenter', 'poi-icons', () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', 'poi-icons', () => { this.map.getCanvas().style.cursor = ''; });
      this.display = new MapDisplay(this.map, baseLayers);
      this.ready = true;
      if (this.displaySettings) this.display.apply(this.displaySettings);
      if (this.pending) this.update(...this.pending);
      if (this.pendingPois) this.pois(this.pendingPois);
      onState('');
    });
  }

  addWindIcons() {
    for (const count of [1, 2, 3]) {
      const canvas = document.createElement('canvas'); canvas.width = (count * 34 + 8) * 2; canvas.height = 72;
      const context = canvas.getContext('2d'); context.scale(2, 2);
      for (let index = 0; index < count; index++) {
        context.save(); context.translate(4 + index * 34, 5); context.lineCap = 'round'; context.lineJoin = 'round';
        context.strokeStyle = '#ffffff'; context.lineWidth = 5; context.stroke(new Path2D(windGlyph));
        context.strokeStyle = '#236d8e'; context.lineWidth = 2; context.stroke(new Path2D(windGlyph)); context.restore();
      }
      this.map.addImage(`wind-${count}`, context.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
    }
  }

  addIcons() {
    const paths = {
      industrial: 'M8 25V13L16 18V13L24 18V8H29V25ZM12 22H15M20 22H23',
      worship: 'M8 26V16L18 8L28 16V26ZM18 8V3M14 5H22M16 26V19H20V26',
      education: 'M5 13L18 7L31 13L18 19ZM10 16V24Q18 29 26 24V16M30 14V24',
      health: 'M13 6H23V13H30V23H23V30H13V23H6V13H13Z',
      entertainment: 'M11 25V8L27 5V22M11 14L27 11M11 25C11 31 3 31 3 26C3 22 11 21 11 25M27 22C27 28 19 28 19 23C19 19 27 18 27 22',
      institution: 'M5 12L18 5L31 12ZM8 14V26M15 14V26M22 14V26M29 14V26M5 28H31'
    };
    for (const [category, path] of Object.entries(paths)) {
      const canvas = document.createElement('canvas'); canvas.width = 72; canvas.height = 72;
      const context = canvas.getContext('2d'); context.scale(2, 2);
      context.fillStyle = ['education', 'health'].includes(category) ? '#236d8e' : '#995d3b';
      context.beginPath(); context.arc(18, 18, 17, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#ffffff'; context.lineWidth = 1.5; context.stroke(new Path2D(path));
      this.map.addImage(category, context.getImageData(0, 0, 72, 72), { pixelRatio: 2 });
    }
  }

  update(state, study, position, wind) {
    this.orbit.setTarget(state.latitude, state.longitude);
    this.pending = [state, study, position, wind];
    if (!this.ready) return;
    const ringKey = [state.latitude, state.longitude, state.radius, state.solar || state.wind].join(':');
    if (ringKey !== this.ringKey) {
      this.ringKey = ringKey;
      const ring = Array.from({ length: 73 }, (_, index) => offsetPoint(state.latitude, state.longitude, state.radius * Math.sin(index * Math.PI / 36), state.radius * Math.cos(index * Math.PI / 36)));
      this.map.getSource('solar').setData(collection(state.solar || state.wind ? [feature('LineString', ring, { kind: 'ring' })] : []));
      if (this.renderedRadius !== undefined && this.renderedRadius !== state.radius) {
        const longitudes = ring.map(point => point[0]), latitudes = ring.map(point => Math.max(-85, Math.min(85, point[1])));
        this.map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 50, maxZoom: 18, duration: 500 });
      }
      this.renderedRadius = state.radius;
    }
    const sunKey = [study.start.toISOString(), state.latitude, state.longitude, state.elevation, state.radius, state.solar, position.azimuth, position.altitude].join(':');
    if (sunKey !== this.sunKey) { this.sunKey = sunKey; this.sky.update(state, study, position); }
    const windKey = [state.latitude, state.longitude, state.radius, state.wind, wind?.from, wind?.speed].join(':');
    if (windKey !== this.windKey) {
      this.windKey = windKey;
      const angle = (wind?.from ?? 0) * Math.PI / 180;
      const point = offsetPoint(state.latitude, state.longitude, Math.sin(angle) * state.radius, Math.cos(angle) * state.radius);
      this.map.getSource('wind').setData(collection(state.wind && wind ? [feature('Point', point, { icon: `wind-${windStrength(wind.speed).icons}`, rotation: wind.to - 90 })] : []));
    }
    const pointKey = `${state.latitude}:${state.longitude}`;
    if (pointKey !== this.pointKey) { this.pointKey = pointKey; this.map.getSource('point').setData(collection([feature('Point', [state.longitude, state.latitude])])); }
  }

  pois(items) {
    if (this.ready && this.renderedPois === items) return;
    this.pendingPois = items;
    if (this.ready) { this.renderedPois = items; this.map.getSource('poi').setData(collection(items.map(item => feature('Point', [item.longitude, item.latitude], item)))); }
  }
  configure(settings) {
    this.displaySettings = settings;
    if (this.ready) this.display.apply(settings);
  }
  snapshot() {
    if (!this.ready) return Promise.reject(new Error('Aguarde o mapa carregar para exportar.'));
    return new Promise((resolve, reject) => {
      const capture = () => {
        clearTimeout(timeout);
        try {
          const source = this.map.getCanvas();
          const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
          canvas.getContext('2d').drawImage(source, 0, 0);
          resolve(canvas);
        } catch (error) { reject(error); }
      };
      const timeout = setTimeout(() => { this.map.off('render', capture); reject(new Error('O mapa demorou para preparar a exportação.')); }, 10_000);
      this.map.once('render', capture);
      this.map.triggerRepaint();
    });
  }
  view(threeDimensional) {
    if (!threeDimensional && this.ready) this.map.setTerrain(null);
    this.map.easeTo({ pitch: threeDimensional ? 50 : 0, duration: 350 });
    this.map.once('moveend', () => {
      if (this.displaySettings && this.ready) { this.display.settings = null; this.display.apply(this.displaySettings); }
    });
  }
  focus(latitude, longitude) { this.map.easeTo({ center: [longitude, latitude], zoom: Math.max(this.map.getZoom(), 16), duration: 600 }); }
}
