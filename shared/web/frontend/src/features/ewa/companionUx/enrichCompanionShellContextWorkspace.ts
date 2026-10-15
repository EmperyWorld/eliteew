/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Enrich companion ``shell_context`` with the in-window workspace (embedded document / surface mode)
 * so the LLM sees the editor the user is actually in — not only desktop DocEditor windows.
 *
 * Invariants:
 * - Never throws; returns input snapshot (or null) unchanged when there is nothing to add.
 * - Injects a synthetic high-z window row; does not mutate the original array in place.
 *
 * Related:
 * - buildEwaCompanionShellContext.ts
 * - EWA-UNIFIED-WORKSPACE-JOURNEY-2026-07-09.md
 */

import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';
import {
	type EwaCompanionShellContextV1,
	sanitizeWindowTitleForCompanion,
} from '@/pages/Desktop/utils/buildEwaCompanionShellContext';

export type CompanionWorkspaceShellHint = {
	outputSurface: CompanionOutputSurfaceState;
};

const EMBEDDED_WINDOW_ID = 'companion-embedded-workspace';

function readPayloadString(
	payload: Record<string, unknown> | undefined,
	key: string
): string | undefined {
	const raw = payload?.[key];
	if (typeof raw !== 'string') return undefined;
	const t = raw.trim();
	return t.length > 0 ? t : undefined;
}

export function enrichCompanionShellContextWithWorkspace(
	snap: EwaCompanionShellContextV1 | null,
	hint: CompanionWorkspaceShellHint | null | undefined
): EwaCompanionShellContextV1 | null {
	if (!snap || !hint) return snap;
	const mode = hint.outputSurface.mode;
	if (mode === 'chat') return snap;

	const payload = hint.outputSurface.payload;
	const unifiedContentId = readPayloadString(payload, 'unifiedContentId');
	const title =
		readPayloadString(payload, 'title') ??
		(mode === 'document_editor'
			? 'Companion document'
			: mode.replaceAll('_', ' '));

	const appComponent =
		mode === 'document_editor'
			? 'CompanionDocumentEditor'
			: mode === 'file_list'
				? 'CompanionFileList'
				: mode.startsWith('workflow')
					? 'CompanionWorkflow'
					: mode === 'music_xl_base_wizard'
						? 'CompanionMusicWizard'
						: 'CompanionSurface';

	const excerptParts: string[] = [`output_surface.mode=${mode}`];
	if (unifiedContentId)
		excerptParts.push(`unified_content_id=${unifiedContentId}`);

	const synthetic = {
		window_id: EMBEDDED_WINDOW_ID,
		app_component: appComponent,
		title: sanitizeWindowTitleForCompanion(title),
		z_index: 2_000_000,
		minimized: false,
		surface_excerpt: excerptParts.join('; ').slice(0, 3600),
	};

	const withoutDup = snap.windows.filter(
		(w) => w.window_id !== EMBEDDED_WINDOW_ID
	);
	return {
		...snap,
		active_window_id: snap.active_window_id ?? EMBEDDED_WINDOW_ID,
		windows: [synthetic, ...withoutDup].slice(0, 24),
	};
}

/**
 * Merge embedded companion document into ``documents_workspace`` items for ewa_hints-style consumers.
 */
export function mergeEmbeddedDocumentIntoDocumentsWorkspace(
	documentsWorkspace: Record<string, unknown> | null | undefined,
	outputSurface: CompanionOutputSurfaceState | null | undefined
): Record<string, unknown> | null {
	if (outputSurface?.mode !== 'document_editor') {
		return documentsWorkspace ?? null;
	}
	const uc = readPayloadString(outputSurface.payload, 'unifiedContentId');
	if (!uc) return documentsWorkspace ?? null;
	const title = readPayloadString(outputSurface.payload, 'title');
	const prevItems = Array.isArray(documentsWorkspace?.items)
		? [...(documentsWorkspace.items as Record<string, unknown>[])]
		: [];
	const already = prevItems.some(
		(row) =>
			typeof row === 'object' &&
			row !== null &&
			String((row as { doc_id?: unknown }).doc_id ?? '') === uc
	);
	if (!already) {
		prevItems.unshift({
			doc_id: uc,
			window_id: EMBEDDED_WINDOW_ID,
			app_component: 'CompanionDocumentEditor',
			source: 'companion_embedded',
			...(title ? { title } : {}),
		});
	}
	return {
		...(documentsWorkspace && typeof documentsWorkspace === 'object'
			? documentsWorkspace
			: {}),
		open_document_count: prevItems.length,
		items: prevItems,
		source:
			typeof documentsWorkspace?.source === 'string'
				? documentsWorkspace.source
				: 'companion_embedded_merge',
	};
}
