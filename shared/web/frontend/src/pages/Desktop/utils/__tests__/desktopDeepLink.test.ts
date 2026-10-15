/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for **`desktopDeepLink`** helpers (open/close/focus, companion Doc Editor set-body dispatch + fanout).
 *
 * Invariants:
 * - No network — browser globals only.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopDeepLink.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildContentManagerUrl,
	coerceDesktopMusicPlayTrackDetail,
	DESKTOP_CLOSE_START_MENU_EVENT,
	DESKTOP_CLOSE_NEWEST_APP_EVENT,
	DESKTOP_DOC_EDITOR_COMPANION_SET_BODY_EVENT,
	DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT,
	DESKTOP_MUSIC_PLAY_TRACK_EVENT,
	DESKTOP_OPEN_SHELL_SETTINGS_EVENT,
	DESKTOP_OPEN_START_MENU_EVENT,
	dispatchDocEditorCompanionSetBody,
	registerDesktopDocEditorCompanionSetBodyConsumer,
	requestCloseStartMenu,
	requestOpenDesktopApp,
	requestOpenDesktopShellSettings,
	requestOpenDocEditor,
	requestOpenDocEditorV2WithUnifiedContent,
	requestOpenDocEditorWithUnifiedContent,
	requestOpenNewDocEditorV2,
	requestOpenGafChatByUsername,
	requestOpenVideoCallWindow,
	requestEnqueueInMusicPlayer,
	requestPlayInMusicPlayer,
	requestOpenStartMenu,
} from '../desktopDeepLink';

