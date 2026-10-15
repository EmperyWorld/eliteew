/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Security tests for logger redaction before data reaches console/buffer sinks.
 *
 * Invariants:
 * - Bearer tokens and common secret field names are never preserved in structured log data.
 *
 * Related:
 * - src/utils/logger.ts
 */
import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../logger';

describe('redactSecrets', () => {
	it('redacts nested auth headers and token fields', () => {
		const redacted = redactSecrets({
			headers: {
				Authorization: 'Bearer eyJ.secret.token',
				cookie: 'sid=secret',
			},
			body: {
				access_token: 'access',
				refreshToken: 'refresh',
				nested: { idToken: 'id' },
			},
			ok: 'visible',
		});

		expect(redacted).toEqual({
			headers: {
				Authorization: '[redacted]',
				cookie: '[redacted]',
			},
			body: {
				access_token: '[redacted]',
				refreshToken: '[redacted]',
				nested: { idToken: '[redacted]' },
			},
			ok: 'visible',
		});
	});

	it('redacts bearer token strings even when the key is not secret-like', () => {
		expect(
			redactSecrets({ message: 'Authorization: Bearer abc.def.ghi' })
		).toEqual({ message: '[redacted]' });
	});
});
