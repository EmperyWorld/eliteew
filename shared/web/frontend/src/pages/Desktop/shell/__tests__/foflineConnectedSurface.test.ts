/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline connected surface set excludes denied boot apps (A3).
 *
 * Related:
 * - ../foflineConnectedSurface.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.5
 */

import { describe, expect, it } from 'vitest';
import {
	FOFLINE_CONNECTED_APP_COMPONENTS,
	intersectFoflineConnectedSurface,
} from '../foflineConnectedSurface';

describe('foflineConnectedSurface', () => {
	it('includes GAF/video-call surface and excludes marketing and experts', () => {
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('EwaApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('ContentManagerPro')).toBe(
			true
		);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('GAFChatApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('VideoCallApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('CalendarApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('DocEditorV2')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('EWRP')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('ImageStudio')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('SocialHubApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('SurveyHubApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('KursorinaApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('EBrowserApp')).toBe(true);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('ProfessionalWorlds')).toBe(
			true
		);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('DocEditor')).toBe(false);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('Presentations')).toBe(false);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('DesktopAiChatApp')).toBe(
			false
		);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('MusicForgeApp')).toBe(false);
		expect(FOFLINE_CONNECTED_APP_COMPONENTS.has('MarketingCabinet')).toBe(
			false
		);
	});

	it('intersects cloud-full API sets down to FoFline surface', () => {
		const cloudish = new Set([
			'EwaApp',
			'GAFChatApp',
			'NotificationsApp',
			'MusicForgeApp',
		]);
		const out = intersectFoflineConnectedSurface(cloudish);
		expect(out.has('EwaApp')).toBe(true);
		expect(out.has('NotificationsApp')).toBe(true);
		expect(out.has('GAFChatApp')).toBe(true);
		expect(out.has('MusicForgeApp')).toBe(false);
	});
});
