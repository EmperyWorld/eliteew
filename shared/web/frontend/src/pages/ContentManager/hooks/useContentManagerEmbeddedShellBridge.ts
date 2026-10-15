/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Embedded desktop shell bridges: companion listing plaintext and assistant surface context payloads.
 *
 * Invariants:
 * - companionListingPlain is debounced and truncated; not persisted in shell snapshot.
 *
 * Related:
 * - ContentManagerPro.tsx, buildEwaCompanionShellContext.ts
 */
import { useEffect } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { WindowInitialPayload } from '../../Desktop/types/desktop.types';
import type {
	ContentManagerTab,
	FilesBrowseMode,
} from '../contentManagerTypes';
import { contentManagerDisplayLabel } from '../utils/contentManagerTextLike';

export type UseContentManagerEmbeddedShellBridgeParams = {
	embedded: boolean;
	onWindowPayloadChange?: (patch: Partial<WindowInitialPayload>) => void;
	activeTab: ContentManagerTab;
	filesBrowseMode: FilesBrowseMode;
	explorerContextPlaceLabel: string;
	searchQuery: string;
	hasActiveListFilters: boolean;
	items: ContentItem[];
	selectedIds: Set<string>;
	selectedContent: ContentItem | null;
	t: TFunction<'contentManager'>;
};

export function useContentManagerEmbeddedShellBridge({
	embedded,
	onWindowPayloadChange,
	activeTab,
	filesBrowseMode,
	explorerContextPlaceLabel,
	searchQuery,
	hasActiveListFilters,
	items,
	selectedIds,
	selectedContent,
	t,
}: UseContentManagerEmbeddedShellBridgeParams) {
	useEffect(() => {
		if (!embedded || !onWindowPayloadChange) return;

		const tid = window.setTimeout(() => {
			if (activeTab !== 'files') {
				onWindowPayloadChange({
					companionListingPlain: `[Content Manager] tab=${activeTab} (no file list snapshot for companion)`,
				});
				return;
			}

			const place =
				filesBrowseMode === 'explorer'
					? `explorer · ${explorerContextPlaceLabel}`
					: filesBrowseMode === 'all_files'
						? 'all files'
						: 'catalog';

			const lines: string[] = [`[Content Manager] ${place}`];
			const q = searchQuery.trim();
			if (q) lines.push(`search: ${q.slice(0, 160)}`);
			if (hasActiveListFilters && !q)
				lines.push('(list filters active — see host UI)');

			const slice = items.slice(0, 55);
			if (slice.length === 0) {
				lines.push('Listed: 0');
			} else {
				lines.push(
					`Listed: ${slice.length}${items.length > slice.length ? ` (first of ${items.length} loaded)` : ` (${items.length} loaded)`}`
				);
				for (const it of slice) {
					const nm = String(contentManagerDisplayLabel(it) ?? '')
						.replace(/\s+/g, ' ')
						.trim()
						.slice(0, 220);
					if (!nm) continue;
					const ct = String(it.content_type ?? '')
						.trim()
						.slice(0, 40);
					const cid = String(it.id ?? '')
						.trim()
						.slice(0, 128);
					lines.push(
						`- ${nm}${ct ? ` [${ct}]` : ''}${cid ? ` uc=${cid}` : ''}`
					);
				}
			}

			onWindowPayloadChange({
				companionListingPlain: lines.join('\n').slice(0, 3600),
			});
		}, 850);

		return () => window.clearTimeout(tid);
	}, [
		activeTab,
		embedded,
		explorerContextPlaceLabel,
		filesBrowseMode,
		hasActiveListFilters,
		items,
		onWindowPayloadChange,
		searchQuery,
	]);

	useEffect(() => {
		if (!embedded || !onWindowPayloadChange) return;

		const idList = Array.from(selectedIds).filter(
			(x): x is string => typeof x === 'string' && x.length > 0
		);

		const browseDetail =
			activeTab === 'files'
				? filesBrowseMode === 'explorer'
					? explorerContextPlaceLabel
					: filesBrowseMode === 'all_files'
						? t('files.allFiles.allFiles')
						: t('tabs.files')
				: t(`tabs.${activeTab}`);

		if (idList.length > 1) {
			const firstItem = items.find((i) => i.id === idList[0]) ?? null;
			const baseLabel = firstItem
				? contentManagerDisplayLabel(firstItem)
				: idList[0];
			onWindowPayloadChange({
				assistantSurfaceContext: {
					label: `${baseLabel} · +${idList.length - 1}`,
					detail: browseDetail,
					unifiedContentIds: idList,
				},
			});
			return;
		}

		if (selectedContent) {
			onWindowPayloadChange({
				assistantSurfaceContext: {
					label: contentManagerDisplayLabel(selectedContent),
					detail: browseDetail,
					unifiedContentIds: [selectedContent.id],
				},
			});
			return;
		}

		onWindowPayloadChange({
			assistantSurfaceContext: {
				label: t('files.appTitle'),
				detail: browseDetail,
			},
		});
	}, [
		embedded,
		onWindowPayloadChange,
		selectedContent,
		selectedIds,
		items,
		activeTab,
		filesBrowseMode,
		explorerContextPlaceLabel,
		t,
	]);
}
