/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Windowed picker for project content rows in Document Autofill / similar modals.
 *
 * Invariants:
 * - Uses MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD; below threshold renders plain stack.
 *
 * Related:
 * - DocumentAutofillAction.tsx, constants.ts (MARKETING_CONTENT_LIST_FETCH_LIMIT)
 */
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD } from '../constants';
import type { MarketingContentItem } from '../marketingCabinetApi';

export function MarketingCabinetContentPickList({
	items,
	selectedContentId,
	onSelectContentId,
	total,
}: {
	items: MarketingContentItem[];
	selectedContentId: string | null;
	onSelectContentId: (contentId: string) => void;
	total?: number;
}) {
	const { t } = useTranslation('marketing');
	const contentTotal = total ?? items.length;
	const contentTruncated = contentTotal > items.length;

	const renderRow = (item: MarketingContentItem) => {
		const active = item.id === selectedContentId;
		return (
			<button
				type="button"
				onClick={() => onSelectContentId(item.id)}
				className={cn(
					'w-full rounded-(--desktop-radius) border p-3 text-left transition-colors',
					active
						? 'border-(--mc-accent-45) bg-(--desktop-surface-accent)'
						: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
				)}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
							{item.name || t('documentAutofill.untitledDocument')}
						</div>
						<div className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
							{item.content_type || t('aiStudioView.contentTypeDocument')} ·{' '}
							{item.processing_status || t('aiStudioView.processingUnknown')}
						</div>
					</div>
					<DocumentTextIcon
						className={cn('mt-0.5 h-4 w-4 shrink-0', DESKTOP_TYPOGRAPHY.meta)}
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</div>
				<div className="mt-2 line-clamp-3 text-xs leading-5 text-(--desktop-text-secondary)">
					{item.excerpt || item.description || t('documentAutofill.noExcerpt')}
				</div>
			</button>
		);
	};

	return (
		<div className="space-y-2">
			{contentTruncated ? (
				<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
					{t('cabinetPage.listFetchSummaryTruncated', {
						shown: items.length,
						total: contentTotal,
					})}
				</p>
			) : null}
			{items.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
				<VirtualVariableList
					items={items}
					estimateSize={() => 108}
					getItemKey={(index) => items[index]?.id ?? `content-pick-${index}`}
					height={360}
					overscanCount={6}
					className="rounded-(--desktop-radius)"
					renderItem={(item) => <div className="pb-2">{renderRow(item)}</div>}
				/>
			) : (
				items.map((item) => <div key={item.id}>{renderRow(item)}</div>)
			)}
		</div>
	);
}
