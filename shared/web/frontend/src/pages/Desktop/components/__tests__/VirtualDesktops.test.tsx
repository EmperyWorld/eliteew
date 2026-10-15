/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for VirtualDesktops strip (switch, rename, delete guard).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualDesktops } from '../VirtualDesktops';
import type { VirtualDesktop } from '../../hooks/useVirtualDesktops';

vi.mock('@/notifications', () => ({
	notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === 'virtualDesktops.desktopAria')
				return `Desktop ${opts?.index}`;
			if (key === 'virtualDesktops.desktopTitle')
				return `Desktop ${opts?.index}`;
			if (key === 'virtualDesktops.deleteTitle') return 'Remove desktop';
			if (key === 'virtualDesktops.deleteLastBlocked')
				return 'Cannot remove last desktop';
			if (key === 'virtualDesktops.inlineRenameAria') return 'Rename desktop';
			if (key === 'virtualDesktops.ctxMenuAria') return 'Desktop menu';
			if (key === 'virtualDesktops.ctxRename') return 'Rename';
			if (key === 'virtualDesktops.ctxDelete') return 'Delete';
			if (key === 'virtualDesktops.ctxNewDesktop') return 'New desktop';
			if (key === 'virtualDesktops.addTitle') return 'New desktop';
			if (key === 'virtualDesktops.addAria') return 'Create desktop';
			if (key === 'virtualDesktops.stripTitle') return 'Virtual desktops';
			if (key === 'virtualDesktops.scenarioProfilesBadge')
				return String(opts?.count);
			return key;
		},
	}),
}));

vi.mock('../context/DesktopShellMotionPrefsContext', () => ({
	useDesktopShellMotionPrefs: () => ({
		reduceMotion: true,
		speed: 'normal',
		speedScale: 1,
	}),
}));

vi.mock('../../context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 1000,
}));

vi.mock('../../hooks/useFinePointerHover', () => ({
	useFinePointerHover: () => false,
}));

vi.mock('../VirtualDesktopDeleteConfirm', () => ({
	VirtualDesktopDeleteConfirm: ({
		open,
		onConfirm,
		onClose,
	}: {
		open: boolean;
		onConfirm: () => void;
		onClose: () => void;
	}) =>
		open ? (
			<div role="alertdialog">
				<button
					type="button"
					data-testid="virtual-desktop-delete-confirm"
					onClick={onConfirm}
				>
					Confirm remove
				</button>
				<button type="button" onClick={onClose}>
					Cancel
				</button>
			</div>
		) : null,
}));

function buildDesktops(count: number, active = 0): VirtualDesktop[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `vd-${i + 1}`,
		name: `Desk ${i + 1}`,
		isActive: i === active,
		wallpaper: '',
		windows: [],
	}));
}

describe('VirtualDesktops', () => {
	it('switches desktop on pill click', () => {
		const switchToDesktop = vi.fn();
		render(
			<VirtualDesktops
				desktops={buildDesktops(2, 0)}
				activeDesktopId="vd-1"
				activeDesktopIndex={0}
				createDesktop={vi.fn()}
				deleteDesktop={vi.fn()}
				switchToDesktop={switchToDesktop}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'Desktop 2' }));
		expect(switchToDesktop).toHaveBeenCalledWith('vd-2');
	});

	it('blocks deleting the last desktop', async () => {
		const deleteDesktop = vi.fn();
		render(
			<VirtualDesktops
				desktops={buildDesktops(1)}
				activeDesktopId="vd-1"
				activeDesktopIndex={0}
				createDesktop={vi.fn()}
				deleteDesktop={deleteDesktop}
				switchToDesktop={vi.fn()}
			/>
		);
		const addBtn = screen.getByRole('button', { name: 'Create desktop' });
		expect(addBtn).toBeInTheDocument();
		expect(screen.queryByLabelText('Remove desktop')).not.toBeInTheDocument();
	});

	it('requires confirm before deleting a non-active desktop', () => {
		const deleteDesktop = vi.fn();
		render(
			<VirtualDesktops
				desktops={buildDesktops(2, 0)}
				activeDesktopId="vd-1"
				activeDesktopIndex={0}
				createDesktop={vi.fn()}
				deleteDesktop={deleteDesktop}
				switchToDesktop={vi.fn()}
			/>
		);
		fireEvent.contextMenu(screen.getByRole('button', { name: 'Desktop 2' }));
		fireEvent.click(screen.getByText('Delete'));
		expect(deleteDesktop).not.toHaveBeenCalled();
		fireEvent.click(screen.getByTestId('virtual-desktop-delete-confirm'));
		expect(deleteDesktop).toHaveBeenCalledWith('vd-2');
	});

	it('supports inline rename confirm with Enter', () => {
		const updateDesktopName = vi.fn();
		render(
			<VirtualDesktops
				desktops={buildDesktops(1)}
				activeDesktopId="vd-1"
				activeDesktopIndex={0}
				createDesktop={vi.fn()}
				deleteDesktop={vi.fn()}
				switchToDesktop={vi.fn()}
				updateDesktopName={updateDesktopName}
			/>
		);
		fireEvent.contextMenu(screen.getByRole('button', { name: 'Desktop 1' }));
		const renameItem = screen.getByText('Rename');
		fireEvent.click(renameItem);
		const input = screen.getByLabelText('Rename desktop');
		fireEvent.change(input, { target: { value: 'Work' } });
		fireEvent.keyDown(input, { key: 'Enter' });
		expect(updateDesktopName).toHaveBeenCalledWith('vd-1', 'Work');
	});
});
