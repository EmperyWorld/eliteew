import { describe, expect, it } from 'vitest';
import { DEFAULT_APPS } from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import { resolveUgsDesktopWindowOpen } from '../desktopUgsOpen';

const ugsStudio = DEFAULT_APPS.find((a) => a.appComponent === 'UGS');
const ugsHub = DEFAULT_APPS.find((a) => a.appComponent === 'UGSHubApp');
if (!ugsStudio || !ugsHub) {
	throw new Error('DEFAULT_APPS must include UGS and UGSHubApp');
}

describe('resolveUgsDesktopWindowOpen', () => {
	it('opens hub when view is hub without workflow', () => {
		const r = resolveUgsDesktopWindowOpen(
			{ view: 'hub' },
			[ugsStudio, ugsHub] as DesktopItem[],
			true
		);
		expect(r?.item.appComponent).toBe('UGSHubApp');
		expect(r?.initialPayload.ugsView).toBe('hub');
	});

	it('opens studio for dashboard view', () => {
		const r = resolveUgsDesktopWindowOpen(
			{ view: 'dashboard' },
			[ugsStudio, ugsHub] as DesktopItem[],
			true
		);
		expect(r?.item.appComponent).toBe('UGS');
		expect(r?.initialPayload.ugsView).toBe('dashboard');
	});

	it('maps admin to hub when user cannot open unified admin', () => {
		const r = resolveUgsDesktopWindowOpen(
			{ view: 'admin' },
			[ugsStudio, ugsHub] as DesktopItem[],
			false
		);
		expect(r?.initialPayload.ugsView).toBe('hub');
	});

	it('maps dashboard to hub when user cannot open unified admin', () => {
		const r = resolveUgsDesktopWindowOpen(
			{ view: 'dashboard' },
			[ugsStudio, ugsHub] as DesktopItem[],
			false
		);
		expect(r?.initialPayload.ugsView).toBe('hub');
		expect(r?.item.appComponent).toBe('UGSHubApp');
	});

	it('keeps analytics view in studio payload', () => {
		const r = resolveUgsDesktopWindowOpen(
			{ view: 'analytics' },
			[ugsStudio, ugsHub] as DesktopItem[],
			true
		);
		expect(r?.item.appComponent).toBe('UGS');
		expect(r?.initialPayload.ugsView).toBe('analytics');
	});
});
