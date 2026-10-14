import { writeFileSync } from 'node:fs';
import { cadDrawing } from '../web/cad-export.js';

writeFileSync(process.argv[2], cadDrawing({
  version: 'check', instant: '2026-10-14T15:00:00Z', timeZone: 'America/Sao_Paulo',
  location: { latitude: -23.5505, longitude: -46.6333, elevationMeters: 758 },
  map: { radiusMeters: 1000 },
  solar: { samples: [{ altitude: 0, azimuth: 90, localTime: '06:00' }, { altitude: 60, azimuth: 0, localTime: '12:00' }, { altitude: 0, azimuth: 270, localTime: '18:00' }] },
  annotations: { outline: [[-46.6333, -23.5505], [-46.6323, -23.5505], [-46.6323, -23.5495]], closed: true, measurement: [[-46.6333, -23.5505], [-46.6323, -23.5505]] },
  weather: { selected: { from: 0, to: 180, speed: 3 } }
}));
