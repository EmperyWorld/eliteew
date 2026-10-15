/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for EBrowser navPolicy evaluator.
 *
 * Related:
 * - features/ebrowser/navPolicy.ts
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 */

import { describe, expect, it } from 'vitest';
import {
	defaultDenyAllPolicy,
	defaultOpenPolicy,
	evaluateNavigation,
	validatePolicyForSave,
} from './navPolicy';

describe('ebrowser navPolicy', () => {
	const now = Date.UTC(2026, 8, 9, 12, 0, 0);

	it('open allows https and denies http', () => {
		const p = defaultOpenPolicy(now);
		expect(evaluateNavigation('https://example.com/x', p, now).allowed).toBe(
			true
		);
		expect(evaluateNavigation('http://example.com/x', p, now).reason).toBe(
			'scheme'
		);
	});

	it('default deny-all blocks https and allows about:blank', () => {
		const p = defaultDenyAllPolicy(now);
		expect(p.mode).toBe('allowlist');
		expect(evaluateNavigation('https://example.com/', p, now).reason).toBe(
			'allowlist_miss'
		);
		expect(evaluateNavigation('about:blank', p, now).allowed).toBe(true);
		expect(validatePolicyForSave('allowlist', [], [])).toBeNull();
	});

	it('empty denylist evaluates fail-closed', () => {
		const p = {
			mode: 'denylist' as const,
			allow: [],
			deny: [],
			fetchedAtMs: now,
		};
		expect(evaluateNavigation('https://example.com/', p, now).reason).toBe(
			'denylist_hit'
		);
	});

	it('allowlist / denylist host matching', () => {
		const allow = {
			mode: 'allowlist' as const,
			allow: ['example.com', '10.0.0.0/8'],
			deny: [],
			fetchedAtMs: now,
		};
		expect(
			evaluateNavigation('https://sub.example.com/', allow, now).allowed
		).toBe(true);
		expect(evaluateNavigation('https://evil.com/', allow, now).reason).toBe(
			'allowlist_miss'
		);
		expect(evaluateNavigation('https://10.1.2.3/', allow, now).allowed).toBe(
			true
		);

		const deny = {
			mode: 'denylist' as const,
			allow: [],
			deny: ['evil.com'],
			fetchedAtMs: now,
		};
		expect(evaluateNavigation('https://sub.evil.com/', deny, now).reason).toBe(
			'denylist_hit'
		);
	});

	it('allowlist matches IPv6 CIDR', () => {
		const allow = {
			mode: 'allowlist' as const,
			allow: ['2001:db8::/32'],
			deny: [],
			fetchedAtMs: now,
		};
		expect(
			evaluateNavigation('https://[2001:db8::1]/', allow, now).allowed
		).toBe(true);
		expect(
			evaluateNavigation('https://[2001:db9::1]/', allow, now).reason
		).toBe('allowlist_miss');
	});

	it('fail-closed when missing or expired', () => {
		expect(evaluateNavigation('https://example.com/', null, now).reason).toBe(
			'missing_policy'
		);
		const stale = defaultOpenPolicy(now - 400_000);
		expect(evaluateNavigation('https://example.com/', stale, now).reason).toBe(
			'expired'
		);
	});

	it('validatePolicyForSave rejects dual-flag lists', () => {
		expect(validatePolicyForSave('open', ['a.com'], [])).toBe(
			'open_mode_lists_forbidden'
		);
		expect(validatePolicyForSave('allowlist', ['a.com'], [])).toBeNull();
		expect(validatePolicyForSave('denylist', [], [])).toBe(
			'denylist_empty_forbidden'
		);
		expect(validatePolicyForSave('denylist', [], ['evil.com'])).toBeNull();
	});
});
