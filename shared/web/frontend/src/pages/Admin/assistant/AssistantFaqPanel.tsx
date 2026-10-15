/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ list, search, create form, and FAQ→preview bridge in assistant admin.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/useAssistantFaqAdmin.ts
 * - pages/Admin/assistant/EditFaq.tsx
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import type { AssistantFaqEntry } from '../../Desktop/services/productDesktopApi';
import { FaqHighlightText } from '../../Desktop/utils/assistantFaqHighlight';
import {
	faqAnswerMatchesQuery,
	faqAnswerSearchPreview,
} from '../../Desktop/utils/extractFaqSearchSnippet';
import { EditFaq } from './EditFaq';
import {
	ADMIN_FIELD,
	ADMIN_FIELD_SM,
	ADMIN_SOFT_BTN,
} from './assistantAdminStyles';

type AssistantFaqPanelProps = {
	items: AssistantFaqEntry[];
	filteredFaqItems: AssistantFaqEntry[];
	faqListSearch: string;
	setFaqListSearch: (v: string) => void;
	q: string;
	setQ: (v: string) => void;
	a: string;
	setA: (v: string) => void;
	sortOrder: number;
	setSortOrder: (v: number) => void;
	editing: AssistantFaqEntry | null;
	setEditing: (v: AssistantFaqEntry | null) => void;
	isLoading: boolean;
	onCreateFaq: () => void;
	isCreatePending: boolean;
	onUpdateFaq: (p: { id: string; patch: Partial<AssistantFaqEntry> }) => void;
	isUpdatePending: boolean;
	onFillPreviewFromFaq: (question: string) => void;
	onRequestDelete: (id: string) => void;
};

