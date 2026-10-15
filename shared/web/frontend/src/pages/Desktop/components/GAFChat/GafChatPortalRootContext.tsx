import { createContext, useContext } from 'react';

/**
 * Root for GAF Chat overlays (attachment preview). Must stay inside the desktop window
 * subtree so clicks are not treated as outside the window.
 */
export const GafChatPortalRootContext = createContext<HTMLElement | null>(null);

export function useGafChatPortalRoot(): HTMLElement | null {
	return useContext(GafChatPortalRootContext);
}
