export class TerrainOrbit {
  constructor(map) {
    this.map = map;
    this.target = null;
    const canvas = map.getCanvas();
    canvas.addEventListener('pointerdown', event => this.start(event), true);
    canvas.addEventListener('pointermove', event => this.move(event), true);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => this.end(event), true);
    canvas.addEventListener('mousedown', event => {
      if (this.drag) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('blur', () => this.end());
  }

  setTarget(latitude, longitude) { this.target = [longitude, latitude]; }

  start(event) {
    if (!this.target || event.pointerType !== 'mouse' || !(event.button === 1 || event.button === 2 || (event.button === 0 && event.ctrlKey))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    this.map.stop();
    if (this.map.getPitch() <= 0.01) this.map.jumpTo({ pitch: 50 });
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, bearing: this.map.getBearing(), pitch: this.map.getPitch(), target: [...this.target] };
    this.map.getCanvas().setPointerCapture(event.pointerId);
    this.map.getCanvas().style.cursor = 'grabbing';
  }

  move(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    event.preventDefault(); event.stopImmediatePropagation();
    this.pending = { x: event.clientX, y: event.clientY };
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.draw(); });
  }

  draw() {
    if (!this.drag || !this.pending) return;
    const drag = this.drag, position = this.pending;
    this.pending = null;
    this.map.jumpTo({ center: drag.target, bearing: drag.bearing + (position.x - drag.x) * .4, pitch: Math.max(0, Math.min(this.map.getMaxPitch(), drag.pitch - (position.y - drag.y) * .3)) });
  }

  end(event) {
    if (!this.drag || (event && event.pointerId !== this.drag.pointerId)) return;
    cancelAnimationFrame(this.frame); this.frame = null; this.draw();
    const canvas = this.map.getCanvas();
    const pointerId = this.drag.pointerId;
    this.drag = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    canvas.style.cursor = '';
  }
}
