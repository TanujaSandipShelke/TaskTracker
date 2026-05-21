// API Helper
const API_BASE = '/api';

function getToken() { return localStorage.getItem('ethara_token'); }
function setAuth(token, user) { localStorage.setItem('ethara_token', token); localStorage.setItem('ethara_user', JSON.stringify(user)); }
function getUser() { const u = localStorage.getItem('ethara_user'); return u ? JSON.parse(u) : null; }
function clearAuth() { localStorage.removeItem('ethara_token'); localStorage.removeItem('ethara_user'); }

async function request(endpoint, options = {}) {
  const token = getToken();
  const config = { headers: { 'Content-Type': 'application/json' }, ...options };
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { clearAuth(); window.location.reload(); }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

const api = {
  getToken, setAuth, getUser, clearAuth,
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (name, email, password, role) => request('/auth/signup', { method: 'POST', body: { name, email, password, role } }),
  verifyEmail: (email, code) => request('/auth/verify', { method: 'POST', body: { email, code } }),
  resendCode: (email) => request('/auth/resend-code', { method: 'POST', body: { email } }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),
  getDashboard: () => request('/dashboard'),
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  addMember: (pid, uid, role) => request(`/projects/${pid}/members`, { method: 'POST', body: { user_id: uid, role } }),
  inviteMember: (pid, email, role) => request(`/projects/${pid}/members`, { method: 'POST', body: { email, role } }),
  updateMemberRole: (pid, uid, role) => request(`/projects/${pid}/members/${uid}`, { method: 'PUT', body: { role } }),
  removeMember: (pid, uid) => request(`/projects/${pid}/members/${uid}`, { method: 'DELETE' }),
  getTasks: (q = '') => request(`/tasks${q ? '?' + q : ''}`),
  createTask: (pid, data) => request(`/tasks/project/${pid}`, { method: 'POST', body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};
export default api;
