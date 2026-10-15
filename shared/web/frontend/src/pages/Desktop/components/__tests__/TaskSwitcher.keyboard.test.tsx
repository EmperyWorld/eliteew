/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyboard interaction tests for the desktop task switcher overlay.
 *
 * Related:
 * - src/pages/Desktop/components/TaskSwitcher.tsx
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { TaskSwitcher } from '../TaskSwitcher';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, opts?: { title?: string }) =>
				opts?.title ? `${key}:${opts.title}` : key,
		}),
	};
});

function windowStub(id: string, title: string, zIndex: number): WindowState {
	return {
		id,
		title,
		type: 'app',
		position: { x: 0, y: 0 },
		size: { width: 800, height: 600 },
		isMinimized: false,
		isMaximized: false,
		zIndex,
		path: [],
		appComponent: 'TestApp',
	};
}

describe('TaskSwitcher keyboard', () => {
	it('closes empty switcher on Escape', () => {
		const onClose = vi.fn();
		const outer = vi.fn();
		window.addEventListener('keydown', outer);

		render(
			<TaskSwitcher
				isOpen={true}
				windows={[]}
				onSelectWindow={vi.fn()}
				onClose={onClose}
			/>
		);

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(outer).not.toHaveBeenCalled();

		window.removeEventListener('keydown', outer);
	});

	it('selects highlighted window on Enter using latest selection index', () => {
		const onSelectWindow = vi.fn();
		const onClose = vi.fn();
		render(
			<TaskSwitcher
				isOpen={true}
				windows={[windowStub('w1', 'One', 2), windowStub('w2', 'Two', 1)]}
				currentWindowId="w1"
				onSelectWindow={onSelectWindow}
				onClose={onClose}
			/>
		);

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
			);
		});
		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
			);
		});

		expect(onSelectWindow).toHaveBeenCalledWith('w2');
		expect(onClose).toHaveBeenCalled();
		expect(
			screen.getByRole('button', { name: 'taskSwitcher.selectWindow:Two' })
		).toHaveAttribute('aria-current', 'true');
	});
});
