/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Studio Live tab: open/enable CTAs stay available when voice-command mode is on.
 *
 * Related:
 * - StudioLiveTab.tsx, DesktopVoiceContext.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioLiveTab } from '../StudioLiveTab';

const enableLiveVoice = vi.fn();
const openLiveVoicePanel = vi.fn();

vi.mock('@/pages/Desktop/context/DesktopVoiceContext', () => ({
	useDesktopVoice: () => ({
		activeMode: 'voice-command',
		liveVoice: { serviceAvailable: false, lastSuccess: null },
		showLiveVoicePanel: false,
		enableLiveVoice,
		openLiveVoicePanel,
		setShowLiveVoicePanel: vi.fn(),
		setActiveMode: vi.fn(),
	}),
}));

vi.mock('@/pages/Desktop/context/DesktopShellFrameContext', () => ({
	useDesktopShellFrame: () => 'glass',
}));

describe('StudioLiveTab Live Voice CTAs', () => {
	it('keeps open and enable actions available while voice-command is active', () => {
		render(<StudioLiveTab />);

		const enableBtn = screen.getByRole('button', {
			name: /Включить Live Voice/i,
		});
		const openBtn = screen.getByRole('button', {
			name: /Открыть панель Live Voice/i,
		});

		expect(enableBtn).not.toBeDisabled();
		expect(openBtn).not.toBeDisabled();

		fireEvent.click(enableBtn);
		expect(enableLiveVoice).toHaveBeenCalledTimes(1);

		fireEvent.click(openBtn);
		expect(openLiveVoicePanel).toHaveBeenCalledTimes(1);

		expect(
			screen.getByText(/отключит их на виджете рабочего стола/i)
		).toBeInTheDocument();
	});
});
