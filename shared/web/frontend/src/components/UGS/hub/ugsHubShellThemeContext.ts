/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context for UGS shell theme (follows desktop `#desktop-main[data-theme]`).
 *
 * Invariants:
 * - Default is `dark` when provider is absent (legacy standalone routes).
 *
 * Related:
 * - hooks/useDesktopShellTheme.ts, pages/Desktop/components/UGSDesktopContainer.tsx
 */

import { createContext, useContext } from 'react';

import type { DesktopShellTheme } from '../../../hooks/useDesktopShellTheme';

const UgsHubShellThemeContext = createContext<DesktopShellTheme>('dark');

export const UgsHubShellThemeProvider = UgsHubShellThemeContext.Provider;

export function useUgsHubShellTheme(): DesktopShellTheme {
	return useContext(UgsHubShellThemeContext);
}
