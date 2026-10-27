export function parseNameAndCode(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') {
    return { name: rawStr || null, code: null };
  }
  const match = rawStr.trim().match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match) {
    return {
      name: match[1].trim(),
      code: match[2].trim(),
    };
  }
  return {
    name: rawStr.trim(),
    code: null,
  };
}

export class MeterNotFoundError extends Error {
  constructor(message = 'Meter not found') {
    super(message);
    this.name = 'MeterNotFoundError';
    this.status = 404;
  }
}

export function decodeSvelteKitData(payload) {
  if (!payload || !Array.isArray(payload.nodes)) {
    throw new Error('Invalid SvelteKit payload: missing nodes array');
  }

  const nodes = payload.nodes;
  let targetNode = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i] && nodes[i].type !== 'skip') {
      targetNode = nodes[i];
      break;
    }
  }

  if (!targetNode) {
    throw new Error('No valid data node found in SvelteKit payload');
  }

  if (targetNode.type === 'error' || targetNode.status === 404) {
    const errorMsg = targetNode.error?.message || 'Meter not found';
    throw new MeterNotFoundError(errorMsg);
  }

  const pool = targetNode.data;
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new Error('Data node is missing the expected data array');
  }


  const seen = new Map();

  function resolve(val) {
    if (typeof val === 'number') {
      if (val === -1) return undefined;
      if (val >= 0 && val < pool.length) {
        if (seen.has(val)) return seen.get(val);
        const resolved = resolve(pool[val]);
        seen.set(val, resolved);
        return resolved;
      }
      return val;
    }

    if (Array.isArray(val)) {
      const arr = [];
      for (const item of val) {
        arr.push(resolve(item));
      }
      return arr;
    }

    if (val !== null && typeof val === 'object') {
      const obj = {};
      for (const [k, v] of Object.entries(val)) {
        obj[k] = resolve(v);
      }
      return obj;
    }

    return val;
  }

  const decodedRoot = resolve(pool[0]);
  return decodedRoot;
}


export function extractMeterDetail(decodedRoot) {
  const meterId = decodedRoot.meterId;
  const detailList = decodedRoot.detail?.data || [];
  const rawHierarchy = decodedRoot.hierarchy || {};

  
  const details = {};
  for (const item of detailList) {
    if (item && item.parameterName) {
      details[item.parameterName] = item.parameterValue;
    }
  }

  return {
    meter_id: meterId,
    serial_no: details['Serial No'] || null,
    make: details['Make'] || null,
    phase_type: details['Phase Type'] || null,
    install_status: details['Installation Status'] || null,
    install_type: details['Installation Type'] || null,
    hierarchy: {
      zone: parseNameAndCode(rawHierarchy['Zone']),
      circle: parseNameAndCode(rawHierarchy['Circle']),
      division: parseNameAndCode(rawHierarchy['Division']),
      subdivision: parseNameAndCode(rawHierarchy['Subdivision']),
      substation: parseNameAndCode(rawHierarchy['Sub Station']),
      feeder: parseNameAndCode(rawHierarchy['Feeder']),
      dt: parseNameAndCode(rawHierarchy['DT']),
    },
  };
}