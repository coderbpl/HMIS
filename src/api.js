/**
 * API client. JWT lives in module memory only (never localStorage — XSS can't
 * steal what isn't persisted). Every call throws { offline: true } on network
 * failure so screens can fall back to demo data.
 */
let jwt = null;
let refreshJwt = null;
let currentUser = null;

async function rawFetch(path, { method, body, auth }) {
  return fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(auth && jwt ? { authorization: `Bearer ${jwt}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  let res;
  try {
    res = await rawFetch(path, { method, body, auth });
    // access token expired? refresh once and retry
    if (res.status === 401 && auth && refreshJwt && path !== '/auth/refresh') {
      const rr = await rawFetch('/auth/refresh', { method: 'POST', body: { refreshToken: refreshJwt }, auth: false });
      if (rr.ok) {
        const pair = await rr.json();
        jwt = pair.accessToken; refreshJwt = pair.refreshToken; currentUser = pair.user;
        res = await rawFetch(path, { method, body, auth });
      }
    }
  } catch {
    throw Object.assign(new Error('API unreachable'), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  get user() { return currentUser; },
  get online() { return jwt !== null; },

  get accessToken() { return jwt; },

  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST', auth: false,
      body: { username, password },
    });
    jwt = data.accessToken || data.token;
    refreshJwt = data.refreshToken || null;
    currentUser = data.user;
    return data.user;
  },

  logout() { jwt = null; refreshJwt = null; currentUser = null; },

  registerPatient: fields => request('/patients', { method: 'POST', body: fields }),
  searchPatients: query => request(`/patients?query=${encodeURIComponent(query)}`),
  getQueue: dept => request(`/queue${dept ? `?dept=${encodeURIComponent(dept)}` : ''}`),
  issueToken: body => request('/queue/tokens', { method: 'POST', body }),
  updateTokenStatus: (id, status) => request(`/queue/tokens/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
  saveVitals: (id, vitals) => request(`/queue/tokens/${encodeURIComponent(id)}/vitals`, { method: 'PATCH', body: vitals }),
  saveConsult: body => request('/consults', { method: 'POST', body }),

  // public (no auth) — used by the patient portal
  publicQueue: dept => request(`/public/queue${dept ? `?dept=${encodeURIComponent(dept)}` : ''}`, { auth: false }),
  departments: () => request('/public/departments', { auth: false }),
  symptoms: () => request('/public/symptoms', { auth: false }),
  slots: (dept, date) => request(`/public/slots?dept=${encodeURIComponent(dept)}&date=${encodeURIComponent(date)}`, { auth: false }),
  trackToken: (mobile, tokenNo) => request('/public/track', { method: 'POST', auth: false, body: { mobile, tokenNo } }),
  selfToken: body => request('/public/self-token', { method: 'POST', auth: false, body }),
  checkIn: (mobile, tokenNo) => request('/public/check-in', { method: 'POST', auth: false, body: { mobile, tokenNo } }),

  // Medicines & Facilities
  getFacilities: () => request('/medicines/facilities'),
  getMedicines: (facility, doctorId) => request(`/medicines?facility=${encodeURIComponent(facility || '')}&doctor=${encodeURIComponent(doctorId || '')}`),
  searchMedicines: (q, facility) => request(`/medicines/search?q=${encodeURIComponent(q || '')}&facility=${encodeURIComponent(facility || '')}`),
  getQuickMeds: () => request('/medicines/quick'),
  saveQuickMeds: medicineIds => request('/medicines/quick', { method: 'PUT', body: { medicineIds } }),

  // Doctor Templates
  getTemplates: () => request('/templates'),
  getTemplate: id => request(`/templates/${encodeURIComponent(id)}`),
  saveTemplate: template => request(template.id ? `/templates/${encodeURIComponent(template.id)}` : '/templates', {
    method: template.id ? 'PUT' : 'POST',
    body: template
  }),
  deleteTemplate: id => request(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Pharmacy
  getPrescriptions: (status, facilityCode) => request(`/pharmacy/prescriptions?status=${encodeURIComponent(status || '')}&facilityCode=${encodeURIComponent(facilityCode || '')}`),
  updatePrescriptionStatus: (id, status) => request(`/pharmacy/prescriptions/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),

  // Admin Reporting
  getAdminFlowStats: facilityCode => request(`/admin/flow-stats?facilityCode=${encodeURIComponent(facilityCode || '')}`),
  getAdminTimeline: (facilityCode, date) => request(`/admin/timeline?facilityCode=${encodeURIComponent(facilityCode || '')}&date=${encodeURIComponent(date || '')}`),

  /** SSE subscription to the public queue board. Returns an unsubscribe fn. */
  subscribeQueue(dept, onBoard, onError) {
    const es = new EventSource(`/api/public/queue/stream${dept ? `?dept=${encodeURIComponent(dept)}` : ''}`);
    es.onmessage = e => { try { onBoard(JSON.parse(e.data)); } catch { /* skip bad frame */ } };
    es.onerror = () => onError?.();
    return () => es.close();
  },
};
