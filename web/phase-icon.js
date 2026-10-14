const icons = {
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  civil: '<path d="M2 16h20M5 13a7 7 0 0 1 14 0M12 2v2M3 6l2 2m14 0 2-2M5 20h14"/>',
  nautical: '<path d="M3 17h18M7 21h10M13 4a6 6 0 0 0 6 9 6 6 0 0 1-6-9ZM4 4v4M2 6h4"/>',
  astronomical: '<path d="M15 3a8 8 0 1 0 6 12A8 8 0 0 1 15 3ZM5 3v3M3.5 4.5h3M20 4v4M18 6h4"/>',
  night: '<path d="M17 3a9 9 0 1 0 4 14A9 9 0 0 1 17 3Z"/>'
};

export function phaseIcon(element, label, altitude) {
  if (element.dataset.phase === label) return;
  element.dataset.phase = label;
  const kind = altitude >= 0 ? 'day' : altitude >= -6 ? 'civil' : altitude >= -12 ? 'nautical' : altitude >= -18 ? 'astronomical' : 'night';
  element.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${altitude >= -6 ? '#ad6b0a' : '#405966'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[kind]}</svg>`;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
  element.title = label;
}
