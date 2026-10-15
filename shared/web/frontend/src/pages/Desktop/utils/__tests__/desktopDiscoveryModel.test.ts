import { describe, expect, it } from 'vitest';
import type { RecentFile } from '../../types/desktop.types';
import type { DesktopExpansionDiscoveryState } from '../../types/desktopExpansion.types';
import {
	buildDesktopLibraryDiscoverySlices,
	buildQuickSearchRecentFilePool,
	dedupeRecentFilesById,
	getDesktopExpansionDiscoveryCounts,
	rankRecentFilesForQuery,
	scoreRecentFileForQuery,
} from '../desktopDiscoveryModel';

function rf(id: string, name = id, path = `#/c/${id}`): RecentFile {
	return {
		id,
		name,
		type: 'document',
		path,
		openedAt: new Date(),
	};
}

describe('desktopDiscoveryModel', () => {
	describe('buildDesktopLibraryDiscoverySlices', () => {
		it('merges documents and respects custom limits', () => {
			const s = buildDesktopLibraryDiscoverySlices({
				recentFiles: [rf('s1')],
				recentLibraryOpened: [rf('o1'), rf('o2')],
				recentLibraryAdded: [rf('a1'), rf('a2'), rf('a3')],
				recentLibraryGenerated: [],
				recentLibraryUploaded: [],
				recentLibraryProjects: [rf('p1', 'Proj')],
				limits: { recentDocuments: 2, projects: 1, added: 2 },
			});
			expect(s.recentDocumentsUnified.map((x) => x.id)).toEqual(['o1', 'o2']);
			expect(s.projects.map((x) => x.id)).toEqual(['p1']);
			expect(s.added.map((x) => x.id)).toEqual(['a1', 'a2']);
			expect(s.hasAnyLibraryRows).toBe(true);
		});

		it('hasAnyLibraryRows is false when all slices empty', () => {
			const s = buildDesktopLibraryDiscoverySlices({
				recentFiles: [],
				recentLibraryOpened: [],
				recentLibraryAdded: [],
				recentLibraryGenerated: [],
				recentLibraryUploaded: [],
				recentLibraryProjects: [],
			});
			expect(s.hasAnyLibraryRows).toBe(false);
		});
	});

	describe('getDesktopExpansionDiscoveryCounts', () => {
		it('returns zeros without expansion', () => {
			expect(getDesktopExpansionDiscoveryCounts(undefined)).toEqual({
				workspaceProfilesCount: 0,
				appCollectionsCount: 0,
				contentShortcutsCount: 0,
				assistantActionsEnabledCount: 0,
			});
		});

		it('counts enabled assistant actions only', () => {
			const expansion: DesktopExpansionDiscoveryState = {
				workspaceProfiles: [
					{ id: '1', name: 'a', appIds: [], folderItemIds: [], widgetIds: [] },
				],
				windowLayoutPresets: [],
				widgetsLayout: {
					slots: [],
					perWorkspace: false,
				},
				appCollections: [{ id: 'c1', name: 'c', appIds: [] }],
				contentShortcuts: [],
				assistantContextActions: [
					{
						id: 'x',
						label: 'X',
						source: 'context-menu',
						assistantTarget: 'assistant',
						enabled: true,
					},
					{
						id: 'y',
						label: 'Y',
						source: 'selection',
						assistantTarget: 'gaf',
						enabled: false,
					},
				],
				visualStylePresets: [],
			};
			const c = getDesktopExpansionDiscoveryCounts(expansion);
			expect(c.workspaceProfilesCount).toBe(1);
			expect(c.appCollectionsCount).toBe(1);
			expect(c.contentShortcutsCount).toBe(0);
			expect(c.assistantActionsEnabledCount).toBe(1);
		});
	});

	describe('dedupeRecentFilesById', () => {
		it('keeps first occurrence', () => {
			const a = rf('1', 'first');
			const b = rf('1', 'second');
			expect(dedupeRecentFilesById([a, b]).map((x) => x.name)).toEqual([
				'first',
			]);
		});
	});

	describe('buildQuickSearchRecentFilePool', () => {
		it('dedupes across MRU and library slices in priority order', () => {
			const pool = buildQuickSearchRecentFilePool({
				recentFiles: [rf('a', 'A')],
				recentLibraryOpened: [rf('b', 'B')],
				recentLibraryGenerated: [rf('a', 'dupOpen')],
				recentLibraryUploaded: [rf('u')],
				recentLibraryAdded: [rf('add')],
				recentLibraryProjects: [rf('p')],
			});
			expect(pool.map((x) => x.id)).toEqual(['a', 'b', 'u', 'add', 'p']);
		});
	});

	describe('scoreRecentFileForQuery / rankRecentFilesForQuery', () => {
		it('scores empty query as 0', () => {
			expect(scoreRecentFileForQuery(rf('1', 'Hello'), '')).toBe(0);
		});

		it('prefers exact name match', () => {
			const exact = rf('1', 'report');
			const partial = rf('2', 'my-report-draft');
			expect(scoreRecentFileForQuery(exact, 'report')).toBeGreaterThan(
				scoreRecentFileForQuery(partial, 'report')
			);
		});

		it('rankRecentFilesForQuery returns empty for blank query', () => {
			expect(rankRecentFilesForQuery([rf('1', 'x')], '  ', 5)).toEqual([]);
		});

		it('rankRecentFilesForQuery dedupes and respects limit', () => {
			const pool = [
				rf('1', 'alpha-beta'),
				rf('2', 'beta-gamma'),
				rf('1', 'dup-id'),
				rf('3', 'zzz'),
			];
			const r = rankRecentFilesForQuery(pool, 'beta', 2);
			expect(r.length).toBeLessThanOrEqual(2);
			expect(r.every((f) => f.name.toLowerCase().includes('beta'))).toBe(true);
			const ids = r.map((x) => x.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});
});
