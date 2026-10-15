/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derive persisted **`shell_state.ewa_hints`** from the same **`windows_snapshot.windows`** the desktop persists, so EWA
 * read-only domain hints (`documents` / `content`) stay aligned with DocEditor tabs and Content Manager projects without
 * manual operator PATCH.
 *
 * Invariants:
 * - **`documents_workspace`** is always overwritten from open **`DocEditor`** windows (source **`desktop_windows_auto`**).
 * - **`content_manager`** roots are auto-synced only when at least one **`ContentManagerPro`** window carries
 *   **`contentManagerProjectId`**; a prior auto subtree is removed when CM projects disappear. Non-auto `content_manager`
 *   objects (other `source` or unset) are preserved from the last shell-state merge.
 *
 * Related:
 * - `src/pages/Desktop/hooks/useDesktopShellWindowPersistence.ts`
 * - `shared/api/ewa_platform/adapters/eliteew_shell_domain_hints_http.py`
 * - `src/features/ewa/ewaShellHints.ts`
 */
import type { PersistedWindowState } from '@/pages/Desktop/types/desktop.types';
import { normalizeDocEditorTabsAndActive } from '@/pages/Desktop/utils/desktopOpenPayloads';
import { windowRefFromPersistedWindow } from '@/features/ewa/amkaShellObservations';
import type { EwaShellHintsSubtreeV1 } from '@/features/ewa/ewaShellHints';

export const EWA_SHELL_HINTS_AUTO_SOURCE = 'desktop_windows_auto' as const;

function trimTitle(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined;
	const t = raw.trim();
	return t.length > 0 ? t.slice(0, 500) : undefined;
}

/**
 * Build `ewa_hints` subtrees from persisted window rows (already sanitized for shell persistence).
 */
export function buildEwaShellHintsSubtreeFromPersistedWindows(
	windows: PersistedWindowState[]
): EwaShellHintsSubtreeV1 {
	const docItems: Record<string, unknown>[] = [];
	const contentRootsOrdered: string[] = [];
	const contentSeen = new Set<string>();

	for (let idx = 0; idx < windows.length; idx++) {
		const w = windows[idx];
		if (w.type !== 'app') continue;
		const ac = w.appComponent?.trim();
		if (!ac) continue;

		if (ac === 'DocEditor') {
			const wid = windowRefFromPersistedWindow(w, idx);
			const { tabs } = normalizeDocEditorTabsAndActive(w.initialPayload);
			const tabTitles = w.initialPayload?.tabTitles;
			for (const tab of tabs) {
				const fromTab = trimTitle(tab.title);
				const fromMap =
					tab.source === 'unifiedContent'
						? (trimTitle(tabTitles?.[`uc:${tab.id}`]) ??
							trimTitle(tabTitles?.[tab.id]))
						: trimTitle(tabTitles?.[tab.id]);
				const title = fromTab ?? fromMap ?? trimTitle(w.title);
				docItems.push({
					doc_id: tab.id,
					window_id: wid,
					app_component: 'DocEditor',
					...(title ? { title } : {}),
				});
			}
		} else if (ac === 'ContentManagerPro') {
			const pid = w.initialPayload?.contentManagerProjectId?.trim();
			if (pid && !contentSeen.has(pid)) {
				contentSeen.add(pid);
				contentRootsOrdered.push(pid);
			}
		}
	}

	const out: EwaShellHintsSubtreeV1 = {
		documents_workspace: {
			open_document_count: docItems.length,
			items: docItems,
			source: EWA_SHELL_HINTS_AUTO_SOURCE,
		},
	};
	if (contentRootsOrdered.length > 0) {
		out.content_manager = {
			roots: contentRootsOrdered,
			source: EWA_SHELL_HINTS_AUTO_SOURCE,
		};
	}
	return out;
}

function isAutoContentManagerHint(cm: unknown): boolean {
	return (
		typeof cm === 'object' &&
		cm !== null &&
		!Array.isArray(cm) &&
		(cm as { source?: unknown }).source === EWA_SHELL_HINTS_AUTO_SOURCE
	);
}

/**
 * Merge auto-derived hints into the previous `ewa_hints` root from the last known shell-state (client cache), so we
 * replace the whole top-level `ewa_hints` on PATCH without dropping unrelated keys or manual content hints.
 */
export function mergeEwaShellHintsForPersistedWindows(
	windows: PersistedWindowState[],
	previousEwaHintsRoot: Record<string, unknown> | null | undefined
): EwaShellHintsSubtreeV1 {
	const auto = buildEwaShellHintsSubtreeFromPersistedWindows(windows);
	const prev =
		previousEwaHintsRoot &&
		typeof previousEwaHintsRoot === 'object' &&
		!Array.isArray(previousEwaHintsRoot)
			? { ...previousEwaHintsRoot }
			: {};

	const out: Record<string, unknown> = prev;
	out.documents_workspace = auto.documents_workspace;
	if (auto.content_manager) {
		out.content_manager = auto.content_manager;
	} else if (isAutoContentManagerHint(prev.content_manager)) {
		delete out.content_manager;
	}
	return out as EwaShellHintsSubtreeV1;
}
