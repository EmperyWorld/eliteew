/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Desktop open payload builders, merge semantics, and restored-window filters.
 *
 * Invariants:
 * - Payload helpers copy only documented keys from deep-link details.
 * - Professional Worlds draft keys remain opaque sessionStorage pointers for destination apps.
 *
 * Related:
 * - ../desktopOpenPayloads.ts
 */

import { describe, expect, it } from 'vitest';
import {
	buildContentManagerOpenPayload,
	buildDocEditorOpenPayload,
	buildDocEditorV2OpenPayload,
	buildEwrpOpenPayload,
	buildEwrpJobOpenPayload,
	buildDesktopAiChatOpenPayload,
	buildGafChatOpenPayload,
	buildProfessionalWorldsDraftOpenPayload,
	buildSocialHubOpenPayload,
	canResolveInstalledDesktopApps,
	filterRestoredWindows,
	findVoiceCommandLauncherItem,
	getDocEditorDocumentKey,
	getDocEditorDocumentKeysFromPayload,
	maskDocEditorWindowTitle,
	mergeDocEditorPayload,
	resolveDocEditorMaskedWindowTitle,
	resolveDocEditorOpenTarget,
	resolveDocEditorPayloadTarget,
	windowPayloadContainsDocEditorTarget,
} from '../desktopOpenPayloads';
import type { DesktopItem } from '../../types/desktop.types';

