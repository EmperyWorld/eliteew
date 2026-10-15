/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyboard and focus behavior for shared taskbar icon context menus.
 *
 * Related:
 * - src/pages/Desktop/components/TaskbarIconContextMenu.tsx
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskbarIconContextMenu } from '../TaskbarIconContextMenu';

vi.mock('@/pages/Desktop/context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 1500,
}));

vi.mock('../DesktopShellFloatingPortal', () => ({
	DesktopShellFloatingPortal: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

describe('TaskbarIconContextMenu', () => {
	it('closes on Escape with preventDefault (capture)', () => {
		const onClose = vi.fn();
		render(
			<TaskbarIconContextMenu point={{ x: 12, y: 12 }} onClose={onClose}>
				<button type="button" role="menuitem">
					Open shortcuts
				</button>
			</TaskbarIconContextMenu>
		);

		let prevented = false;
		const event = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true,
		});
		event.preventDefault = () => {
			prevented = true;
		};
		window.dispatchEvent(event);

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(prevented).toBe(true);
	});

	it('focuses the first menuitem when opened', async () => {
		render(
			<TaskbarIconContextMenu point={{ x: 12, y: 12 }} onClose={vi.fn()}>
				<button type="button" role="menuitem">
					First
				</button>
				<button type="button" role="menuitem">
					Second
				</button>
			</TaskbarIconContextMenu>
		);

		await act(async () => {
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => resolve());
			});
		});

		expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
	});
});
