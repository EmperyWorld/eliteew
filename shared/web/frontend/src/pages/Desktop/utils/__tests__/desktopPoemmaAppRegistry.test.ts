/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the Poemma desktop app registration surface.
 *
 * Invariants:
 * - `PoemmaApp` must resolve through default apps, known component validation, window fallback and preload.
 * - Assistant desktop markdown links must allow opening Poemma by component.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx
 * - src/pages/Desktop/constants/index.ts
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_APPS } from '../../constants';
import { getDesktopWindowAppContent } from '../../components/desktopWindowAppContent';
import { isKnownDesktopAppComponent } from '../desktopAppRegistry';
import { parseAssistantDesktopAppHref } from '../assistantDesktopLinkComponents';
import { preloadDesktopApp } from '../preloadDesktopApp';
import { resolveDesktopWindowAppComponent } from '../desktopWindowResolveApp';

describe('Poemma desktop app registry', () => {
	it('registers Poemma as a launchable desktop app', () => {
		const app = DEFAULT_APPS.find((item) => item.appComponent === 'PoemmaApp');

		expect(app).toMatchObject({
			id: 'app-poemma',
			name: 'POEMMA',
			type: 'app',
			appComponent: 'PoemmaApp',
			category: 'productivity',
			isPinned: true,
		});
		expect(isKnownDesktopAppComponent('PoemmaApp')).toBe(true);
	});

	it('resolves Poemma from restored titles and window content', () => {
		expect(
			resolveDesktopWindowAppComponent(undefined, {
				id: 'window-poemma',
				type: 'app',
				title: 'Карта бизнеса',
				appComponent: undefined,
				position: { x: 0, y: 0 },
				size: { width: 960, height: 720 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
			})
		).toBe('PoemmaApp');
		expect(getDesktopWindowAppContent('PoemmaApp')).not.toBeNull();
		expect(preloadDesktopApp('PoemmaApp')).toBeInstanceOf(Promise);
	});

	it('allows assistant markdown links to open Poemma', () => {
		expect(
			parseAssistantDesktopAppHref('/__eliteew-desktop-open-app__/PoemmaApp')
		).toBe('PoemmaApp');
	});
});
