/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P18 DOM lock: Suspense load fallback escalates to retry/close after stall.
 *
 * Related:
 * - ../DesktopAppLoadSuspenseFallback.tsx
 * - ../../utils/desktopAppLoadStall.ts
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../../types/desktop.types';
import { DesktopAppLoadSuspenseFallback } from '../DesktopAppLoadSuspenseFallback';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === 'windowChrome.loading') {
				return `Opening ${opts?.appName}…`;
			}
			if (key === 'windowChrome.stillOpening') {
				return `Still opening ${opts?.appName}…`;
			}
			if (key === 'windowChrome.stillOpeningHint') {
				return 'Taking longer — try again or close.';
			}
			if (key === 'windowChrome.retry') return 'Try again';
			if (key === 'windowChrome.closeWindow') return 'Close window';
			return key;
		},
	}),
}));

vi.mock('../../DesktopAppChrome', () => ({
	DesktopAppContentWrapper: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="wrap">{children}</div>
	),
	DesktopAppButton: ({
		children,
		onClick,
		...rest
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		children: React.ReactNode;
	}) => (
		<button type="button" onClick={onClick} {...rest}>
			{children}
		</button>
	),
}));

function seedWindow(): WindowState {
	return {
		id: 'w1',
		title: 'Notes',
		type: 'app',
		position: { x: 0, y: 0 },
		size: { width: 640, height: 480 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 1,
		path: [],
		appComponent: 'NotesApp',
	};
}

describe('DesktopAppLoadSuspenseFallback P18', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows loading then escalates with retry/close', () => {
		const onRetry = vi.fn();
		const onClose = vi.fn();

		render(
			<DesktopAppLoadSuspenseFallback
				win={seedWindow()}
				visualStyle="glass"
				onRetry={onRetry}
				onClose={onClose}
				stallMs={100}
			/>
		);

		const root = screen.getByTestId('desktop-app-load-fallback');
		expect(root).toHaveAttribute('data-stalled', 'false');
		expect(screen.getByText('Opening Notes…')).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(root).toHaveAttribute('data-stalled', 'true');
		expect(screen.getByText('Still opening Notes…')).toBeInTheDocument();
		expect(
			screen.getByText('Taking longer — try again or close.')
		).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('desktop-app-load-stall-retry'));
		expect(onRetry).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId('desktop-app-load-stall-close'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
