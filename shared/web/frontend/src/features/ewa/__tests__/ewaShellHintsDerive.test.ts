/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for deriving **`ewa_hints`** from persisted desktop windows (DocEditor / Content Manager).
 *
 * Invariants:
 * - Uses the same tab normalization as DocEditor payloads (`normalizeDocEditorTabsAndActive`).
 *
 * Related:
 * - `src/features/ewa/ewaShellHintsDerive.ts`
 * - `shared/api/ewa_platform/adapters/eliteew_shell_domain_hints_http.py`
 */
import type { PersistedWindowState } from '@/pages/Desktop/types/desktop.types';
import { describe, expect, it } from 'vitest';
import {
	buildEwaShellHintsSubtreeFromPersistedWindows,
	EWA_SHELL_HINTS_AUTO_SOURCE,
	mergeEwaShellHintsForPersistedWindows,
} from '../ewaShellHintsDerive';

function baseWin(
	overrides: Partial<PersistedWindowState>
): PersistedWindowState {
	return {
		type: 'app',
		path: [],
		title: 'Win',
		position: { x: 0, y: 0 },
		size: { width: 100, height: 100 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 1,
		...overrides,
	};
}

describe('ewaShellHintsDerive', () => {
	it('builds documents_workspace from DocEditor tabs and window_id', () => {
		const windows: PersistedWindowState[] = [
			baseWin({
				appComponent: 'DocEditor',
				path: ['vd0', 'w1'],
				initialPayload: {
					docEditorTabs: [
						{ source: 'docEditor', id: 'doc-a', title: 'A' },
						{ source: 'unifiedContent', id: 'uc-1' },
					],
					activeDocEditorTab: { source: 'docEditor', id: 'doc-a' },
				},
			}),
		];
		const out = buildEwaShellHintsSubtreeFromPersistedWindows(windows);
		expect(out.documents_workspace?.source).toBe(EWA_SHELL_HINTS_AUTO_SOURCE);
		expect(out.documents_workspace?.open_document_count).toBe(2);
		const items = out.documents_workspace?.items as Record<string, unknown>[];
		expect(items).toHaveLength(2);
		expect(items[0].doc_id).toBe('doc-a');
		expect(items[0].window_id).toBe('vd0/w1');
		expect(items[0].title).toBe('A');
		expect(items[1].doc_id).toBe('uc-1');
	});

	it('adds content_manager roots from ContentManagerPro project ids', () => {
		const windows: PersistedWindowState[] = [
			baseWin({
				appComponent: 'ContentManagerPro',
				initialPayload: { contentManagerProjectId: 'proj-7' },
			}),
		];
		const out = buildEwaShellHintsSubtreeFromPersistedWindows(windows);
		expect(out.content_manager?.roots).toEqual(['proj-7']);
		expect(out.content_manager?.source).toBe(EWA_SHELL_HINTS_AUTO_SOURCE);
	});

	it('merge drops auto content_manager when no CM windows but keeps manual content_manager', () => {
		const windows: PersistedWindowState[] = [
			baseWin({
				appComponent: 'DocEditor',
				initialPayload: { documentId: 'd1' },
			}),
		];
		const prev = {
			content_manager: {
				roots: ['old'],
				source: 'shell_state_explicit',
			},
		};
		const merged = mergeEwaShellHintsForPersistedWindows(windows, prev);
		expect(merged.content_manager).toEqual(prev.content_manager);
	});

	it('merge removes auto content_manager when CM window closed', () => {
		const windows: PersistedWindowState[] = [
			baseWin({ appComponent: 'EwaApp', title: 'EWA' }),
		];
		const prev = {
			content_manager: { roots: ['p1'], source: EWA_SHELL_HINTS_AUTO_SOURCE },
		};
		const merged = mergeEwaShellHintsForPersistedWindows(windows, prev);
		expect(merged.content_manager).toBeUndefined();
	});
});
