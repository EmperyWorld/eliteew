/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * a11y regression tests for desktop icon badge and rename affordances.
 *
 * Invariants:
 * - Copy comes from `desktopUi.desktopIcon` keys.
 *
 * Related:
 * - `DesktopIcon.tsx`
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesktopIcon from '../DesktopIcon';
import type { DesktopItem } from '../../types/desktop.types';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, opts?: { count?: number; name?: string }) => {
				if (opts?.count !== undefined) {
					return `${key}:${opts.count}`;
				}
				if (opts?.name) {
					return `${key}:${opts.name}`;
				}
				return key;
			},
		}),
	};
});

const baseApp: DesktopItem = {
	id: 'icon-1',
	name: 'Test App',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'AppStore',
};

describe('DesktopIcon a11y', () => {
	it('exposes rename field with an accessible name', () => {
		render(
			<DesktopIcon
				item={baseApp}
				isSelected={false}
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
				isRenaming
				onRename={() => {}}
				onCancelRename={() => {}}
			/>
		);
		expect(
			screen.getByRole('textbox', {
				name: 'desktopIcon.renameAria:Test App',
			})
		).toBeInTheDocument();
	});

	it('exits rename without changes on blur or Enter', () => {
		const onRename = vi.fn();
		const onCancelRename = vi.fn();
		render(
			<DesktopIcon
				item={baseApp}
				isSelected={false}
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
				isRenaming
				onRename={onRename}
				onCancelRename={onCancelRename}
			/>
		);
		const input = screen.getByRole('textbox', {
			name: 'desktopIcon.renameAria:Test App',
		});
		fireEvent.blur(input);
		expect(onRename).not.toHaveBeenCalled();
		expect(onCancelRename).toHaveBeenCalledTimes(1);

		onCancelRename.mockClear();
		fireEvent.keyDown(input, { key: 'Enter' });
		expect(onRename).not.toHaveBeenCalled();
		expect(onCancelRename).toHaveBeenCalledTimes(1);
	});

	it('announces unread badge count for assistive tech', () => {
		render(
			<DesktopIcon
				item={baseApp}
				isSelected={false}
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
				badgeCount={3}
			/>
		);
		expect(
			screen.getByLabelText('desktopIcon.unreadBadge:3')
		).toBeInTheDocument();
	});

	it('exposes multi-select state with aria-pressed on role button', () => {
		const { rerender } = render(
			<DesktopIcon
				item={baseApp}
				isSelected={false}
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
			/>
		);
		const btn = screen.getByRole('button', { name: /test app/i });
		expect(btn).toHaveAttribute('aria-pressed', 'false');

		rerender(
			<DesktopIcon
				item={baseApp}
				isSelected
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
			/>
		);
		expect(btn).toHaveAttribute('aria-pressed', 'true');
	});

	it('does not expose hover tooltips or native title on canvas icons', () => {
		render(
			<DesktopIcon
				item={{
					...baseApp,
					description: 'Should not appear as hover popup',
				}}
				isSelected={false}
				onSelect={() => {}}
				onDoubleClick={() => {}}
				onContextMenu={() => {}}
				onDragEnd={() => {}}
			/>
		);
		const btn = screen.getByRole('button', { name: /test app/i });
		expect(btn).not.toHaveAttribute('title');
		fireEvent.pointerEnter(btn);
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
		expect(
			screen.queryByText(/Should not appear as hover popup/)
		).not.toBeInTheDocument();
	});
});
