/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral locks for useShellPortal — Shell body portal, Escape top, forbidden policy.
 *
 * Related:
 * - ../shellPortal.tsx
 * - ../portalStackController.ts
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearFocusRestoreStack } from '@/utils/accessibility';

import '../appRegistry.catalog';
import { __resetShellPortalStackForTests } from '../portalStackController';
import { useShellPortal } from '../shellPortal';

vi.mock('../../utils/desktopUi', () => ({
	getDesktopPortalShellProps: () => ({
		style: { transform: 'none' },
		theme: 'dark' as const,
	}),
}));

vi.mock('../../runtime/desktopLowGpuMode', () => ({
	isDesktopLowGpuModeEnabled: () => false,
}));

function ModalHarness({ onDismiss }: { onDismiss?: () => void }) {
	const [open, setOpen] = useState(true);
	const { Portal, isTop } = useShellPortal({
		layer: 'embedded_modal',
		trapFocus: true,
		onDismiss: () => {
			onDismiss?.();
			setOpen(false);
		},
	});
	if (!open) return <div data-testid="portal-closed" />;
	return (
		<Portal>
			<button type="button" data-testid="portal-action">
				Action {isTop ? 'top' : 'buried'}
			</button>
		</Portal>
	);
}

function StackedHarness() {
	const lower = useShellPortal({
		layer: 'embedded_popover',
		dismissOnEscape: true,
		trapFocus: false,
	});
	const [upperOpen, setUpperOpen] = useState(true);
	const upper = useShellPortal({
		layer: 'embedded_modal',
		trapFocus: true,
		onDismiss: () => setUpperOpen(false),
	});
	return (
		<>
			<lower.Portal>
				<button type="button" data-testid="lower-action">
					Lower
				</button>
			</lower.Portal>
			{upperOpen ? (
				<upper.Portal>
					<button type="button" data-testid="upper-action">
						Upper
					</button>
				</upper.Portal>
			) : null}
		</>
	);
}

describe('useShellPortal', () => {
	beforeEach(() => {
		__resetShellPortalStackForTests();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		cleanup();
		__resetShellPortalStackForTests();
	});

	it('renders content through Shell floating portal with stack attrs', () => {
		render(<ModalHarness />);
		const surface = screen.getByTestId('shell-portal-surface');
		expect(surface).toHaveAttribute(
			'data-shell-portal-layer',
			'embedded_modal'
		);
		expect(surface).toHaveAttribute('data-shell-portal-top', 'true');
		expect(surface).toHaveAttribute('data-shell-portal-id');
		expect(Number.parseInt(String(surface.style.zIndex), 10)).toBeGreaterThan(
			0
		);
		expect(screen.getByTestId('desktop-shell-floating-portal')).toBeTruthy();
		expect(screen.getByTestId('portal-action')).toHaveTextContent('top');
	});

	it('Escape dismisses top portal and unmounts via onDismiss', () => {
		const onDismiss = vi.fn();
		render(<ModalHarness onDismiss={onDismiss} />);
		expect(screen.getByTestId('shell-portal-surface')).toBeTruthy();

		act(() => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('portal-closed')).toBeTruthy();
		expect(screen.queryByTestId('shell-portal-surface')).toBeNull();
	});

	it('Escape closes only the top portal in a stack', () => {
		render(<StackedHarness />);
		expect(screen.getByTestId('upper-action')).toBeTruthy();
		expect(screen.getByTestId('lower-action')).toBeTruthy();

		act(() => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(screen.queryByTestId('upper-action')).toBeNull();
		expect(screen.getByTestId('lower-action')).toBeTruthy();
		expect(screen.getByTestId('shell-portal-surface')).toHaveAttribute(
			'data-shell-portal-layer',
			'embedded_popover'
		);
	});

	it('throws when appComponent portal.policy is forbidden', () => {
		function Forbidden() {
			const { Portal } = useShellPortal({
				layer: 'embedded_popover',
				appComponent: 'VideoCallApp',
			});
			return (
				<Portal>
					<span>x</span>
				</Portal>
			);
		}

		expect(() => render(<Forbidden />)).toThrow(/portal\.policy=forbidden/);
	});

	it('L5: portal open traps focus then restore prior focus on close', async () => {
		clearFocusRestoreStack();
		const prior = document.createElement('button');
		prior.type = 'button';
		prior.textContent = 'prior';
		document.body.appendChild(prior);
		prior.focus();
		expect(document.activeElement).toBe(prior);

		function FocusHarness() {
			const [open, setOpen] = useState(true);
			const { Portal } = useShellPortal({
				layer: 'embedded_modal',
				trapFocus: true,
				onDismiss: () => setOpen(false),
			});
			if (!open) return <div data-testid="portal-closed" />;
			return (
				<Portal>
					<button type="button" data-testid="portal-action">
						Action
					</button>
					<button type="button" onClick={() => setOpen(false)}>
						Close
					</button>
				</Portal>
			);
		}

		render(<FocusHarness />);
		await act(async () => {
			await Promise.resolve();
			await new Promise((r) => requestAnimationFrame(() => r(undefined)));
		});
		const action = screen.getByTestId('portal-action');
		expect(
			action === document.activeElement ||
				screen
					.getByTestId('shell-portal-surface')
					.contains(document.activeElement)
		).toBe(true);

		await act(async () => {
			screen.getByRole('button', { name: 'Close' }).click();
		});
		expect(screen.getByTestId('portal-closed')).toBeTruthy();
		expect(document.activeElement).toBe(prior);
		prior.remove();
		clearFocusRestoreStack();
	});
});
