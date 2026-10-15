/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop shell keyboard deferral helper.
 *
 * Related:
 * - utils/desktopShellKeyboardCapture.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import { shouldDeferDesktopShellKeydownToFocusedSurface } from '@/pages/Desktop/utils/desktopShellKeyboardCapture';

describe('shouldDeferDesktopShellKeydownToFocusedSurface', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		document.body.focus();
	});

	it('defers when focus is in a text input', () => {
		const input = document.createElement('input');
		input.type = 'text';
		document.body.appendChild(input);
		input.focus();

		expect(shouldDeferDesktopShellKeydownToFocusedSurface()).toBe(true);
	});

	it('defers inside command palette shell keyboard surface', () => {
		const surface = document.createElement('div');
		surface.setAttribute('data-desktop-shell-keyboard-surface', '');
		const input = document.createElement('input');
		input.type = 'text';
		surface.appendChild(input);
		document.body.appendChild(surface);
		input.focus();

		expect(shouldDeferDesktopShellKeydownToFocusedSurface()).toBe(true);
	});

	it('does not defer when focus is on document body', () => {
		document.body.focus();
		expect(shouldDeferDesktopShellKeydownToFocusedSurface()).toBe(false);
	});
});
