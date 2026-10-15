/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DesktopVoiceContext mutual exclusion + open/enable Live Voice helpers.
 *
 * Related:
 * - DesktopVoiceContext.tsx
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DesktopVoiceProvider, useDesktopVoice } from '../DesktopVoiceContext';

function wrapper({ children }: { children: ReactNode }) {
	return <DesktopVoiceProvider>{children}</DesktopVoiceProvider>;
}

describe('DesktopVoiceContext Live Voice helpers', () => {
	it('enableLiveVoice sets live-voice mode and opens the panel', () => {
		const { result } = renderHook(() => useDesktopVoice(), { wrapper });

		act(() => {
			result.current.setActiveMode('voice-command');
		});
		expect(result.current.activeMode).toBe('voice-command');

		act(() => {
			result.current.enableLiveVoice();
		});

		expect(result.current.activeMode).toBe('live-voice');
		expect(result.current.showLiveVoicePanel).toBe(true);
	});

	it('openLiveVoicePanel opens without requiring live-voice mode', () => {
		const { result } = renderHook(() => useDesktopVoice(), { wrapper });

		act(() => {
			result.current.openLiveVoicePanel();
		});

		expect(result.current.showLiveVoicePanel).toBe(true);
		expect(result.current.activeMode).toBeNull();
	});

	it('leaving live-voice mode closes the panel', () => {
		const { result } = renderHook(() => useDesktopVoice(), { wrapper });

		act(() => {
			result.current.enableLiveVoice();
		});
		act(() => {
			result.current.setActiveMode('voice-command');
		});

		expect(result.current.activeMode).toBe('voice-command');
		expect(result.current.showLiveVoicePanel).toBe(false);
	});
});
