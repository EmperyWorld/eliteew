/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EBrowser deny-banner copy including native policy_denied + is_default.
 *
 * Related:
 * - features/ebrowser/ebrowserDenyCopy.ts
 */

import { describe, expect, it } from 'vitest';
import {
	ebrowserPolicyDeniedMessage,
	ebrowserPrecheckDeniedMessage,
} from './ebrowserDenyCopy';

describe('ebrowserDenyCopy', () => {
	it('uses default-deny honesty for policy_denied when is_default', () => {
		expect(ebrowserPolicyDeniedMessage(true, 'policy_denied')).toMatch(
			/ещё нет политики/
		);
		expect(ebrowserPolicyDeniedMessage(false, 'policy_denied')).toMatch(
			/заблокирован политикой/
		);
	});

	it('maps auth/fetch codes honestly', () => {
		expect(ebrowserPolicyDeniedMessage(true, 'policy_fetch_failed')).toMatch(
			/подтвердить политику/
		);
	});

	it('precheck uses default-deny for allowlist miss under synthetic default', () => {
		expect(ebrowserPrecheckDeniedMessage('allowlist_miss', true)).toMatch(
			/ещё нет политики/
		);
		expect(ebrowserPrecheckDeniedMessage('missing_policy', false)).toMatch(
			/недоступна или устарела/
		);
	});
});
