import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/config', () => ({
	default: {
		t: (key: string) => key,
	},
}));

vi.mock('../../utils/desktopShellStateWriteCoordinator', () => ({
	resetCoalescedDesktopShellStateWriter: vi.fn(),
	subscribeCoalescedShellStatePatchErrors: () => () => {},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				'syncStatus.staleShellConflict': 'Updated elsewhere',
				'syncStatus.refreshState': 'Refresh',
				'syncStatus.retry': 'Retry',
				'syncStatus.offline': 'Offline — retry when ready',
				'syncStatus.ariaOffline':
					'No internet connection. Retry when the network is back.',
				'syncStatus.syncing': 'Syncing…',
				'syncStatus.shellDebouncing': 'Pending save…',
				'syncStatus.shellFlushing': 'Saving…',
				'syncStatus.ariaStaleShellConflict':
					'Your desktop was updated in another tab or session. Refresh, then try again.',
				'syncStatus.ariaSyncing': 'Syncing…',
			})[key] ?? key,
	}),
}));

import {
	resetStaleShellAutoRecoverUiForTests,
	setStaleShellAutoRecoverPhaseForTests,
} from '../../hooks/useDesktopStaleShellStateAutoRecover';
import { DesktopSyncStatus } from '../DesktopSyncStatus';

describe('DesktopSyncStatus', () => {
	beforeEach(() => {
		resetStaleShellAutoRecoverUiForTests();
	});

	afterEach(() => {
		resetStaleShellAutoRecoverUiForTests();
	});

	it('applies reduced-motion guard to syncing spinner', () => {
		const { container } = render(
			<DesktopSyncStatus isOnline isSyncing error={null} hideWhenIdle={false} />
		);
		expect(container.innerHTML).toContain('motion-reduce:animate-none');
		expect(container.innerHTML).toContain('animate-spin');
	});

	it('surfaces stale shell-state conflict with refresh action', () => {
		const onRecoverStaleShellState = vi.fn();
		render(
			<DesktopSyncStatus
				isOnline
				isSyncing={false}
				error="Desktop shell state changed in another session"
				staleShellStateConflict
				onRecoverStaleShellState={onRecoverStaleShellState}
			/>
		);

		expect(screen.getByText('Updated elsewhere')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
		expect(onRecoverStaleShellState).toHaveBeenCalledTimes(1);
	});

	it('shows retry action after auto-recover failed phase', () => {
		const onRecoverStaleShellState = vi.fn();
		setStaleShellAutoRecoverPhaseForTests('failed', 'persist:');

		render(
			<DesktopSyncStatus
				isOnline
				isSyncing={false}
				error={null}
				staleShellStateConflict
				onRecoverStaleShellState={onRecoverStaleShellState}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(onRecoverStaleShellState).toHaveBeenCalledTimes(1);
	});

	it('hides manual action while auto-recover is attempting', () => {
		setStaleShellAutoRecoverPhaseForTests('attempting');

		render(
			<DesktopSyncStatus
				isOnline
				isSyncing={false}
				error={null}
				staleShellStateConflict
				onRecoverStaleShellState={vi.fn()}
			/>
		);

		expect(screen.getByText('Syncing…')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it('shows debouncing pipeline phase with distinct copy', () => {
		render(
			<DesktopSyncStatus
				isOnline
				isSyncing={false}
				error={null}
				shellStatePipelinePhase="debouncing"
				hideWhenIdle={false}
			/>
		);

		expect(screen.getByText('Pending save…')).toBeTruthy();
	});

	it('shows flushing pipeline phase as saving copy', () => {
		render(
			<DesktopSyncStatus
				isOnline
				isSyncing={false}
				error={null}
				shellStatePipelinePhase="flushing"
				hideWhenIdle={false}
			/>
		);

		expect(screen.getByText('Saving…')).toBeTruthy();
	});

	it('exposes offline retry when onRetry is provided', () => {
		const onRetry = vi.fn();
		render(
			<DesktopSyncStatus
				isOnline={false}
				isSyncing={false}
				error={null}
				onRetry={onRetry}
				hideWhenIdle={false}
			/>
		);

		expect(screen.getByText('Offline — retry when ready')).toBeTruthy();
		fireEvent.click(screen.getByTestId('desktop-sync-offline-retry'));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
