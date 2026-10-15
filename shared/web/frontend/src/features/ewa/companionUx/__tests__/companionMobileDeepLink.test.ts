/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for mobile companion operation deep link hash parsing (U5.12).
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
	consumeCompanionMobileDeepLinkIntent,
	consumeCompanionMobileOperationRunIdFromHash,
	consumeCompanionMobileToolsOpenFromHash,
	resolveCompanionMobileOperationRunIdFromHash,
	resolveCompanionMobilePhrasesOpenFromHash,
	resolveCompanionMobileToolsOpenFromHash,
	resolveCompanionMobileWorkflowsOpenFromHash,
} from '@/features/ewa/companionUx/companionMobileDeepLink';

const originalHash = window.location.hash;

afterEach(() => {
	window.location.hash = originalHash;
});

describe('resolveCompanionMobileOperationRunIdFromHash', () => {
	it('reads operation query key', () => {
		window.location.hash = '#/mobile-ewa-companion?operation=run-abc';
		expect(resolveCompanionMobileOperationRunIdFromHash()).toBe('run-abc');
	});

	it('falls back to run query key', () => {
		window.location.hash = '#/mobile-ewa-companion?run=run-xyz';
		expect(resolveCompanionMobileOperationRunIdFromHash()).toBe('run-xyz');
	});

	it('returns null without query', () => {
		window.location.hash = '#/mobile-ewa-companion';
		expect(resolveCompanionMobileOperationRunIdFromHash()).toBeNull();
	});
});

describe('consumeCompanionMobileOperationRunIdFromHash', () => {
	it('strips consumed query keys from hash', () => {
		window.location.hash = '#/mobile-ewa-companion?operation=run-1&foo=bar';
		expect(consumeCompanionMobileOperationRunIdFromHash()).toBe('run-1');
		expect(window.location.hash).toBe('#/mobile-ewa-companion?foo=bar');
	});
});

describe('resolveCompanionMobileToolsOpenFromHash', () => {
	it('reads tools=1', () => {
		window.location.hash = '#/mobile-ewa-companion?tools=1';
		expect(resolveCompanionMobileToolsOpenFromHash()).toBe(true);
	});

	it('reads open=tools', () => {
		window.location.hash = '#/mobile-ewa-companion?open=tools';
		expect(resolveCompanionMobileToolsOpenFromHash()).toBe(true);
	});
});

describe('consumeCompanionMobileToolsOpenFromHash', () => {
	it('strips consumed query keys from hash', () => {
		window.location.hash = '#/mobile-ewa-companion?tools=1&foo=bar';
		expect(consumeCompanionMobileToolsOpenFromHash()).toBe(true);
		expect(window.location.hash).toBe('#/mobile-ewa-companion?foo=bar');
	});
});

describe('resolveCompanionMobilePhrasesOpenFromHash', () => {
	it('reads phrases=1', () => {
		window.location.hash = '#/mobile-ewa-companion?phrases=1';
		expect(resolveCompanionMobilePhrasesOpenFromHash()).toBe(true);
	});

	it('reads open=phrases', () => {
		window.location.hash = '#/mobile-ewa-companion?open=phrases';
		expect(resolveCompanionMobilePhrasesOpenFromHash()).toBe(true);
	});
});

describe('resolveCompanionMobileWorkflowsOpenFromHash', () => {
	it('reads workflows=1', () => {
		window.location.hash = '#/mobile-ewa-companion?workflows=1';
		expect(resolveCompanionMobileWorkflowsOpenFromHash()).toBe(true);
	});
});

describe('consumeCompanionMobileDeepLinkIntent', () => {
	it('prioritizes operation over surface open', () => {
		window.location.hash = '#/mobile-ewa-companion?operation=run-9&tools=1';
		expect(consumeCompanionMobileDeepLinkIntent()).toEqual({
			kind: 'operation',
			runId: 'run-9',
		});
		expect(window.location.hash).toBe('#/mobile-ewa-companion?tools=1');
	});

	it('returns workflows intent', () => {
		window.location.hash = '#/mobile-ewa-companion?open=workflows';
		expect(consumeCompanionMobileDeepLinkIntent()).toEqual({
			kind: 'workflows',
		});
		expect(window.location.hash).toBe('#/mobile-ewa-companion');
	});
});
