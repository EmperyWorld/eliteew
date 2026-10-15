import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { useMarketingDialogFocusTrap } from '../useMarketingDialogFocusTrap';

function TrapHarness({ active }: { active: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	useMarketingDialogFocusTrap(ref, active);
	return (
		<div ref={ref} data-testid="trap">
			<button type="button">first</button>
			<button type="button">last</button>
		</div>
	);
}

describe('useMarketingDialogFocusTrap', () => {
	it('cycles Tab from last to first focusable inside the container', () => {
		render(<TrapHarness active />);
		const buttons = screen.getAllByRole('button');
		buttons[1]?.focus();
		expect(document.activeElement).toBe(buttons[1]);
		fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
		expect(document.activeElement).toBe(buttons[0]);
	});

	it('cycles Shift+Tab from first to last', () => {
		render(<TrapHarness active />);
		const buttons = screen.getAllByRole('button');
		buttons[0]?.focus();
		fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(buttons[1]);
	});
});
