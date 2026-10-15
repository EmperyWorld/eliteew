/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React-only application entry loaded in parallel with auth and cold i18n.
 *
 * Invariants:
 * - Auth facade initialization is completed by `mainFullApp.ts` before mount.
 * - Static preloader handoff occurs from a committed React layout effect.
 * - Non-shell font families load after commit and never block auth.
 *
 * Related:
 * - `mainFullApp.ts`, `utils/appPreloader.ts`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

import './lib/zodCspJitless';
import './styles/index.css';
import './utils/axiosSetup';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';

import {
	createElement,
	Fragment,
	useLayoutEffect,
	type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { registerAppReactRoot } from './utils/reactAppLifecycle';
import { completeAppPreloaderHandoff } from './utils/appPreloader';
import { markBootPerformance } from './services/boot/bootPerformance';

function ReactCommitBoundary({ children }: { children: ReactNode }) {
	useLayoutEffect(() => {
		markBootPerformance('react-root-committed');
		completeAppPreloaderHandoff();
		void import('./styles/fontImports');
	}, []);
	return createElement(Fragment, null, children);
}

export function mountReactApplication(): void {
	const root = document.getElementById('root');
	if (!root) {
		throw new Error('Root element not found');
	}
	const reactRoot = createRoot(root);
	registerAppReactRoot(reactRoot);
	reactRoot.render(
		createElement(
			ReactCommitBoundary,
			null,
			createElement(
				AuthProvider,
				null,
				createElement(AppStateProvider, null, createElement(App))
			)
		)
	);
}
