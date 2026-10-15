/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock for desktop background hit-target: clear-selection click,
 * drag-slack ignore, and stable a11y / data markers for welcome guide.
 *
 * Invariants:
 * - Pointer travel beyond slack must not call onBackgroundClick.
 * - data-desktop-background stays on the hit-target; welcome spotlight uses a compact example plate.
 *
 * Related:
 * - DesktopWorkspaceSceneDecor.tsx
 * - documentation/product/desktop/DESKTOP-WORKSPACE-SHELL-INCIDENTS.md
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopWorkspaceSceneDecor } from '../DesktopWorkspaceSceneDecor';

afterEach(() => {
	cleanup();
});

describe('DesktopWorkspaceSceneDecor', () => {
	it('clears selection on near-stationary left click', () => {
		const onBackgroundClick = vi.fn();
		render(
			<DesktopWorkspaceSceneDecor
				backgroundAriaLabel="Фон рабочего стола — клик снимает выделение"
				onBackgroundClick={onBackgroundClick}
				onBackgroundContextMenu={vi.fn()}
			/>
		);

		const hit = screen.getByRole('button', {
			name: 'Фон рабочего стола — клик снимает выделение',
		});
		expect(hit).toHaveAttribute('data-desktop-background');
		expect(hit).not.toHaveAttribute('data-desktop-welcome-guide');
		expect(hit).toHaveAttribute('tabIndex', '-1');

		fireEvent.pointerDown(hit, { button: 0, clientX: 40, clientY: 40 });
		fireEvent.click(hit, { clientX: 42, clientY: 41 });
		expect(onBackgroundClick).toHaveBeenCalledTimes(1);
	});

	it('ignores click after rubber-band drag beyond slack', () => {
		const onBackgroundClick = vi.fn();
		render(
			<DesktopWorkspaceSceneDecor
				backgroundAriaLabel="Desktop background"
				onBackgroundClick={onBackgroundClick}
				onBackgroundContextMenu={vi.fn()}
			/>
		);

		const hit = screen.getByRole('button', { name: 'Desktop background' });
		fireEvent.pointerDown(hit, { button: 0, clientX: 10, clientY: 10 });
		fireEvent.click(hit, { clientX: 40, clientY: 10 });
		expect(onBackgroundClick).not.toHaveBeenCalled();
	});
});
