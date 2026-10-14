export class SolarStudyClient {
  constructor() {
    this.worker = new Worker(new URL('./solar-worker.js', import.meta.url), { type: 'module' });
    this.serial = 0; this.pending = new Map(); this.cache = new Map();
    this.worker.onmessage = event => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      if (event.data.error) { this.cache.delete(pending.key); pending.reject(new Error(event.data.error)); }
      else pending.resolve(event.data.study);
    };
    this.worker.onerror = () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Não foi possível calcular a carta solar.'));
      this.pending.clear(); this.cache.clear();
    };
  }
  study(data) {
    const key = [data.date, data.timeZone, data.latitude, data.longitude, data.elevation].join(':');
    if (this.cache.has(key)) return this.cache.get(key);
    const promise = new Promise((resolve, reject) => { const id = ++this.serial; this.pending.set(id, { resolve, reject, key }); this.worker.postMessage({ id, data }); });
    this.cache.set(key, promise);
    if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value);
    return promise;
  }
  dispose() { this.worker.terminate(); this.pending.clear(); this.cache.clear(); }
}
