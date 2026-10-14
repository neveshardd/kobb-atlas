const endpoint = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
export const satelliteSource = maxzoom => ({ type: 'raster', tiles: [`${endpoint}/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom, attribution: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community' });
export function imageryTile(longitude, latitude, zoom) {
  const count = 2 ** zoom, lat = Math.max(-85, Math.min(85, latitude));
  const lng = ((longitude + 180) % 360 + 360) % 360 - 180;
  return { x: Math.max(0, Math.min(count - 1, Math.floor((lng + 180) / 360 * count))), y: Math.max(0, Math.min(count - 1, Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * count))) };
}
export class SatelliteCoverage {
  constructor(map, beforeLayer, onLimit) {
    this.map = map; this.beforeLayer = beforeLayer; this.onLimit = onLimit; this.cache = new Map(); this.serial = 0;
    map.on('moveend', () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.check(), 250); });
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active; this.serial++;
    this.map.setMaxZoom(active ? 16 : 22);
    if (active) this.check();
    this.onLimit(active);
  }
  async check() {
    if (!this.active) return;
    const center = this.map.getCenter(), tile = imageryTile(center.lng, center.lat, 16), key = `${tile.x}:${tile.y}`;
    if (this.key === key) return;
    this.key = key;
    const serial = ++this.serial;
    let limit = this.cache.get(key);
    if (limit === undefined) {
      limit = 12;
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
      try {
        for (let zoom = 19; zoom >= 12; zoom--) {
          const point = imageryTile(center.lng, center.lat, zoom);
          const response = await fetch(`${endpoint}/tilemap/${zoom}/${point.y}/${point.x}/1/1?f=json`, { signal: controller.signal });
          if (!response.ok) throw new Error('Cobertura indisponível');
          const result = await response.json();
          if (!Array.isArray(result.data)) throw new Error('Cobertura indisponível');
          if (result.data[0] === 1) { limit = zoom; break; }
        }
        this.cache.set(key, limit);
        if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value);
      } catch { this.key = null; }
      finally { clearTimeout(timeout); }
    }
    if (!this.active || serial !== this.serial) return;
    const source = this.map.getSource('satellite');
    if (source.maxzoom !== limit) {
      this.map.removeLayer('satellite-image'); this.map.removeSource('satellite');
      this.map.addSource('satellite', satelliteSource(limit));
      this.map.addLayer({ id: 'satellite-image', type: 'raster', source: 'satellite', paint: { 'raster-fade-duration': 0 } }, this.beforeLayer);
    }
    this.map.setMaxZoom(limit);
    this.onLimit(true, limit);
  }
}
