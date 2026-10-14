import { dayStudy, localParts } from './solar.js';

self.onmessage = event => {
  const { id, data } = event.data;
  try {
    const study = dayStudy(data.date, data.timeZone, data.latitude, data.longitude, data.elevation);
    for (const sample of study.samples) sample.localTime = localParts(sample.instant, data.timeZone).time;
    self.postMessage({ id, study });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
