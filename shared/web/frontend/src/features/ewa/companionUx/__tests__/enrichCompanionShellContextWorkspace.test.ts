/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for shell_context workspace enrichment (Unified Workspace).
 */

import { describe, expect, it } from 'vitest';

import {
	enrichCompanionShellContextWithWorkspace,
	mergeEmbeddedDocumentIntoDocumentsWorkspace,
} from '@/features/ewa/companionUx/enrichCompanionShellContextWorkspace';
import { EWA_COMPANION_SHELL_SCHEMA_V1 } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';

describe('enrichCompanionShellContextWithWorkspace', () => {
	it('injects synthetic companion document row when surface is document_editor', () => {
		const snap = {
			schema_version: EWA_COMPANION_SHELL_SCHEMA_V1,
			active_desktop_id: 'd1',
			active_window_id: 'w1',
			windows: [
				{
					window_id: 'w1',
					app_component: 'EwaApp',
					title: 'Companion',
					z_index: 10,
					minimized: false,
				},
			],
		};
		const next = enrichCompanionShellContextWithWorkspace(snap, {
			outputSurface: {
				mode: 'document_editor',
				payload: { unifiedContentId: 'uc-1', title: 'Brief' },
			},
		});
		expect(next?.windows[0]?.app_component).toBe('CompanionDocumentEditor');
		expect(next?.windows[0]?.surface_excerpt).toContain('uc-1');
	});

	it('leaves chat mode unchanged', () => {
		const snap = {
			schema_version: EWA_COMPANION_SHELL_SCHEMA_V1,
			active_desktop_id: null,
			active_window_id: null,
			windows: [],
		};
		const next = enrichCompanionShellContextWithWorkspace(snap, {
			outputSurface: { mode: 'chat' },
		});
		expect(next?.windows).toHaveLength(0);
	});
});

describe('mergeEmbeddedDocumentIntoDocumentsWorkspace', () => {
	it('prepends embedded doc when missing', () => {
		const merged = mergeEmbeddedDocumentIntoDocumentsWorkspace(
			{ open_document_count: 0, items: [], source: 'desktop_windows_auto' },
			{
				mode: 'document_editor',
				payload: { unifiedContentId: 'uc-9', title: 'Note' },
			}
		);
		expect(merged?.open_document_count).toBe(1);
		const mergedItems = merged?.items as { doc_id: string }[] | undefined;
		expect(mergedItems?.[0]?.doc_id).toBe('uc-9');
	});
});
