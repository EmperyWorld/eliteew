/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: GAF E2EE crypto localStorage keys are purged on logout teardown.
 *
 * Invariants:
 * - clearIdentityAndSessionKeys removes identity, fingerprint, and session-key prefix rows.
 *
 * Related:
 * - src/contexts/AuthContext.tsx
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';
import { clearIdentityAndSessionKeys } from '../GAFChatCrypto';

describe('GAFChatCrypto logout purge', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('clearIdentityAndSessionKeys removes all GAF E2EE localStorage material', () => {
		const storage = createMemoryStorage();
		vi.stubGlobal('localStorage', storage);

		storage.setItem(
			'gaf_chat_e2e_identity_private_jwk',
			JSON.stringify({ kty: 'RSA', d: 'secret' })
		);
		storage.setItem(
			'gaf_chat_e2e_identity_public_pem',
			'-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----'
		);
		storage.setItem('gaf_chat_e2e_uploaded_public_fingerprint', 'fp-abc');
		storage.setItem('gaf_chat_e2e_session_key_chat-1', 'session-material');
		storage.setItem('gaf_chat_e2e_session_key_chat-2', 'session-material-2');
		storage.setItem('elite_desktop_config', '{"theme":"dark"}');

		clearIdentityAndSessionKeys();

		expect(storage.getItem('gaf_chat_e2e_identity_private_jwk')).toBeNull();
		expect(storage.getItem('gaf_chat_e2e_identity_public_pem')).toBeNull();
		expect(
			storage.getItem('gaf_chat_e2e_uploaded_public_fingerprint')
		).toBeNull();
		expect(storage.getItem('gaf_chat_e2e_session_key_chat-1')).toBeNull();
		expect(storage.getItem('gaf_chat_e2e_session_key_chat-2')).toBeNull();
		expect(storage.getItem('elite_desktop_config')).toBe('{"theme":"dark"}');
	});
});