describe('desktopOpenPayloads', () => {
	describe('buildGafChatOpenPayload', () => {
		it('returns undefined when detail is empty', () => {
			expect(buildGafChatOpenPayload(undefined)).toBeUndefined();
			expect(buildGafChatOpenPayload(null)).toBeUndefined();
			expect(
				buildGafChatOpenPayload({ appComponent: 'GAFChatApp' })
			).toBeUndefined();
		});

		it('copies only target username and chat id', () => {
			expect(
				buildGafChatOpenPayload({
					appComponent: 'GAFChatApp',
					targetUsername: '  alice  ',
					targetChatId: 'chat-1',
				})
			).toEqual({ targetUsername: 'alice', targetChatId: 'chat-1' });
		});
	});

	describe('buildDesktopAiChatOpenPayload', () => {
		it('returns undefined without desktopAiChatId', () => {
			expect(buildDesktopAiChatOpenPayload(undefined)).toBeUndefined();
			expect(
				buildDesktopAiChatOpenPayload({ appComponent: 'DesktopAiChatApp' })
			).toBeUndefined();
		});

		it('copies trimmed desktopAiChatId only', () => {
			expect(
				buildDesktopAiChatOpenPayload({
					appComponent: 'DesktopAiChatApp',
					desktopAiChatId: '  chat-9  ',
					targetChatId: 'drop-me',
				})
			).toEqual({ desktopAiChatId: 'chat-9' });
		});
	});

	describe('buildSocialHubOpenPayload', () => {
		it('copies typed tab and friend focus keys', () => {
			expect(
				buildSocialHubOpenPayload({
					appComponent: 'SocialHubApp',
					socialHubTab: 'inbox',
					socialHubFriendUserId: '  user-9  ',
					targetUsername: 'drop-me',
				})
			).toEqual({
				socialHubTab: 'inbox',
				socialHubFriendUserId: 'user-9',
			});
		});

		it('accepts section-aware Social Hub tabs and legacy profile tab', () => {
			expect(
				buildSocialHubOpenPayload({
					appComponent: 'SocialHubApp',
					socialHubTab: 'circles',
				})
			).toEqual({ socialHubTab: 'circles' });
			expect(
				buildSocialHubOpenPayload({
					appComponent: 'SocialHubApp',
					socialHubTab: 'privacy',
				})
			).toEqual({ socialHubTab: 'privacy' });
			expect(
				buildSocialHubOpenPayload({
					appComponent: 'SocialHubApp',
					socialHubTab: 'profile',
				})
			).toEqual({ socialHubTab: 'profile' });
		});

		it('drops unsupported tabs and empty friend ids', () => {
			expect(
				buildSocialHubOpenPayload({
					appComponent: 'SocialHubApp',
					socialHubTab: 'bad-tab' as never,
					socialHubFriendUserId: '   ',
				})
			).toBeUndefined();
		});
	});

	describe('buildEwrpOpenPayload', () => {
		it('returns undefined without cross-app draft key', () => {
			expect(buildEwrpOpenPayload({ appComponent: 'EWRP' })).toBeUndefined();
		});

		it('copies professionalWorldsCrossAppDraftKey', () => {
			expect(
				buildEwrpOpenPayload({
					appComponent: 'EWRP',
					professionalWorldsCrossAppDraftKey:
						'eliteew.professionalWorlds.crossAppDraft.v1.ewrp.abc',
				})
			).toEqual({
				professionalWorldsCrossAppDraftKey:
					'eliteew.professionalWorlds.crossAppDraft.v1.ewrp.abc',
			});
		});
	});

	describe('buildEwrpJobOpenPayload', () => {
		it('copies ewrpJobId for EWRP desktop opens', () => {
			expect(
				buildEwrpJobOpenPayload({
					appComponent: 'EWRP',
					ewrpJobId: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
				})
			).toEqual({
				ewrpJobId: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
			});
		});

		it('returns undefined without job id', () => {
			expect(buildEwrpJobOpenPayload({ appComponent: 'EWRP' })).toBeUndefined();
		});
	});

	describe('buildProfessionalWorldsDraftOpenPayload', () => {
		it('copies Professional Worlds draft keys for supported destination apps', () => {
			expect(
				buildProfessionalWorldsDraftOpenPayload({
					appComponent: 'GAFChatApp',
					professionalWorldsCrossAppDraftKey:
						'  eliteew.professionalWorlds.crossAppDraft.v1.gaf.abc  ',
				})
			).toEqual({
				professionalWorldsCrossAppDraftKey:
					'eliteew.professionalWorlds.crossAppDraft.v1.gaf.abc',
			});
		});

		it('drops draft keys for apps that do not consume handoff capsules', () => {
			expect(
				buildProfessionalWorldsDraftOpenPayload({
					appComponent: 'ContentManagerPro',
					professionalWorldsCrossAppDraftKey:
						'eliteew.professionalWorlds.crossAppDraft.v1.content.abc',
				})
			).toBeUndefined();
		});
	});

	describe('buildContentManagerOpenPayload', () => {
		it('returns undefined when no cabinet keys', () => {
			expect(
				buildContentManagerOpenPayload({
					appComponent: 'ContentManagerPro',
				})
			).toBeUndefined();
		});

		it('copies cabinet fields when present', () => {
			expect(
				buildContentManagerOpenPayload({
					appComponent: 'ContentManagerPro',
					contentManagerProjectId: 'p1',
					contentManagerCompanyId: 'c1',
					contentManagerProjectName: 'Name',
					contentManagerCabinetView: true,
				})
			).toEqual({
				contentManagerProjectId: 'p1',
				contentManagerCompanyId: 'c1',
				contentManagerProjectName: 'Name',
				contentManagerCabinetView: true,
			});
		});

		it('copies normalized filter snapshot when present', () => {
			expect(
				buildContentManagerOpenPayload({
					appComponent: 'ContentManagerPro',
					contentManagerInitialFilter: {
						searchQuery: '  reports  ',
						filterVisibility: 'shared',
						unknownKey: 'drop-me',
					},
				})
			).toEqual({
				contentManagerInitialFilter: {
					searchQuery: 'reports',
					filterVisibility: 'shared',
				},
			});
		});

		it('copies focus unified content id and assign-project flag', () => {
			expect(
				buildContentManagerOpenPayload({
					appComponent: 'ContentManagerPro',
					contentManagerFocusUnifiedContentId: '  uc-9  ',
					contentManagerOpenAssignProject: true,
				})
			).toEqual({
				contentManagerFocusUnifiedContentId: 'uc-9',
				contentManagerOpenAssignProject: true,
			});
		});
	});

	describe('DocEditor payload contract', () => {
		it('prefers unifiedContent target when both ids are passed', () => {
			expect(
				resolveDocEditorOpenTarget({
					appComponent: 'DocEditor',
					documentId: 'legacy-doc',
					unifiedContentId: '  uc-1  ',
					forceNewWindow: true,
					openCollabPanel: true,
				})
			).toEqual({
				targetType: 'unifiedContent',
				id: 'uc-1',
				forceNewWindow: true,
				openCollabPanel: true,
			});
		});

		it('merges existing doc tabs and de-duplicates ids', () => {
			const next = mergeDocEditorPayload(
				{
					documentId: 'doc-1',
					documentIds: ['doc-1', 'doc-2'],
					activeDocumentId: 'doc-2',
				},
				{ targetType: 'docEditor', id: 'doc-2' }
			);
			expect(next).toMatchObject({
				documentId: 'doc-2',
				documentIds: ['doc-1', 'doc-2'],
				activeDocumentId: 'doc-2',
			});
		});

		it('switching to unified content resets legacy doc keys', () => {
			const next = mergeDocEditorPayload(
				{
					documentId: 'doc-1',
					documentIds: ['doc-1'],
					activeDocumentId: 'doc-1',
					tabTitles: { 'doc-1': 'Doc 1' },
				},
				{ targetType: 'unifiedContent', id: 'uc-9' }
			);
			expect(next).toMatchObject({
				documentId: undefined,
				documentIds: ['doc-1'],
				activeDocumentId: undefined,
				tabTitles: { 'doc-1': 'Doc 1' },
				unifiedContentId: 'uc-9',
				activeDocEditorTab: { source: 'unifiedContent', id: 'uc-9' },
			});
		});

		it('resolves payload target from either unifiedContentId or activeDocumentId', () => {
			expect(
				resolveDocEditorPayloadTarget({
					activeDocEditorTab: { source: 'unifiedContent', id: 'uc-active' },
					unifiedContentId: 'uc-5',
					documentId: 'doc-1',
				})
			).toEqual({ targetType: 'unifiedContent', id: 'uc-active' });
			expect(
				resolveDocEditorPayloadTarget({
					documentId: 'doc-1',
					activeDocumentId: 'doc-2',
				})
			).toEqual({ targetType: 'docEditor', id: 'doc-2' });
		});

		it('builds normalized initial payload for doc target', () => {
			expect(
				buildDocEditorOpenPayload({ targetType: 'docEditor', id: 'doc-a' })
			).toEqual({
				docEditorTabs: [{ source: 'docEditor', id: 'doc-a' }],
				activeDocEditorTab: { source: 'docEditor', id: 'doc-a' },
				documentId: 'doc-a',
				documentIds: ['doc-a'],
				activeDocumentId: 'doc-a',
			});
		});

		it('builds DocEditorV2 payload with unified content id and title', () => {
			expect(
				buildDocEditorV2OpenPayload({
					appComponent: 'DocEditorV2',
					unifiedContentId: ' uc-55 ',
					docEditorTitle: ' Notes ',
				})
			).toEqual({
				unifiedContentId: 'uc-55',
				docEditorTitle: 'Notes',
			});
		});

		it('keeps doc tabs when appending unified target', () => {
			const next = mergeDocEditorPayload(
				{
					docEditorTabs: [{ source: 'docEditor', id: 'doc-1' }],
					activeDocEditorTab: { source: 'docEditor', id: 'doc-1' },
					documentId: 'doc-1',
					documentIds: ['doc-1'],
					activeDocumentId: 'doc-1',
				},
				{ targetType: 'unifiedContent', id: 'uc-1' }
			);
			expect(next.docEditorTabs).toEqual([
				{ source: 'docEditor', id: 'doc-1' },
				{ source: 'unifiedContent', id: 'uc-1' },
			]);
			expect(next.activeDocEditorTab).toEqual({
				source: 'unifiedContent',
				id: 'uc-1',
			});
			expect(next.documentIds).toEqual(['doc-1']);
			expect(next.unifiedContentId).toBe('uc-1');
		});

		it('keeps doc open request id across parse/build/resolve', () => {
			const target = resolveDocEditorOpenTarget({
				appComponent: 'DocEditor',
				documentId: 'doc-7',
				docOpenRequestId: 'req-7',
			});
			expect(target).toEqual({
				targetType: 'docEditor',
				id: 'doc-7',
				requestId: 'req-7',
			});
			if (!target) throw new Error('unreachable');
			const payload = buildDocEditorOpenPayload(target);
			expect(payload.docOpenRequestId).toBe('req-7');
			expect(resolveDocEditorPayloadTarget(payload)).toEqual({
				targetType: 'docEditor',
				id: 'doc-7',
				requestId: 'req-7',
			});
		});

		it('builds stable document keys and finds duplicates across tabs', () => {
			const payload = {
				docEditorTabs: [
					{ source: 'docEditor' as const, id: 'doc-1' },
					{ source: 'unifiedContent' as const, id: 'uc-2' },
				],
				activeDocEditorTab: { source: 'docEditor' as const, id: 'doc-1' },
			};
			const keys = getDocEditorDocumentKeysFromPayload(payload);
			expect(keys).toEqual(new Set(['docEditor:doc-1', 'unifiedContent:uc-2']));
			expect(
				windowPayloadContainsDocEditorTarget(payload, {
					targetType: 'unifiedContent',
					id: 'uc-2',
				})
			).toBe(true);
			expect(getDocEditorDocumentKey('docEditor', 'doc-1')).toBe(
				'docEditor:doc-1'
			);
		});

		it('masks DocEditor title by first3***last3', () => {
			expect(maskDocEditorWindowTitle('quarterly-report.docx')).toBe(
				'qua***ocx'
			);
			expect(
				resolveDocEditorMaskedWindowTitle(
					{
						docEditorTabs: [{ source: 'docEditor', id: 'doc-1' }],
						activeDocEditorTab: { source: 'docEditor', id: 'doc-1' },
						tabTitles: { 'doc-1': 'plan-final-v3.md' },
					},
					'Document Editor'
				)
			).toBe('pla***.md');
		});
	});

	describe('filterRestoredWindows', () => {
		it('returns empty when no windows', () => {
			expect(filterRestoredWindows(undefined, [])).toEqual([]);
			expect(filterRestoredWindows([], [])).toEqual([]);
		});

		it('drops legacy hidden desktop app components', () => {
			const out = filterRestoredWindows(
				[
					{
						type: 'app',
						title: 'x',
						path: [],
						position: { x: 0, y: 0 },
						size: { width: 100, height: 100 },
						isMinimized: false,
						isMaximized: false,
						zIndex: 1,
						appComponent: 'VoiceStudio',
					},
				],
				[]
			);
			expect(out).toHaveLength(0);
		});
	});

	describe('findVoiceCommandLauncherItem', () => {
		it('finds StudioGU in items first', () => {
			const items: DesktopItem[] = [
				{
					id: 'a',
					type: 'app',
					name: 'SGU',
					appComponent: 'StudioGU',
					position: { x: 0, y: 0 },
				},
			];
			expect(findVoiceCommandLauncherItem(items)?.id).toBe('a');
		});
	});

	describe('canResolveInstalledDesktopApps', () => {
		it('is true when stores apps resolved', () => {
			expect(canResolveInstalledDesktopApps(false, [])).toBe(true);
		});

		it('is false while loading', () => {
			expect(canResolveInstalledDesktopApps(true, [])).toBe(false);
		});

		it('is false when storeApps is not an array', () => {
			expect(canResolveInstalledDesktopApps(false, {})).toBe(false);
		});
	});
});
