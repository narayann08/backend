import axios from 'axios';
import { API_BASE_URL } from './config';

/**
 * Shared axios instance.
 *
 * FluxCast issues no token — login just resolves which predefined user you are
 * (see ASSUMPTIONS.md). The request interceptor therefore attaches the selected
 * role as headers rather than an Authorization bearer; the backend reads
 * `x-user-role` for its one role-gated route and ignores it elsewhere.
 */
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  /*
   * Axios leaves reserved characters like ':' unencoded in query strings, which
   * express-openapi-validator rejects outright ("must be url encoded"). ISO
   * timestamps are full of colons, so the history endpoint would 400 on every
   * call without this. encodeURIComponent escapes them.
   */
  paramsSerializer: {
    serialize: (params) =>
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&'),
  },
});

/**
 * Set lazily by the auth store so this module does not import the store
 * (which would create a cycle: store -> api -> store).
 * @type {() => ({role?: string, id?: string, email?: string}|null)}
 */
let getCurrentUser = () => null;

/** Point the interceptor at the auth store's current user. */
export function registerUserProvider(provider) {
  getCurrentUser = provider;
}

client.interceptors.request.use((config) => {
  const user = getCurrentUser();
  if (user?.role) {
    config.headers['x-user-role'] = user.role;
    if (user.id) config.headers['x-user-id'] = user.id;
    if (user.email) config.headers['x-user-email'] = user.email;
  }
  return config;
});

/**
 * Normalise every failure into an Error carrying `status` and the backend's
 * `{ error, message, detail }` body, so components render one consistent shape.
 */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;

    let message;
    if (typeof body?.message === 'string') {
      message = body.message;
    } else if (error.code === 'ECONNABORTED') {
      message = 'The request timed out. The backend may be busy.';
    } else if (!error.response) {
      message = 'Cannot reach the FluxCast backend. Is it running on ' + API_BASE_URL + '?';
    } else {
      message = `Request failed with status ${status}.`;
    }

    const normalised = new Error(message);
    normalised.status = status;
    normalised.detail = body?.detail;
    normalised.url = error.config?.url;
    return Promise.reject(normalised);
  },
);

export default client;
