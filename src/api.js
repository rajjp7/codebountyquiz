export async function api(path, { token, body, signal, method } = {}) {
  const response = await fetch(path, {
    method: method || (body === undefined ? 'GET' : 'POST'), signal,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Please retry.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed. Please retry.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
export function readStored(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function removeStored(key) { try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ } }
