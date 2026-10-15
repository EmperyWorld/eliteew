import * as React from 'react';
import { createContext, useContext } from 'react';

export type AdminShellMode = 'standalone' | 'desktop-embedded';

const AdminShellModeContext = createContext<AdminShellMode>('standalone');

interface AdminShellModeProviderProps {
	mode: AdminShellMode;
	children: React.ReactNode;
}

export const AdminShellModeProvider: React.FC<AdminShellModeProviderProps> = ({
	mode,
	children,
}) => {
	return (
		<AdminShellModeContext.Provider value={mode}>
			{children}
		</AdminShellModeContext.Provider>
	);
};

export function useIsDesktopEmbeddedAdmin() {
	return useContext(AdminShellModeContext) === 'desktop-embedded';
}
