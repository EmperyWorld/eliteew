/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P18 DOM locks for Start + Modal Suspense stall escalate (honest delay copy).
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopModalSuspenseFallback } from '../DesktopModalSuspenseFallback';
import { StartMenuSuspenseFallback } from '../startMenu/StartMenuSuspenseFallback';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === 'workspace.loadingStalled') {
				return 'Loading is taking longer than usual.';
			}
			if (key === 'startMenu.loadingAria') return 'Loading Start menu';
			if (key === 'workspace.openingDesktop') return 'Opening desktop…';
			if (key === 'workspace.modalLoadingAria') return 'Loading dialog…';
			if (key === 'workspace.loading') return 'Loading desktop';
			return key;
		},
	}),
}));

vi.mock('../../utils/desktopVisualSystem', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/desktopVisualSystem')>();
	return {
		...actual,
		getDesktopShellPanelClassName: () => 'panel',
	};
});

vi.mock('../DesktopAppChrome', () => ({
	DesktopAppSkeleton: ({ className }: { className?: string }) => (
		<div data-testid="skel" className={className} />
	),
}));

describe('P18 shell Suspense stall escalate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('StartMenuSuspenseFallback sets data-stalled after threshold', () => {
		render(<StartMenuSuspenseFallback />);
		const el = screen.getByTestId('desktop-start-menu-suspense-fallback');
		expect(el).toHaveAttribute('data-stalled', 'false');
		expect(el.className).toContain('absolute');
		expect(el.className).toContain('sm:top-[2cm]');
		expect(el.className).toContain('sm:left-[2cm]');
		expect(el.className).not.toMatch(/(?:^|\s)fixed(?:\s|$)/);
		act(() => {
			vi.advanceTimersByTime(8_000);
		});
		expect(el).toHaveAttribute('data-stalled', 'true');
		expect(el).toHaveAttribute(
			'aria-label',
			'Loading is taking longer than usual.'
		);
	});

	it('DesktopModalSuspenseFallback sets data-stalled after threshold', () => {
		render(<DesktopModalSuspenseFallback />);
		const el = screen.getByTestId('desktop-modal-suspense-fallback');
		expect(el).toHaveAttribute('data-stalled', 'false');
		act(() => {
			vi.advanceTimersByTime(8_000);
		});
		expect(el).toHaveAttribute('data-stalled', 'true');
		expect(
			screen.getByText('Loading is taking longer than usual.')
		).toBeInTheDocument();
	});
});
