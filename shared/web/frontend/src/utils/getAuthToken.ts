/**
 * 💎 Get auth token from auth session facade
 *
 * SIMPLIFIED - uses ONLY auth session token
 * No legacy checks (window globals, localStorage)
 *
 * @returns Current access token or null
 */

import { getToken } from '../services/authSession';

/**
 * Get current authentication token
 *
 * @example
 * const token = getAuthToken();
 * if (token) {
 *   // User is authenticated
 *   axios.get('/api/protected', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 * }
 */
export function getAuthToken(): string | null {
	return getToken() ?? null;
}

// Alternative: Direct re-export
// export { getToken as getAuthToken } from '../services/authSession';
