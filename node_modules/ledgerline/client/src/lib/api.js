const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    // The session is an httpOnly cookie, so every call has to carry it.
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // A 401 on a data route means the session lapsed while the app was open.
    // Tell the auth layer so it can drop the user and route to the login page,
    // rather than leaving a dead screen behind an error message.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('ledgerline:signed-out'));
    }
    const err = new Error(payload?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = payload?.details;
    throw err;
  }
  return payload;
}

const qs = (params) => {
  const search = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return search ? `?${search}` : '';
};

export const api = {
  health: () => request('/health'),

  auth: {
    me: () => request('/auth/me'),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    register: (body) => request('/auth/register', { method: 'POST', body }),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  expenses: {
    list: (params) => request(`/expenses${qs(params)}`),
    get: (id) => request(`/expenses/${id}`),
    create: (body) => request('/expenses', { method: 'POST', body }),
    update: (id, body) => request(`/expenses/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
    duplicate: (id, body) => request(`/expenses/${id}/duplicate`, { method: 'POST', body: body || {} }),
    split: (id, parts) => request(`/expenses/${id}/split`, { method: 'POST', body: { parts } }),
  },

  categories: {
    list: (params) => request(`/categories${qs(params)}`),
    create: (body) => request('/categories', { method: 'POST', body }),
    update: (id, body) => request(`/categories/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },

  budgets: {
    list: (params) => request(`/budgets${qs(params)}`),
    saveAll: (month, items) => request('/budgets', { method: 'PUT', body: { month, items } }),
  },

  reports: {
    overview: (params) => request(`/reports/overview${qs(params)}`),
    trend: (params) => request(`/reports/trend${qs(params)}`),
    daily: (params) => request(`/reports/daily${qs(params)}`),
    mix: (params) => request(`/reports/mix${qs(params)}`),
    movers: (params) => request(`/reports/movers${qs(params)}`),
  },

  settings: {
    get: () => request('/settings'),
    save: (body) => request('/settings', { method: 'PUT', body }),
  },
};
