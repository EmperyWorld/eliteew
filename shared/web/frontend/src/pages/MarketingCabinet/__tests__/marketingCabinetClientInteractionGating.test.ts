import { describe, expect, it } from 'vitest';

import {
	shouldLoadClientInteractionChat,
	shouldLoadClientInteractionDiagnosticSettings,
	shouldLoadClientInteractionDocs,
	shouldLoadClientInteractionEwrp,
	shouldLoadClientInteractionLeadContent,
	shouldLoadClientInteractionShares,
} from '../marketingCabinetClientInteractionGating';

describe('marketingCabinetClientInteractionGating', () => {
	it('loads chat only on chat tab when tab bar is shown', () => {
		expect(shouldLoadClientInteractionChat('full', 'chat', true)).toBe(true);
		expect(shouldLoadClientInteractionChat('full', 'summary', true)).toBe(
			false
		);
		expect(shouldLoadClientInteractionChat('full', 'documents', true)).toBe(
			false
		);
	});

	it('loads chat on legacy full and chat-only layouts without tab bar', () => {
		expect(shouldLoadClientInteractionChat('full', 'summary', false)).toBe(
			true
		);
		expect(shouldLoadClientInteractionChat('chat-only', 'summary', false)).toBe(
			true
		);
		expect(
			shouldLoadClientInteractionChat('documents-only', 'summary', false)
		).toBe(false);
	});

	it('gates lead content and ewrp by tab when tab bar is shown', () => {
		expect(
			shouldLoadClientInteractionLeadContent(
				'full',
				'documents',
				true,
				true,
				false
			)
		).toBe(true);
		expect(
			shouldLoadClientInteractionLeadContent('full', 'chat', true, true, false)
		).toBe(false);
		expect(
			shouldLoadClientInteractionEwrp(
				'full',
				'presentations',
				true,
				true,
				false
			)
		).toBe(true);
		expect(
			shouldLoadClientInteractionEwrp('full', 'summary', true, true, false)
		).toBe(false);
	});

	it('gates docs and shares by tab when tab bar is shown', () => {
		expect(
			shouldLoadClientInteractionDocs('full', 'documents', true, true)
		).toBe(true);
		expect(shouldLoadClientInteractionDocs('full', 'chat', true, true)).toBe(
			false
		);
		expect(
			shouldLoadClientInteractionShares('full', 'presentations', true, true)
		).toBe(true);
		expect(
			shouldLoadClientInteractionShares('full', 'summary', true, true)
		).toBe(false);
	});

	it('gates diagnostic settings to diagnostic tab with tab bar', () => {
		expect(
			shouldLoadClientInteractionDiagnosticSettings(
				'diagnostic',
				true,
				true,
				false
			)
		).toBe(true);
		expect(
			shouldLoadClientInteractionDiagnosticSettings(
				'summary',
				true,
				true,
				false
			)
		).toBe(false);
		expect(
			shouldLoadClientInteractionDiagnosticSettings(
				'summary',
				false,
				true,
				false
			)
		).toBe(true);
	});
});
