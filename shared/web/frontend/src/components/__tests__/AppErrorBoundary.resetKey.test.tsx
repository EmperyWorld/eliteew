/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: AppErrorBoundary clears fatal UI via resetKey without remounting children.
 *
 * Invariants:
 * - Changing resetKey after an error recovers the tree (providers stay mounted).
 *
 * Related:
 * - `components/AppErrorBoundary.tsx`, `App.tsx`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../AppErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
	if (shouldThrow) {
		throw new Error('boom-for-resetKey');
	}
	return <div>ok-child</div>;
}

describe('AppErrorBoundary resetKey', () => {
	it('clears fatal state when resetKey changes without remounting via key=', () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});

		const { rerender } = render(
			<AppErrorBoundary resetKey="login">
				<Boom shouldThrow />
			</AppErrorBoundary>
		);

		expect(screen.queryByText('ok-child')).not.toBeInTheDocument();

		rerender(
			<AppErrorBoundary resetKey="desktop">
				<Boom shouldThrow={false} />
			</AppErrorBoundary>
		);

		expect(screen.getByText('ok-child')).toBeInTheDocument();
		consoleError.mockRestore();
	});
});
