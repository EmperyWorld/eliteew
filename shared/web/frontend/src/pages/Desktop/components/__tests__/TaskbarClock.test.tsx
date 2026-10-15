/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cover core TaskbarClock interactions: outside pointer dismiss and copy action.
 *
 * Invariants:
 * - Context-menu "copy date/time" uses shared safe clipboard helper.
 *
 * Related:
 * - src/pages/Desktop/components/TaskbarClock.tsx
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskbarClock } from '../TaskbarClock';

const mockSafeCopyToClipboard = vi.fn((_text: string) => Promise.resolve(true));
const mockPersistClockShowSeconds = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			resolvedLanguage: 'en-US',
			language: 'en-US',
		},
	}),
}));

vi.mock('@/pages/Desktop/hooks/useDesktopTaskbarShellPrefs', () => ({
	useTaskbarShellClockPrefs: () => ({
		showSeconds: false,
		persistClockShowSeconds: mockPersistClockShowSeconds,
	}),
}));

vi.mock('@/pages/Desktop/hooks/useFinePointerHover', () => ({
	useFinePointerHover: () => false,
}));

vi.mock('@/pages/Desktop/hooks/useTaskbarMiniCalendarEvents', () => ({
	useTaskbarMiniCalendarEvents: () => [],
}));

vi.mock('@/pages/Desktop/hooks/useTaskbarClockTodayIndicator', () => ({
	useTaskbarClockTodayIndicator: () => false,
}));

vi.mock('@/pages/Desktop/hooks/useDesktopPopoverOpenGuard', () => ({
	useDesktopPopoverOpenGuard: () => ({ current: false }),
}));

vi.mock('@/utils/clipboard', () => ({
	safeCopyToClipboard: (text: string) => mockSafeCopyToClipboard(text),
}));

vi.mock('@/notifications', () => ({
	notify: {
		success: (message: string) => mockNotifySuccess(message),
		error: (message: string) => mockNotifyError(message),
	},
}));

describe('TaskbarClock', () => {
	beforeEach(() => {
		mockSafeCopyToClipboard.mockClear();
		mockPersistClockShowSeconds.mockClear();
		mockNotifySuccess.mockClear();
		mockNotifyError.mockClear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-22T10:15:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('closes settings popup on outside pointer down', () => {
		render(
			<TaskbarClock
				taskbarButtonSurface=""
				taskbarButtonActiveSurface=""
				shellPanel=""
			/>
		);

		const clockToggle = screen.getByRole('button', {
			name: 'taskbar.clockAria',
		});
		fireEvent.click(clockToggle);

		expect(screen.getByText('taskbar.clockSeconds')).toBeInTheDocument();

		fireEvent.pointerDown(document.body);

		expect(screen.queryByText('taskbar.clockSeconds')).not.toBeInTheDocument();
	});

	it('uses safe clipboard helper from context menu copy action', async () => {
		render(
			<TaskbarClock
				taskbarButtonSurface=""
				taskbarButtonActiveSurface=""
				shellPanel=""
			/>
		);

		const clockToggle = screen.getByRole('button', {
			name: 'taskbar.clockAria',
		});

		fireEvent.contextMenu(clockToggle, { clientX: 120, clientY: 40 });

		await act(async () => {
			fireEvent.click(
				screen.getByRole('menuitem', {
					name: 'taskbar.trayContextCopyDateTime',
				})
			);
		});

		expect(mockSafeCopyToClipboard).toHaveBeenCalledTimes(1);
		expect(mockSafeCopyToClipboard.mock.calls[0]?.[0]).toEqual(
			expect.any(String)
		);
		expect(mockNotifySuccess).toHaveBeenCalledWith(
			'taskbar.trayContextCopyDateTimeDone'
		);
		expect(mockNotifyError).not.toHaveBeenCalled();
	});

	it('closes settings popup on Escape with capture', () => {
		render(
			<TaskbarClock
				taskbarButtonSurface=""
				taskbarButtonActiveSurface=""
				shellPanel=""
			/>
		);

		const clockToggle = screen.getByRole('button', {
			name: 'taskbar.clockAria',
		});
		fireEvent.click(clockToggle);
		expect(screen.getByText('taskbar.clockSeconds')).toBeInTheDocument();

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(screen.queryByText('taskbar.clockSeconds')).not.toBeInTheDocument();
	});

	it('refreshes displayed time when the tab becomes visible again', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});

		render(
			<TaskbarClock
				taskbarButtonSurface=""
				taskbarButtonActiveSurface=""
				shellPanel=""
			/>
		);

		const clockToggle = screen.getByRole('button', {
			name: 'taskbar.clockAria',
		});
		const initialLabel = clockToggle.textContent ?? '';

		act(() => {
			vi.setSystemTime(new Date('2026-06-22T12:45:00Z'));
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(clockToggle.textContent).not.toBe(initialLabel);
		expect(clockToggle.textContent).toMatch(/10:45|22:45/);
	});
});
