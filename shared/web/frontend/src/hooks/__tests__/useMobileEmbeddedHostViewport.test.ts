import { describe, expect, it } from 'vitest';

import { resolveMobileEmbeddedWidthTier } from '@/hooks/useMobileEmbeddedHostViewport';

describe('resolveMobileEmbeddedWidthTier', () => {
	it('classifies narrow phone widths', () => {
		expect(resolveMobileEmbeddedWidthTier(360)).toBe('narrow');
		expect(resolveMobileEmbeddedWidthTier(399)).toBe('narrow');
	});

	it('classifies standard tablet-ish widths', () => {
		expect(resolveMobileEmbeddedWidthTier(400)).toBe('standard');
		expect(resolveMobileEmbeddedWidthTier(719)).toBe('standard');
	});

	it('classifies wide layouts', () => {
		expect(resolveMobileEmbeddedWidthTier(720)).toBe('wide');
		expect(resolveMobileEmbeddedWidthTier(1200)).toBe('wide');
	});
});
