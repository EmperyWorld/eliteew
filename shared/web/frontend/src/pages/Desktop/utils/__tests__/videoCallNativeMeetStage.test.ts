/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow locks for native Meet stage detection and bounds helper.
 *
 * Related:
 * - videoCallNativeMeetStage.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	isEliteewNativeDesktopProductShell,
	meetStageBoundsFromElement,
} from '../videoCallNativeMeetStage';

vi.mock('@/services/keycloakProfile', () => ({
	getOidcRuntimeProfile: vi.fn(() => 'web'),
}));

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';

describe('videoCallNativeMeetStage', () => {
	afterEach(() => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('web');
		delete (window as Window & { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__;
		delete (window as Window & { EmperyDesktopNativeOidc?: unknown })
			.EmperyDesktopNativeOidc;
		delete (window as Window & { EmperyDesktopMeetStage?: unknown })
			.EmperyDesktopMeetStage;
	});

	it('requires desktopNative/foflineNative and Tauri internals', () => {
		expect(isEliteewNativeDesktopProductShell()).toBe(false);
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('desktopNative');
		expect(isEliteewNativeDesktopProductShell()).toBe(false);
		(
			window as Window & {
				__TAURI_INTERNALS__?: { invoke: () => Promise<unknown> };
			}
		).__TAURI_INTERNALS__ = { invoke: async () => ({}) };
		expect(isEliteewNativeDesktopProductShell()).toBe(true);
	});

	it('does not treat EmpiierOS FoFline as a Tauri Meet shell', async () => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('foflineNative');
		(
			window as Window & {
				EmperyDesktopNativeOidc?: { refreshSessionJson: () => string };
			}
		).EmperyDesktopNativeOidc = {
			refreshSessionJson: () => '{}',
		};
		const { isEmpiierosFoflineHost } = await import(
			'@/services/desktopClient/eliteewProductHost'
		);
		expect(isEmpiierosFoflineHost()).toBe(true);
		expect(isEliteewNativeDesktopProductShell()).toBe(false);
		delete (window as Window & { EmperyDesktopNativeOidc?: unknown })
			.EmperyDesktopNativeOidc;
	});

	it('passes join_url and bounds and does not invent a Meet surface', async () => {
		const { openEmpiierosMeetStage } = await import(
			'../videoCallNativeMeetStage'
		);
		const joinUrl = 'https://meet.eliteew.ru/room?jwt=abc';
		const bounds = { x: 8, y: 16, width: 640, height: 360 };
		expect(await openEmpiierosMeetStage(joinUrl)).toEqual({
			ok: false,
			code: 'meet_stage_bounds_required',
		});
		expect(await openEmpiierosMeetStage(joinUrl, bounds)).toEqual({
			ok: false,
			code: 'meet_stage_unavailable',
		});
		let seen = '';
		let seenBounds: unknown = null;
		(
			window as Window & {
				EmperyDesktopMeetStage?: {
					openMeetStage: (
						url: string,
						rect: typeof bounds
					) => Promise<{ ok: boolean }>;
				};
			}
		).EmperyDesktopMeetStage = {
			openMeetStage: async (url: string, rect: typeof bounds) => {
				seen = url;
				seenBounds = rect;
				return { ok: true };
			},
		};
		expect(await openEmpiierosMeetStage(joinUrl)).toEqual({
			ok: false,
			code: 'meet_stage_bounds_required',
		});
		expect(seen).toBe('');
		expect(await openEmpiierosMeetStage(joinUrl, bounds)).toEqual({ ok: true });
		expect(seen).toBe(joinUrl);
		expect(seenBounds).toEqual(bounds);
		expect(seen).not.toContain('app.eliteew.ru');
		delete (window as Window & { EmperyDesktopMeetStage?: unknown })
			.EmperyDesktopMeetStage;
	});

	it('re-clips with setMeetStageBounds and sends no url', async () => {
		const { setEmpiierosMeetStageBounds } = await import(
			'../videoCallNativeMeetStage'
		);
		const bounds = { x: 1, y: 2, width: 40, height: 40 };
		expect(await setEmpiierosMeetStageBounds(null)).toEqual({
			ok: false,
			code: 'meet_stage_bounds_invalid',
		});
		let seen: unknown = null;
		(
			window as Window & {
				EmperyDesktopMeetStage?: {
					setMeetStageBounds: (rect: typeof bounds) => Promise<{ ok: boolean }>;
				};
			}
		).EmperyDesktopMeetStage = {
			setMeetStageBounds: async (rect: typeof bounds) => {
				seen = rect;
				return { ok: true };
			},
		};
		expect(await setEmpiierosMeetStageBounds(bounds)).toEqual({ ok: true });
		expect(seen).toEqual(bounds);
		expect(JSON.stringify(seen)).not.toContain('jwt');
		expect(JSON.stringify(seen)).not.toContain('meet.eliteew.ru');
	});

	it('closes the OS stage without a join_url and does not paint a denied open', async () => {
		const { closeEmpiierosMeetStage, openEmpiierosMeetStage } = await import(
			'../videoCallNativeMeetStage'
		);
		expect(await closeEmpiierosMeetStage()).toEqual({
			ok: false,
			code: 'meet_stage_unavailable',
		});
		const joinUrl = 'https://meet.eliteew.ru/room?jwt=abc';
		const bounds = { x: 4, y: 8, width: 320, height: 180 };
		let closeArgs: unknown[] | null = null;
		(
			window as Window & {
				EmperyDesktopMeetStage?: {
					openMeetStage: (
						url: string,
						rect: typeof bounds
					) => Promise<{ ok: boolean; code: string }>;
					closeMeetStage: (...args: unknown[]) => Promise<{ ok: boolean }>;
				};
			}
		).EmperyDesktopMeetStage = {
			openMeetStage: async (url: string, rect: typeof bounds) => {
				expect(url).toBe(joinUrl);
				expect(rect).toEqual(bounds);
				expect(url).not.toContain('app.eliteew.ru');
				return { ok: false, code: 'join_url_denied' };
			},
			closeMeetStage: async (...args: unknown[]) => {
				closeArgs = args;
				return { ok: true };
			},
		};
		expect(await openEmpiierosMeetStage(joinUrl, bounds)).toEqual({
			ok: false,
			code: 'join_url_denied',
		});
		expect(await closeEmpiierosMeetStage()).toEqual({ ok: true });
		expect(closeArgs).toEqual([]);
		expect(JSON.stringify(closeArgs)).not.toContain('jwt');
	});

	it('reads the OS Meet-lost event code', async () => {
		const { EMPIIEROS_MEET_STAGE_LOST_EVENT, meetStageLostCode } = await import(
			'../videoCallNativeMeetStage'
		);
		expect(EMPIIEROS_MEET_STAGE_LOST_EVENT).toBe('empiieros-meet-stage-lost');
		expect(meetStageLostCode(new Event('click'))).toBeNull();
		expect(
			meetStageLostCode(
				new CustomEvent(EMPIIEROS_MEET_STAGE_LOST_EVENT, {
					detail: { code: 'meet_process_crashed' },
				})
			)
		).toBe('meet_process_crashed');
	});

	it('builds bounds from element rect', () => {
		const el = document.createElement('div');
		vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
			x: 10,
			y: 20,
			width: 640,
			height: 360,
			top: 20,
			left: 10,
			bottom: 380,
			right: 650,
			toJSON: () => ({}),
		} as DOMRect);
		expect(meetStageBoundsFromElement(el)).toEqual({
			x: 10,
			y: 20,
			width: 640,
			height: 360,
		});
		expect(meetStageBoundsFromElement(null)).toBeNull();
	});
});
