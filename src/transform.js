export function parseFloatSafe(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str || str === '-' || str === 'N/A' || str === 'null') return null;

  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function parsePortalTimestamp(tsStr) {
  if (!tsStr || typeof tsStr !== 'string') return null;

  const match = tsStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hours, minutes] = match;
  return `${year}-${month}-${day}T${hours}:${minutes}:00+05:30`;
}

export function transformEnergyReadings(rawReadings, options = {}) {
  if (!Array.isArray(rawReadings)) {
    return { count: 0, total_interval_kwh: 0, readings: [] };
  }

  const { fromDate, toDate } = options;
  const fromIso = fromDate ? new Date(fromDate).toISOString() : null;
  const toIso = toDate ? new Date(toDate).toISOString() : null;

  let totalIntervalKwh = 0;
  let previousKwh = null;
  const processed = [];

  for (let i = 0; i < rawReadings.length; i++) {
    const raw = rawReadings[i] || {};
    const timestamp = parsePortalTimestamp(raw.timestamp);
    const kwh = parseFloatSafe(raw.kwh);
    const kvah = parseFloatSafe(raw.kvah);
    const voltR = parseFloatSafe(raw.voltR);

    let intervalKwh = null;
    if (i > 0 && kwh !== null && previousKwh !== null) {
      const diff = kwh - previousKwh;
      if (diff >= 0) {
        intervalKwh = Math.round(diff * 100) / 100;
        totalIntervalKwh += intervalKwh;
      }
    }

    if (kwh !== null) {
      previousKwh = kwh;
    }

    const item = {
      timestamp,
      kwh,
      kvah,
      volt_r: voltR,
      interval_kwh: intervalKwh,
    };

    if (timestamp) {
      const itemIso = new Date(timestamp).toISOString();
      if (fromIso && itemIso < fromIso) continue;
      if (toIso && itemIso > toIso) continue;
    }

    processed.push(item);
  }

  return {
    count: processed.length,
    total_interval_kwh: Math.round(totalIntervalKwh * 100) / 100,
    readings: processed,
  };
}