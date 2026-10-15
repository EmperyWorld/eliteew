/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Empery Nexus Chronicle desktop launcher registration.
 *
 * Invariants:
 * - EmperyNexusChronicleApp resolves through default apps, known components, window content and preload.
 *
 * Related:
 * - pages/Desktop/apps/EmperyNexusChronicleApp.tsx
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_APPS } from '../../constants';
import { getDesktopWindowAppContent } from '../../components/desktopWindowAppContent';
import { isKnownDesktopAppComponent } from '../desktopAppRegistry';
import { parseAssistantDesktopAppHref } from '../assistantDesktopLinkComponents';
import { preloadDesktopApp } from '../preloadDesktopApp';
import { resolveDesktopWindowAppComponent } from '../desktopWindowResolveApp';

describe('EmperyNexusChronicle desktop app registry', () => {
	it('registers Empery Nexus as a launchable desktop app', () => {
		const app = DEFAULT_APPS.find(
			(item) => item.appComponent === 'EmperyNexusChronicleApp'
		);

		expect(app).toMatchObject({
			id: 'app-empery-nexus-chronicle',
			name: 'Хроника',
			type: 'app',
			appComponent: 'EmperyNexusChronicleApp',
			category: 'productivity',
			isPinned: true,
		});
		expect(isKnownDesktopAppComponent('EmperyNexusChronicleApp')).toBe(true);
	});

	it('resolves EmperyNexusChronicleApp from restored titles and window content', () => {
		expect(
			resolveDesktopWindowAppComponent(undefined, {
				id: 'window-empery-nexus',
				type: 'app',
				title: 'Empery Nexus',
				appComponent: undefined,
				position: { x: 0, y: 0 },
				size: { width: 640, height: 480 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
			})
		).toBe('EmperyNexusChronicleApp');
		expect(
			getDesktopWindowAppContent('EmperyNexusChronicleApp')
		).not.toBeNull();
		expect(preloadDesktopApp('EmperyNexusChronicleApp')).toBeInstanceOf(
			Promise
		);
	});

	it('allows assistant markdown links to open Empery Nexus', () => {
		expect(
			parseAssistantDesktopAppHref(
				'/__eliteew-desktop-open-app__/EmperyNexusChronicleApp'
			)
		).toBe('EmperyNexusChronicleApp');
	});
});
