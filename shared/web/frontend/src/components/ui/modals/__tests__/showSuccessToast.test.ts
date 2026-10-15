/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: showSuccessToast must not parse message as HTML (XSS sink closed).
 *
 * Invariants:
 * - User message is assigned via textContent, not innerHTML interpolation.
 *
 * Related:
 * - src/components/ui/modals/SuccessModal.tsx
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showSuccessToast } from '../SuccessModal';

describe('showSuccessToast', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('renders malicious message as plain text without executable HTML nodes', () => {
		const payload = '<img src=x onerror="window.__xss=1">';
		showSuccessToast(payload, 60_000);

		const toast = document.querySelector('[id^="success-toast-"]');
		expect(toast).toBeTruthy();
		expect(toast?.querySelector('img[onerror]')).toBeNull();

		const messageSpan = toast?.querySelector('span');
		expect(messageSpan?.textContent).toBe(payload);
		expect(messageSpan?.innerHTML).toBe(
			'&lt;img src=x onerror="window.__xss=1"&gt;'
		);
	});
});
