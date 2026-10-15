import { useEffect, useState } from 'react';

export type DesktopShellTheme = 'light' | 'dark';

function readShellTheme(): DesktopShellTheme {
	if (typeof document === 'undefined') return 'dark';
	const main = document.getElementById('desktop-main');
	if (main) {
		return main.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
	}
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Follows desktop shell light/dark (`#desktop-main[data-theme]`) when embedded in the desktop;
 * otherwise falls back to `html.dark` / light.
 */
export function useDesktopShellTheme(): DesktopShellTheme {
	const [theme, setTheme] = useState<DesktopShellTheme>(readShellTheme);

	useEffect(() => {
		const main = document.getElementById('desktop-main');
		const apply = () => setTheme(readShellTheme());
		apply();
		if (!main) return;
		const mo = new MutationObserver(apply);
		mo.observe(main, { attributes: true, attributeFilter: ['data-theme'] });
		return () => mo.disconnect();
	}, []);

	return theme;
}
