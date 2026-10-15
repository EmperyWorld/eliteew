/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for strict-origin avatar URL guards (Avatar Lockdown Phase 1).
 *
 * Invariants:
 * - External identity providers (Gravatar, foreign CDN) are rejected.
 * - Internal `/api/*`, blob/data, and same-origin URLs remain trusted.
 *
 * Related:
 * - src/utils/avatarUrlGuard.ts
 */
import { describe, expect, it } from 'vitest';
import {
	isAvatarApiDownloadPath,
	isInternalOrTrustedAvatarUrl,
	isInternalOrTrustedUrl,
	resolveAvatarApiDownloadPath,
	resolveAvatarDirectSrc,
} from '../avatarUrlGuard';

describe('isInternalOrTrustedAvatarUrl', () => {
	it('allows internal API and unified-content paths', () => {
		expect(isInternalOrTrustedAvatarUrl('/api/v1/content/abc/download')).toBe(
			true
		);
		expect(
			isInternalOrTrustedAvatarUrl('/api/v1/profile/avatar/unified-content/x')
		).toBe(true);
	});

	it('allows blob and data URLs', () => {
		expect(isInternalOrTrustedAvatarUrl('blob:http://localhost/abc')).toBe(
			true
		);
		expect(isInternalOrTrustedAvatarUrl('data:image/png;base64,abc')).toBe(
			true
		);
	});

	it('allows same-origin absolute URLs', () => {
		const origin = window.location.origin;
		expect(
			isInternalOrTrustedAvatarUrl(`${origin}/assets/local-avatar.png`)
		).toBe(true);
	});

	it('rejects external http(s) identity leaks', () => {
		expect(
			isInternalOrTrustedAvatarUrl(
				'https://www.gravatar.com/avatar/abc?s=200&d=identicon'
			)
		).toBe(false);
		expect(isInternalOrTrustedAvatarUrl('https://cdn.example.com/a.png')).toBe(
			false
		);
		expect(isInternalOrTrustedAvatarUrl('//gravatar.com/avatar/x')).toBe(false);
	});

	it('exports isInternalOrTrustedUrl alias', () => {
		expect(isInternalOrTrustedUrl('https://evil.example/x')).toBe(false);
		expect(isInternalOrTrustedUrl('/api/v1/profile/avatar')).toBe(true);
	});
});

describe('resolveAvatarApiDownloadPath', () => {
	it('returns API path for protected downloads', () => {
		expect(resolveAvatarApiDownloadPath('/api/v1/content/id/download')).toBe(
			'/api/v1/content/id/download'
		);
	});

	it('returns null for external URLs', () => {
		expect(
			resolveAvatarApiDownloadPath('https://www.gravatar.com/avatar/x')
		).toBeNull();
	});
});

describe('resolveAvatarDirectSrc', () => {
	it('returns null for API paths (blob fetch required)', () => {
		expect(resolveAvatarDirectSrc('/api/v1/content/id/download')).toBeNull();
	});

	it('returns same-origin static path for direct img', () => {
		const origin = window.location.origin;
		expect(resolveAvatarDirectSrc(`${origin}/assets/local-avatar.png`)).toBe(
			`${origin}/assets/local-avatar.png`
		);
	});
});

describe('isAvatarApiDownloadPath', () => {
	it('detects protected download paths', () => {
		expect(isAvatarApiDownloadPath('/api/v1/content/x/download')).toBe(true);
		expect(isAvatarApiDownloadPath('https://evil.com/x')).toBe(false);
	});
});
