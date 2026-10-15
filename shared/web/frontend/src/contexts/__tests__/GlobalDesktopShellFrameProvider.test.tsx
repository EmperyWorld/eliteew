/**
 * Контракт: пресет окон из профиля попадает в DesktopShellFrameContext для полноэкранных маршрутов.
 */
import {
	DesktopShellFrameProvider,
	useDesktopShellFrame,
} from '@/pages/Desktop/context/DesktopShellFrameContext';
import type { DesktopWindowStyle } from '@/types/profile';
import { DEFAULT_UI_PREFERENCES, type UserPreferences } from '@/types/profile';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalDesktopShellFrameProvider } from '../GlobalDesktopShellFrameProvider';
import type { UserPreferencesAppContextValue } from '../UserPreferencesAppContext';

vi.mock('../UserPreferencesAppContext', () => ({
	useUserPreferencesApp: vi.fn(),
}));

import { useUserPreferencesApp } from '../UserPreferencesAppContext';

const mockPrefsApp = vi.mocked(useUserPreferencesApp);

function minimalUserPreferences(
	overrides: Partial<UserPreferences['ui']> = {}
): UserPreferences {
	return {
		language: 'ru',
		theme: 'dark',
		notifications: {} as UserPreferences['notifications'],
		privacy: {} as UserPreferences['privacy'],
		ui: { ...DEFAULT_UI_PREFERENCES, ...overrides },
		accessibility: {
			high_contrast: false,
			large_text: false,
			reduce_motion: false,
			screen_reader: false,
		},
	};
}

function FrameProbe({
	expectStyle,
}: {
	expectStyle: DesktopWindowStyle;
}): null {
	const shell = useDesktopShellFrame();
	expect(shell).toBe(expectStyle);
	return null;
}

describe('GlobalDesktopShellFrameProvider', () => {
	it('provides desktop_window_style from merged profile ui', () => {
		mockPrefsApp.mockReturnValue({
			preferences: minimalUserPreferences({ desktop_window_style: 'minimal' }),
			loading: false,
			refresh: vi.fn(),
		} satisfies UserPreferencesAppContextValue);

		render(
			<GlobalDesktopShellFrameProvider>
				<FrameProbe expectStyle="minimal" />
			</GlobalDesktopShellFrameProvider>
		);
	});

	it('inner DesktopShellFrameProvider overrides global value', () => {
		mockPrefsApp.mockReturnValue({
			preferences: minimalUserPreferences({ desktop_window_style: 'glass' }),
			loading: false,
			refresh: vi.fn(),
		} satisfies UserPreferencesAppContextValue);

		render(
			<GlobalDesktopShellFrameProvider>
				<DesktopShellFrameProvider windowStyle="framed">
					<FrameProbe expectStyle="framed" />
				</DesktopShellFrameProvider>
			</GlobalDesktopShellFrameProvider>
		);
	});
});