export function AssistantFaqPanel({
	items,
	filteredFaqItems,
	faqListSearch,
	setFaqListSearch,
	q,
	setQ,
	a,
	setA,
	sortOrder,
	setSortOrder,
	editing,
	setEditing,
	isLoading,
	onCreateFaq,
	isCreatePending,
	onUpdateFaq,
	isUpdatePending,
	onFillPreviewFromFaq,
	onRequestDelete,
}: AssistantFaqPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	return (
		<>
			<p className="text-sm text-white/55">{t('faqIntro')}</p>

			<div className="relative max-w-md">
				<input
					type="search"
					value={faqListSearch}
					onChange={(e) => setFaqListSearch(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							e.preventDefault();
							setFaqListSearch('');
						}
					}}
					placeholder={t('faqListSearchPlaceholder')}
					aria-label={t('faqListSearchPlaceholder')}
					className={cn('w-full', ADMIN_FIELD, faqListSearch ? 'pr-9' : '')}
				/>
				{faqListSearch ? (
					<button
						type="button"
						className={cn(
							'absolute right-2 top-1/2 -translate-y-1/2 rounded p-1',
							'text-white/50 hover:text-white/85 hover:bg-white/10',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45'
						)}
						onClick={() => setFaqListSearch('')}
						aria-label={t('faqListSearchClear')}
						title={t('faqListSearchClear')}
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
					</button>
				) : null}
			</div>
			{faqListSearch.trim() && items.length > 0 ? (
				<p className="text-xs text-white/50">
					{t('faqListSearchCount', {
						count: filteredFaqItems.length,
						total: items.length,
					})}
				</p>
			) : null}

			<div
				className={cn(
					'border border-white/10 bg-white/3 p-4 space-y-2 shadow-sm shadow-black/25',
					DESKTOP_SURFACE.radius
				)}
			>
				<div className={DESKTOP_TYPOGRAPHY.caption}>{t('newFaqCaption')}</div>
				<input
					type="text"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder={t('questionPlaceholder')}
					className={cn('w-full', ADMIN_FIELD)}
				/>
				<textarea
					value={a}
					onChange={(e) => setA(e.target.value)}
					placeholder={t('answerPlaceholder')}
					rows={3}
					className={cn('w-full', ADMIN_FIELD)}
				/>
				<label className="flex items-center gap-2 text-xs text-white/60">
					{t('sortOrderLabel')}
					<input
						type="number"
						value={sortOrder}
						onChange={(e) =>
							setSortOrder(Number.parseInt(e.target.value, 10) || 0)
						}
						className={cn('w-24', ADMIN_FIELD_SM)}
					/>
				</label>
				<button
					type="button"
					disabled={!q.trim() || !a.trim() || isCreatePending}
					onClick={onCreateFaq}
					className={cn(
						'px-4 py-2 text-sm text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45'
					)}
				>
					{isCreatePending ? (
						<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
					) : (
						t('addFaq')
					)}
				</button>
			</div>

			{isLoading && (
				<div
					className="flex items-center gap-2 text-sm text-white/55 py-2"
					aria-busy="true"
					aria-live="polite"
				>
					<ArrowPathIcon
						className="w-6 h-6 shrink-0 animate-spin text-white/50"
						aria-hidden
					/>
					<span>{t('listLoading')}</span>
				</div>
			)}

			<ul className="space-y-3">
				{filteredFaqItems.map((item) => (
					<li
						key={item.id}
						className={cn(
							'border border-white/10 p-4 shadow-sm shadow-black/15',
							'transition-[border-color,box-shadow] duration-200',
							'hover:border-white/18 hover:shadow-md hover:shadow-black/20',
							DESKTOP_SURFACE.radius
						)}
					>
						{editing?.id === item.id ? (
							<EditFaq
								entry={item}
								onCancel={() => setEditing(null)}
								onSave={(patch) => onUpdateFaq({ id: item.id, patch })}
								saving={isUpdatePending}
							/>
						) : (
							<>
								<div className="flex justify-between gap-2">
									<div className="font-medium text-white/90 min-w-0">
										{faqListSearch.trim() ? (
											<FaqHighlightText
												text={item.question}
												query={faqListSearch}
											/>
										) : (
											item.question
										)}
									</div>
									<div className="flex gap-2 shrink-0">
										<button
											type="button"
											className={cn(
												ADMIN_SOFT_BTN,
												'text-violet-300 hover:bg-white/10'
											)}
											onClick={() => onFillPreviewFromFaq(item.question)}
											title={t('previewUseQuestion')}
										>
											{t('previewUseQuestion')}
										</button>
										<button
											type="button"
											className={cn(
												ADMIN_SOFT_BTN,
												'text-white/70 hover:bg-white/10'
											)}
											onClick={() => setEditing(item)}
										>
											{t('edit')}
										</button>
										<button
											type="button"
											className={cn(
												'rounded-md p-2 text-rose-400/90 transition-colors',
												'hover:bg-rose-500/10',
												'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40'
											)}
											aria-label={t('deleteFaqAria')}
											onClick={() => onRequestDelete(item.id)}
										>
											<TrashIcon className="w-4 h-4" />
										</button>
									</div>
								</div>
								{faqListSearch.trim() &&
								faqAnswerMatchesQuery(item.answer, faqListSearch) &&
								!item.question
									.toLowerCase()
									.includes(faqListSearch.trim().toLowerCase()) ? (
									<p className="text-xs text-white/55 mt-1 italic">
										<FaqHighlightText
											text={faqAnswerSearchPreview(item.answer, faqListSearch)}
											query={faqListSearch}
										/>
									</p>
								) : null}
								<p className="text-sm text-white/70 whitespace-pre-wrap mt-2">
									{faqListSearch.trim() ? (
										<FaqHighlightText
											text={
												item.answer.length > 600
													? `${item.answer.slice(0, 600)}…`
													: item.answer
											}
											query={faqListSearch}
										/>
									) : (
										item.answer
									)}
								</p>
								<div className="text-xs text-white/40 mt-1">
									sort_order: {item.sort_order}
								</div>
							</>
						)}
					</li>
				))}
			</ul>
			{!isLoading && items.length > 0 && filteredFaqItems.length === 0 ? (
				<p className="text-sm text-white/50 py-2">{t('faqListSearchEmpty')}</p>
			) : null}
		</>
	);
}
