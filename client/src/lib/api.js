const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

let csrfToken = "";

export function setCsrfToken(token) {
  csrfToken = String(token || "");
}

function shouldAttachCsrf(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "GET").toUpperCase());
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (shouldAttachCsrf(method) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    credentials: "include",
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (payload?.csrfToken) {
    setCsrfToken(payload.csrfToken);
  }

  if (!response.ok) {
    throw new Error(payload.error || "Falha na comunicacao com o servidor");
  }

  return payload;
}

export const api = {
  getSounds: () => request("/sounds"),
  getCinematicPresets: () => request("/presets/cinematic"),
  getCategories: () => request("/presets/categories"),
  getOverview: () => request("/overview"),

  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),
  getCsrf: () => request("/auth/csrf"),
  logout: () => request("/auth/logout", { method: "POST" }),

  forgotPassword: (payload) =>
    request("/auth/password/forgot", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) =>
    request("/auth/password/reset", { method: "POST", body: JSON.stringify(payload) }),

  setupMfa: () => request("/auth/mfa/setup", { method: "POST" }),
  enableMfa: (payload) => request("/auth/mfa/enable", { method: "POST", body: JSON.stringify(payload) }),
  disableMfa: (payload) => request("/auth/mfa/disable", { method: "POST", body: JSON.stringify(payload) }),

  getMixes: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return request(`/mixes${search ? `?${search}` : ""}`);
  },
  createMix: (payload) => request("/mixes", { method: "POST", body: JSON.stringify(payload) }),
  updateMix: (id, payload) => request(`/mixes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMix: (id) => request(`/mixes/${id}`, { method: "DELETE" }),
  toggleFavoriteMix: (id) => request(`/mixes/${id}/favorite`, { method: "POST" }),
  duplicateMix: (id) => request(`/mixes/${id}/duplicate`, { method: "POST" }),
  markMixPlayed: (id) => request(`/mixes/${id}/play`, { method: "POST" }),
  getHistory: () => request("/mixes/history/list"),

  createShareLink: (id, payload) => request(`/mixes/${id}/share`, { method: "POST", body: JSON.stringify(payload) }),
  revokeShareLink: (id) => request(`/mixes/${id}/share/revoke`, { method: "POST" }),
  getSharedMix: (shareId) => request(`/mixes/shared/${shareId}`),
  cloneSharedMix: (shareId) => request(`/mixes/shared/${shareId}/clone`, { method: "POST" })
};
