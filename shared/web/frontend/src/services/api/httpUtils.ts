/**
 * Shared HTTP utilities: 404 handling and auth fetch wrapper.
 * Use handle404 when a 404 response should yield a default/skip instead of throwing.
 * Use authFetch when you need fetch with Authorization header (single source for token).
 */

import { getAuthHeader } from '../authSession';

/**
 * If response is 404, call onNotFound and return its value; otherwise return the response.
 * Use when 404 is acceptable and you want a default (e.g. config not created yet).
 */
export function handle404<T>(
	response: Response,
	onNotFound: () => T
): T | Response {
	if (response.status === 404) return onNotFound();
	return response;
}

/**
 * Fetch with Authorization header from auth session. Use instead of raw fetch for protected APIs.
 */
export async function authFetch(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	const headers = new Headers(init?.headers);
	const auth = getAuthHeader();
	if (auth?.Authorization) headers.set('Authorization', auth.Authorization);
	return fetch(input, { ...init, headers });
}
