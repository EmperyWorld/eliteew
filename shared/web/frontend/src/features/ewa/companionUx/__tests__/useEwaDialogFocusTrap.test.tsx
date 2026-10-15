/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for EWA companion dialog focus trap + restore hook.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaDialogFocusTrap.ts
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { clearFocusRestoreStack } from '@/utils/accessibility';
import { useEwaDialogFocusTrap } from '../useEwaDialogFocusTrap';

function DialogHarness() {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEwaDialogFocusTrap(open, ref);
	return (
		<div>
			<button type="button" onClick={() => setOpen(true)}>
				open
			</button>
			{open ? (
				<div ref={ref} role="dialog" aria-modal="true">
					<button type="button">inside</button>
					<button type="button" onClick={() => setOpen(false)}>
						close
					</button>
				</div>
			) : null}
		</div>
	);
}

describe('useEwaDialogFocusTrap', () => {
	it('restores focus to the trigger after dialog closes', async () => {
		clearFocusRestoreStack();
		render(<DialogHarness />);
		const trigger = screen.getByRole('button', { name: 'open' });
		trigger.focus();
		fireEvent.click(trigger);
		const inside = screen.getByRole('button', { name: 'inside' });
		await waitFor(() => {
			expect(document.activeElement).toBe(inside);
		});
		fireEvent.click(screen.getByRole('button', { name: 'close' }));
		await waitFor(() => {
			expect(document.activeElement).toBe(trigger);
		});
	});
});
