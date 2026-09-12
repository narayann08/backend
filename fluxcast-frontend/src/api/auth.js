import client from './client';

/**
 * Roles available on the startup selection screen.
 * @returns {Promise<Array<{key: string, role: string, label: string}>>}
 */
export async function fetchRoles() {
  const { data } = await client.get('/auth/roles');
  return data.roles;
}

/**
 * One-click login. Takes no credentials — the backend resolves the single
 * stored user for the chosen role.
 * @param {string} roleKey - 'system-admin' | 'lead-grid-operator' | 'utility-admin'
 * @returns {Promise<{id: string, name: string, email: string, role: string}>}
 */
export async function loginAs(roleKey) {
  const { data } = await client.post(`/auth/login/${roleKey}`);
  return data.user;
}
