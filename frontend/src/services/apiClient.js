const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

function getToken() {
  return localStorage.getItem('siatc_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(method, endpoint, { body, headers = {}, signal } = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401) {
    localStorage.removeItem('siatc_token');
    localStorage.removeItem('siatc_user');
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined;
  return res.json();
}

export const apiClient = {
  get:    (endpoint, opts)        => request('GET',    endpoint, opts),
  post:   (endpoint, body, opts)  => request('POST',   endpoint, { body, ...opts }),
  put:    (endpoint, body, opts)  => request('PUT',    endpoint, { body, ...opts }),
  delete: (endpoint, opts)        => request('DELETE',  endpoint, opts),
  patch:  (endpoint, body, opts)  => request('PATCH',  endpoint, { body, ...opts }),

  // Devuelve el Response crudo (sin parsear) — necesario para SSE streaming
  stream: (endpoint, body, signal) =>
    fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    }),
};

export { API_BASE_URL };
