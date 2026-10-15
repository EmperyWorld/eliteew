/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for desktop modal Tab focus trap hook.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopModalFocusTrap.ts
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import { useDesktopModalFocusTrap } from '../useDesktopModalFocusTrap';

function TrapHarness({ active }: { active: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	useDesktopModalFocusTrap(active, ref);
	return (
		<div ref={ref} data-testid="trap">
			<button type="button">first</button>
			<button type="button">last</button>
		</div>
	);
}

describe('useDesktopModalFocusTrap', () => {
	it('cycles Tab from last to first focusable inside the container', () => {
		render(<TrapHarness active />);
		const buttons = screen.getAllByRole('button');
		const last = buttons[1];
		const first = buttons[0];
		last?.focus();
		expect(document.activeElement).toBe(last);
		if (last) {
			fireEvent.keyDown(last, { key: 'Tab', shiftKey: false });
		}
		expect(document.activeElement).toBe(first);
	});

	it('cycles Shift+Tab from first to last', () => {
		render(<TrapHarness active />);
		const buttons = screen.getAllByRole('button');
		const first = buttons[0];
		const last = buttons[1];
		first?.focus();
		if (first) {
			fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
		}
		expect(document.activeElement).toBe(last);
	});
});