describe('desktopDeepLink', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	afterEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it('requestOpenStartMenu dispatches desktop-open-start-menu', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_OPEN_START_MENU_EVENT, spy);
		requestOpenStartMenu();
		expect(spy).toHaveBeenCalledTimes(1);
		const bare = spy.mock.calls[0][0] as CustomEvent;
		expect(bare.detail).toEqual({ tab: undefined });
		window.removeEventListener(DESKTOP_OPEN_START_MENU_EVENT, spy);
	});

	it('requestOpenStartMenu can request a typed discovery tab', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_OPEN_START_MENU_EVENT, spy);
		requestOpenStartMenu('recent');
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({ tab: 'recent' });
		window.removeEventListener(DESKTOP_OPEN_START_MENU_EVENT, spy);
	});

	it('requestCloseStartMenu dispatches desktop-close-start-menu', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_CLOSE_START_MENU_EVENT, spy);
		requestCloseStartMenu();
		expect(spy).toHaveBeenCalledTimes(1);
		window.removeEventListener(DESKTOP_CLOSE_START_MENU_EVENT, spy);
	});

	it('requestOpenDesktopShellSettings dispatches with tab detail', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_OPEN_SHELL_SETTINGS_EVENT, spy);
		requestOpenDesktopShellSettings('icons');
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({ tab: 'icons' });
		window.removeEventListener(DESKTOP_OPEN_SHELL_SETTINGS_EVENT, spy);
	});

	it('requestOpenDesktopApp dispatches desktop-open-app with detail', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDesktopApp({ appComponent: 'TestApp', foo: 1 });
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({ appComponent: 'TestApp', foo: 1 });
		window.removeEventListener('desktop-open-app', spy);
	});

	it('opens VideoCall without closing GAF chat', () => {
		const opened: string[] = [];
		const closed: string[] = [];
		const onOpen = (event: Event) => {
			opened.push(String((event as CustomEvent).detail?.appComponent));
		};
		const onClose = (event: Event) => {
			closed.push(String((event as CustomEvent).detail?.appComponent));
		};
		window.addEventListener('desktop-open-app', onOpen);
		window.addEventListener(DESKTOP_CLOSE_NEWEST_APP_EVENT, onClose);
		requestOpenVideoCallWindow({
			videoCallId: 'call-1',
			videoCallTitle: 'Call',
			videoCallJoinUrl: 'https://meet.eliteew.ru/room?jwt=abc',
		});
		expect(opened).toEqual(['VideoCallApp']);
		expect(closed).not.toContain('GAFChatApp');
		expect(JSON.stringify(closed)).not.toContain('jwt');
		window.removeEventListener('desktop-open-app', onOpen);
		window.removeEventListener(DESKTOP_CLOSE_NEWEST_APP_EVENT, onClose);
	});

	it('coerces desktop music play payload aliases', () => {
		expect(
			coerceDesktopMusicPlayTrackDetail({
				content_id: 'uc-11',
				track_name: 'Track',
				thumbnailUrl: 'https://example.com/t.jpg',
				sourceSurface: 'ewa-companion',
			})
		).toEqual({
			id: 'uc-11',
			name: 'Track',
			thumbnail_url: 'https://example.com/t.jpg',
			version: null,
			mime_type: null,
			source_surface: 'ewa-companion',
		});
	});

	it('requestPlayInMusicPlayer dispatches normalized desktop-music-play-track', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
		requestPlayInMusicPlayer({
			id: '  uc-44  ',
			name: '  Summer Track  ',
			thumbnail_url: 'https://example.com/cover.png',
			source_surface: 'music-generator',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({
			id: 'uc-44',
			name: 'Summer Track',
			thumbnail_url: 'https://example.com/cover.png',
			version: null,
			mime_type: null,
			source_surface: 'music-generator',
		});
		window.removeEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
	});

	it('requestEnqueueInMusicPlayer dispatches normalized queue event', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT, spy);
		requestEnqueueInMusicPlayer({
			id: ' uc-queue-1 ',
			name: ' Queue Track ',
			version: 'v42',
			source_surface: 'content-manager',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({
			id: 'uc-queue-1',
			name: 'Queue Track',
			thumbnail_url: null,
			version: 'v42',
			mime_type: null,
			source_surface: 'content-manager',
		});
		window.removeEventListener(DESKTOP_MUSIC_ENQUEUE_TRACK_EVENT, spy);
	});

	it('requestOpenDocEditorWithUnifiedContent is no-op for blank id', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditorWithUnifiedContent('   ');
		expect(spy).not.toHaveBeenCalled();
		window.removeEventListener('desktop-open-app', spy);
	});

	it('companion set-body fanout reaches a registered consumer', () => {
		const received: string[] = [];
		const unreg = registerDesktopDocEditorCompanionSetBodyConsumer((d) => {
			received.push(d.bodyHtml);
		});
		dispatchDocEditorCompanionSetBody({ bodyHtml: '<p>ok</p>' });
		expect(received).toEqual(['<p>ok</p>']);
		unreg();
		received.length = 0;
		dispatchDocEditorCompanionSetBody({ bodyHtml: '<p>x</p>' });
		expect(received).toEqual([]);
	});
	it('dispatchDocEditorCompanionSetBody dispatches set-body event with detail', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_DOC_EDITOR_COMPANION_SET_BODY_EVENT, spy);
		dispatchDocEditorCompanionSetBody({
			bodyHtml: '  <p>x</p>  ',
			unifiedContentId: 'uc-9',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({
			bodyHtml: '  <p>x</p>  ',
			unifiedContentId: 'uc-9',
		});
		window.removeEventListener(
			DESKTOP_DOC_EDITOR_COMPANION_SET_BODY_EVENT,
			spy
		);
	});

	it('requestOpenDocEditor dispatches unifiedContent target', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditor({
			targetType: 'unifiedContent',
			id: '  uc-77  ',
			openCollabPanel: true,
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditor',
			unifiedContentId: 'uc-77',
			openCollabPanel: true,
		});
		expect(
			(ev.detail as { docOpenRequestId?: unknown }).docOpenRequestId
		).toBeTypeOf('string');
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenDocEditor dispatches legacy document target', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditor({
			targetType: 'docEditor',
			id: 'doc-14',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditor',
			documentId: 'doc-14',
		});
		expect(
			(ev.detail as { docOpenRequestId?: unknown }).docOpenRequestId
		).toBeTypeOf('string');
		window.removeEventListener('desktop-open-app', spy);
	});

	it('passes forceNewWindow flag for DocEditor deep-links', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditor({
			targetType: 'docEditor',
			id: 'doc-99',
			forceNewWindow: true,
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditor',
			documentId: 'doc-99',
			forceNewWindow: true,
		});
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenDocEditorWithUnifiedContent supports explicit new window mode', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditorWithUnifiedContent('uc-11', { forceNewWindow: true });
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditor',
			unifiedContentId: 'uc-11',
			forceNewWindow: true,
		});
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenNewDocEditorV2 dispatches a guarded V2 new-document window', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenNewDocEditorV2({ title: 'New V2 plan' });
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditorV2',
			forceNewWindow: true,
			docEditorTitle: 'New V2 plan',
			initialTitle: 'New V2 plan',
		});
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenDocEditorV2WithUnifiedContent dispatches V2 with unified content id', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenDocEditorV2WithUnifiedContent(' uc-v2-11 ', {
			title: 'File title',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'DocEditorV2',
			forceNewWindow: true,
			unifiedContentId: 'uc-v2-11',
			docEditorTitle: 'File title',
			initialTitle: 'File title',
		});
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenGafChatByUsername does not dispatch for empty or invalid username', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenGafChatByUsername('');
		requestOpenGafChatByUsername('   ');
		requestOpenGafChatByUsername('\u200buser');
		expect(spy).not.toHaveBeenCalled();
		window.removeEventListener('desktop-open-app', spy);
	});

	it('requestOpenGafChatByUsername dispatches with stripped @ and normalized username', () => {
		const spy = vi.fn();
		window.addEventListener('desktop-open-app', spy);
		requestOpenGafChatByUsername('@  alice  ');
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toMatchObject({
			appComponent: 'GAFChatApp',
			targetUsername: 'alice',
		});
		window.removeEventListener('desktop-open-app', spy);
	});

	it('buildContentManagerUrl encodes content id in hash', () => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: {
				origin: 'https://app.eliteew.ru',
				pathname: '/',
			},
		});
		const url = buildContentManagerUrl('id/with space');
		expect(url).toBe(
			'https://app.eliteew.ru/#unified-content?contentId=id%2Fwith%20space'
		);
	});
});
