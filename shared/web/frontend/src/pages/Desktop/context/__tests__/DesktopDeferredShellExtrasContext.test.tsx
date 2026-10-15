/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prove deferred extras start empty and fill without a missing-provider no-op.
 *
 * Related:
 * - DesktopDeferredShellExtrasContext.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { fireEvent, render, screen } from '@testing-library/react';
import {
	DesktopDeferredShellExtrasProvider,
	useDesktopDeferredShellExtras,
	useSetDesktopDeferredShellExtras,
} from '../DesktopDeferredShellExtrasContext';
import { EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS } from '../../runtime/desktopDeferredShellExtras';

function Probe() {
	const extras = useDesktopDeferredShellExtras();
	const setExtras = useSetDesktopDeferredShellExtras();
	return (
		<>
			<span data-testid="loading">
				{String(extras.recentContentFeedLoading)}
			</span>
			<span data-testid="has-items">
				{String(extras.hasRecentContentFeedItems)}
			</span>
			<button
				type="button"
				onClick={() =>
					setExtras({
						...EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS,
						recentContentFeedLoading: true,
						hasRecentContentFeedItems: true,
					})
				}
			>
				fill
			</button>
		</>
	);
}

describe('DesktopDeferredShellExtrasContext', () => {
	it('starts empty and fills after setter', () => {
		render(
			<DesktopDeferredShellExtrasProvider>
				<Probe />
			</DesktopDeferredShellExtrasProvider>
		);
		expect(screen.getByTestId('loading').textContent).toBe('false');
		expect(screen.getByTestId('has-items').textContent).toBe('false');
		fireEvent.click(screen.getByRole('button', { name: 'fill' }));
		expect(screen.getByTestId('loading').textContent).toBe('true');
		expect(screen.getByTestId('has-items').textContent).toBe('true');
	});
});
