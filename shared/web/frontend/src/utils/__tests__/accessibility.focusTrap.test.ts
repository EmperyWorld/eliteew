/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for shared focus trap helpers in `utils/accessibility.ts`.
 *
 * Related:
 * - src/utils/accessibility.ts
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
	clearFocusRestoreStack,
	cycleTabFocusWithinContainer,
	getFocusableElements,
	restoreFocus,
	saveFocus,
	trapFocus,
} from '@/utils/accessibility';

function mountTrapHarness(): {
	root: HTMLDivElement;
	first: HTMLButtonElement;
	last: HTMLButtonElement;
	cleanup: () => void;
} {
	const root = document.createElement('div');
	const first = document.createElement('button');
	first.type = 'button';
	first.textContent = 'first';
	const hidden = document.createElement('button');
	hidden.type = 'button';
	hidden.textContent = 'hidden';
	hidden.setAttribute('aria-hidden', 'true');
	const last = document.createElement('button');
	last.type = 'button';
	last.textContent = 'last';
	root.append(first, hidden, last);
	document.body.appendChild(root);
	const cleanupTrap = trapFocus(root);
	return {
		root,
		first,
		last,
		cleanup: () => {
			cleanupTrap();
			root.remove();
		},
	};
}

describe('accessibility focus helpers', () => {
	afterEach(() => {
		clearFocusRestoreStack();
		document.body.innerHTML = '';
	});

	it('getFocusableElements skips aria-hidden descendants', () => {
		const { root, first, last, cleanup } = mountTrapHarness();
		const nodes = getFocusableElements(root);
		expect(nodes).toEqual([first, last]);
		cleanup();
	});

	it('cycleTabFocusWithinContainer wraps forward from last to first', () => {
		const { root, first, last, cleanup } = mountTrapHarness();
		last.focus();
		const event = new KeyboardEvent('keydown', {
			key: 'Tab',
			bubbles: true,
			cancelable: true,
		});
		const handled = cycleTabFocusWithinContainer(root, event);
		expect(handled).toBe(true);
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(first);
		cleanup();
	});

	it('saveFocus and restoreFocus use a LIFO stack', () => {
		const a = document.createElement('button');
		a.textContent = 'a';
		const b = document.createElement('button');
		b.textContent = 'b';
		document.body.append(a, b);
		a.focus();
		saveFocus();
		b.focus();
		saveFocus();
		restoreFocus();
		expect(document.activeElement).toBe(b);
		restoreFocus();
		expect(document.activeElement).toBe(a);
	});
});
