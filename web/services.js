const nativePending = new Map();
let serial = 0;
const cache = new Map();
export function clearCache() { cache.clear(); }

if (typeof window !== 'undefined' && window.chrome?.webview) window.chrome.webview.addEventListener('message', event => {
  const message = event.data;
  const pending = nativePending.get(message.id);
  if (!pending) return;
  clearTimeout(pending.timer);
  nativePending.delete(message.id);
  if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.data);
});

export function nativeRequest(type, data) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { nativePending.delete(id); reject(new Error('A consulta excedeu o tempo disponível.')); }, type === 'export-file' ? 180_000 : 40_000);
    nativePending.set(id, { resolve, reject, timer });
    window.chrome.webview.postMessage({ id, type, data });
  });
}

export function weatherKind(date) {
  const selected = new Date(`${date}T12:00:00Z`);
  return selected < new Date(Date.now() - 7 * 86_400_000) ? 'history' : 'forecast';
}

export function apiUrl(type, data) {
  const latitude = Number(data.latitude).toFixed(4);
  const longitude = Number(data.longitude).toFixed(4);
  const hourly = 'wind_speed_10m,wind_direction_10m,temperature_2m,surface_pressure';
  if (type === 'elevation') return `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
  if (type === 'forecast') return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${hourly}&wind_speed_unit=ms&timezone=UTC&forecast_days=16&past_days=7`;
  if (type === 'history') {
    const day = new Date(`${data.date}T12:00:00Z`);
    const start = new Date(day.getTime() - 86_400_000).toISOString().slice(0, 10);
    const end = new Date(day.getTime() + 86_400_000).toISOString().slice(0, 10);
    return `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&hourly=${hourly}&wind_speed_unit=ms&timezone=UTC&models=era5`;
  }
  if (type === 'geocode') return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.query)}&count=6&language=pt&format=json`;
  throw new Error('Consulta desconhecida.');
}

export async function query(type, data) {
  const key = `${type}:${JSON.stringify(data)}`;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  let value;
  if (window.chrome?.webview) value = await nativeRequest(type, data);
  else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      let response;
      if (type === 'noise') response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: overpassQuery(data) }), signal: controller.signal });
      else response = await fetch(apiUrl(type, data), { signal: controller.signal });
      if (!response.ok) throw new Error(`Serviço indisponível (${response.status}).`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.reason ?? 'A fonte não forneceu dados.');
      value = { payload, retrievedAt: new Date().toISOString() };
    } finally { clearTimeout(timeout); }
  }
  cache.set(key, { value, expires: Date.now() + (type === 'history' ? 86_400_000 : 600_000) });
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return value;
}

export function overpassQuery({ latitude, longitude, radius }) {
  const lat = Number(latitude).toFixed(5);
  const lon = Number(longitude).toFixed(5);
  const range = Math.max(100, Math.min(1000, Math.round(Number(radius))));
  return `[out:json][timeout:25];(nwr(around:${range},${lat},${lon})[amenity~"^(place_of_worship|school|university|college|kindergarten|hospital|clinic|theatre|cinema|nightclub|bar|community_centre|townhall)$"];nwr(around:${range},${lat},${lon})[landuse=industrial];nwr(around:${range},${lat},${lon})[building=industrial];nwr(around:${range},${lat},${lon})[man_made=works];);out center tags;`;
}

export function weatherSeries(envelope) {
  const hourly = envelope.payload.hourly;
  if (!hourly?.time) throw new Error('A fonte não retornou uma série horária.');
  return hourly.time.map((time, index) => ({ time: `${time}Z`, speed: hourly.wind_speed_10m?.[index], direction: hourly.wind_direction_10m?.[index], temperature: hourly.temperature_2m?.[index], pressure: hourly.surface_pressure?.[index] }));
}

export function noiseUse(tags) {
  const amenity = tags.amenity;
  if (tags.landuse === 'industrial' || tags.building === 'industrial' || tags.man_made === 'works') return { category: 'industrial', label: 'Indústria', role: 'Fonte potencial' };
  if (amenity === 'place_of_worship') return { category: 'worship', label: 'Templo / local de culto', role: 'Fonte potencial' };
  if (['school', 'university', 'college', 'kindergarten'].includes(amenity)) return { category: 'education', label: 'Instituição de ensino', role: 'Receptor sensível' };
  if (['hospital', 'clinic'].includes(amenity)) return { category: 'health', label: 'Saúde', role: 'Receptor sensível' };
  if (['theatre', 'cinema', 'nightclub', 'bar'].includes(amenity)) return { category: 'entertainment', label: 'Lazer / eventos', role: 'Fonte potencial' };
  if (['community_centre', 'townhall'].includes(amenity)) return { category: 'institution', label: 'Instituição', role: 'Fonte potencial' };
  return null;
}
