/**
 * Пресет «Стиль окон» для всего приложения вне дерева рабочего стола.
 * Merge совпадает с серверным снимком в useDesktopWorkspaceVisualProfileBridge;
 * на маршруте desktop внутренний DesktopShellFrameProvider в DesktopWorkspaceShellLayout
 * переопределяет значение живым состоянием (в т.ч. оптимистичные правки настроек).
 */

import { DesktopShellFrameProvider } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	DEFAULT_UI_PREFERENCES,
	type DesktopWindowStyle,
	type UIPreferences,
} from '@/types/profile';
import * as React from 'react';
import { useMemo, type ReactNode } from 'react';
import { useUserPreferencesApp } from './UserPreferencesAppContext';

export function GlobalDesktopShellFrameProvider({
	children,
}: {
	children: ReactNode;
}): React.JSX.Element {
	const prefsApp = useUserPreferencesApp();
	const windowStyle = useMemo<DesktopWindowStyle>(() => {
		const merged: UIPreferences = {
			...DEFAULT_UI_PREFERENCES,
			...(prefsApp?.preferences?.ui ?? {}),
		};
		return merged.desktop_window_style;
	}, [prefsApp?.preferences?.ui]);

	return (
		<DesktopShellFrameProvider windowStyle={windowStyle}>
			{children}
		</DesktopShellFrameProvider>
	);
}
