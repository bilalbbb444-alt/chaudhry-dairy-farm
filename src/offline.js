// Lightweight offline layer: caches the last-synced farm snapshot in
// localStorage so the app can open with real data when there's no
// internet, and queues writes made while offline so they replay
// automatically once the connection comes back.

const snapshotKey = (farmId) => `cdf-snapshot-${farmId}`;
const queueKey = (farmId) => `cdf-queue-${farmId}`;

export function saveSnapshot(farmId, data) {
  try {
    localStorage.setItem(snapshotKey(farmId), JSON.stringify({ data, savedAt: Date.now() }));
  } catch (e) {
    // storage full or unavailable — offline cache just won't be available, not fatal
  }
}

export function loadSnapshot(farmId) {
  try {
    const raw = localStorage.getItem(snapshotKey(farmId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function getQueue(farmId) {
  try {
    const raw = localStorage.getItem(queueKey(farmId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveQueue(farmId, queue) {
  try {
    localStorage.setItem(queueKey(farmId), JSON.stringify(queue));
  } catch (e) {}
}

export function pushToQueue(farmId, op) {
  const q = getQueue(farmId);
  q.push({ ...op, queuedAt: Date.now() });
  saveQueue(farmId, q);
  return q;
}

export function clearQueue(farmId) {
  saveQueue(farmId, []);
}

export function localTempId() {
  return "local_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function isTempId(id) {
  return typeof id === "string" && id.startsWith("local_");
}

// Fields on our records that reference another record's id — these need
// remapping if they point at a temp id that gets a real id once synced.
export const REFERENCE_FIELDS = ["animalId", "customerId", "employeeId"];

export function remapReferences(payload, idMap) {
  const out = { ...payload };
  for (const f of REFERENCE_FIELDS) {
    if (out[f] && idMap[out[f]]) out[f] = idMap[out[f]];
  }
  return out;
}
