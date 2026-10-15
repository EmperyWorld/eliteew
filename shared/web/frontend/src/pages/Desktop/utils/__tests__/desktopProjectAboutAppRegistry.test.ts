/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the «О проекте» desktop app registration surface.
 *
 * Invariants:
 * - `ProjectAboutApp` must resolve through default apps, known component validation, window fallback and preload.
 *
 * Related:
 * - src/pages/Desktop/apps/ProjectAboutApp.tsx
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_APPS } from '../../constants';
import { getDesktopWindowAppContent } from '../../components/desktopWindowAppContent';
import { isKnownDesktopAppComponent } from '../desktopAppRegistry';
import { parseAssistantDesktopAppHref } from '../assistantDesktopLinkComponents';
import { preloadDesktopApp } from '../preloadDesktopApp';
import { resolveDesktopWindowAppComponent } from '../desktopWindowResolveApp';

describe('ProjectAbout desktop app registry', () => {
	it('registers «О проекте» as a launchable desktop app', () => {
		const app = DEFAULT_APPS.find(
			(item) => item.appComponent === 'ProjectAboutApp'
		);

		expect(app).toMatchObject({
			id: 'app-about-project',
			name: 'О проекте',
			type: 'app',
			appComponent: 'ProjectAboutApp',
			category: 'productivity',
			isPinned: true,
		});
		expect(isKnownDesktopAppComponent('ProjectAboutApp')).toBe(true);
	});

	it('resolves ProjectAboutApp from restored titles and window content', () => {
		expect(
			resolveDesktopWindowAppComponent(undefined, {
				id: 'window-about-project',
				type: 'app',
				title: 'О проекте',
				appComponent: undefined,
				position: { x: 0, y: 0 },
				size: { width: 960, height: 720 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
			})
		).toBe('ProjectAboutApp');
		expect(getDesktopWindowAppContent('ProjectAboutApp')).not.toBeNull();
		expect(preloadDesktopApp('ProjectAboutApp')).toBeInstanceOf(Promise);
	});

	it('allows assistant markdown links to open «О проекте»', () => {
		expect(
			parseAssistantDesktopAppHref(
				'/__eliteew-desktop-open-app__/ProjectAboutApp'
			)
		).toBe('ProjectAboutApp');
	});
});
