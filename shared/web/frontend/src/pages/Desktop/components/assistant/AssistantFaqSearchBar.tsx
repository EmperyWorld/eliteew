/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ panel search field, match count, and bulk expand/collapse controls (slice R04).
 *
 * Invariants:
 * - Parent owns search string and open card ids.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 */
import { cn } from '@/utils/cn';
import {
	ChevronDownIcon,
	ChevronUpIcon,
	MagnifyingGlassIcon,
	PencilSquareIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import {
	ASSISTANT_FAQ_INSERT_HINT_CLASS,
	ASSISTANT_FAQ_SEARCH_ACTION_CLASS,
	ASSISTANT_FAQ_SEARCH_ACTION_FLASH_CLASS,
	ASSISTANT_FAQ_SEARCH_ACTION_READY_CLASS,
	ASSISTANT_FAQ_SEARCH_COUNT_BADGE_CLASS,
	ASSISTANT_FAQ_SEARCH_COUNT_EMPTY_CLASS,
	ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_CLASS,
	ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_READY_CLASS,
	ASSISTANT_FAQ_SEARCH_FOCUS_FLASH_CLASS,
	ASSISTANT_FAQ_SEARCH_KBD_ACTIVE_CLASS,
	ASSISTANT_FAQ_SEARCH_MAGNIFY_FLASH_CLASS,
	ASSISTANT_FAQ_SEARCH_WRAP_CLASS,
	ASSISTANT_KBD_HINT_CLASS,
} from './assistantFaqPanelStyles';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';

export type AssistantFaqSearchBarProps = {
	faq: AssistantFaqEntry[];
	filteredFaq: AssistantFaqEntry[];
	faqSearch: string;
	onFaqSearchChange: (value: string) => void;
	faqSearchInputRef: RefObject<HTMLInputElement | null>;
	faqSearchFocused: boolean;
	onFaqSearchFocusedChange: (focused: boolean) => void;
	faqSearchFocusFlash: boolean;
	openFaqIds: Set<string>;
	onOpenFaqIdsChange: (
		updater: Set<string> | ((prev: Set<string>) => Set<string>)
	) => void;
	faqBulkActionFlash: 'expand' | 'collapse' | null;
	onFaqBulkActionFlash: (value: 'expand' | 'collapse' | null) => void;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantFaqSearchBar({
	faq,
	filteredFaq,
	faqSearch,
	onFaqSearchChange,
	faqSearchInputRef,
	faqSearchFocused,
	onFaqSearchFocusedChange,
	faqSearchFocusFlash,
	onOpenFaqIdsChange,
	faqBulkActionFlash,
	onFaqBulkActionFlash,
	t,
}: AssistantFaqSearchBarProps): React.ReactElement | null {
	if (faq.length === 0) return null;

	return (
		<>
			<div
				className={cn(
					ASSISTANT_FAQ_SEARCH_WRAP_CLASS,
					(faqSearchFocused || faqSearch.trim()) &&
						'shadow-[0_0_0_3px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
					faqSearchFocusFlash && ASSISTANT_FAQ_SEARCH_FOCUS_FLASH_CLASS
				)}
				data-assistant-guide="faq-search"
			>
				<MagnifyingGlassIcon
					className={cn(
						'pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2',
						faqSearch.trim() || faqSearchFocused
							? 'text-[rgb(var(--desktop-accent-rgb)/0.9)]'
							: 'text-(--desktop-text-dim)',
						faqSearchFocusFlash && ASSISTANT_FAQ_SEARCH_MAGNIFY_FLASH_CLASS
					)}
					aria-hidden
				/>
				<DesktopChromeTooltip
					content={t('faqSearchShortcut')}
					placement="bottom"
					offsetExtra={4}
				>
					<input
						ref={faqSearchInputRef}
						type="search"
						value={faqSearch}
						onChange={(e) => onFaqSearchChange(e.target.value)}
						onFocus={() => onFaqSearchFocusedChange(true)}
						onBlur={() => onFaqSearchFocusedChange(false)}
						onKeyDown={(e) => {
							if (e.key === 'Escape') {
								e.preventDefault();
								onFaqSearchChange('');
							}
						}}
						placeholder={t('faqSearchPlaceholder')}
						aria-label={t('faqSearchPlaceholder')}
						className={cn(
							'w-full rounded-lg py-1.5 pl-9',
							DESKTOP_TYPOGRAPHY.body,
							faqSearch ? 'pr-9' : 'pr-11',
							DESKTOP_APP_STYLE_CONTRACT.searchField,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					/>
				</DesktopChromeTooltip>
				{faqSearch ? (
					<AssistantDesktopTooltip content={t('faqSearchClear')}>
						<button
							type="button"
							className={cn(
								ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_CLASS,
								ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_READY_CLASS
							)}
							onClick={() => onFaqSearchChange('')}
							aria-label={t('faqSearchClear')}
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
						</button>
					</AssistantDesktopTooltip>
				) : (
					<kbd
						className={cn(
							ASSISTANT_KBD_HINT_CLASS,
							'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2',
							faqSearchFocused && ASSISTANT_FAQ_SEARCH_KBD_ACTIVE_CLASS
						)}
						aria-hidden
					>
						/
					</kbd>
				)}
			</div>
			{faqSearch.trim() ? (
				<>
					<p
						className={cn(
							ASSISTANT_FAQ_SEARCH_COUNT_BADGE_CLASS,
							filteredFaq.length === 0 && ASSISTANT_FAQ_SEARCH_COUNT_EMPTY_CLASS
						)}
					>
						<MagnifyingGlassIcon
							className="h-3.5 w-3.5 shrink-0 opacity-80"
							aria-hidden
						/>
						{t('faqSearchCount', {
							count: filteredFaq.length,
							total: faq.length,
						})}
					</p>
					{filteredFaq.length > 1 ? (
						<div className="-mt-0.5 mb-3 flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									ASSISTANT_FAQ_SEARCH_ACTION_CLASS,
									faqBulkActionFlash !== 'expand' &&
										ASSISTANT_FAQ_SEARCH_ACTION_READY_CLASS,
									faqBulkActionFlash === 'expand' &&
										ASSISTANT_FAQ_SEARCH_ACTION_FLASH_CLASS
								)}
								onClick={() => {
									onOpenFaqIdsChange(
										new Set(filteredFaq.map((item) => item.id))
									);
									onFaqBulkActionFlash('expand');
								}}
							>
								<ChevronDownIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
								{t('faqSearchExpandAll')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									ASSISTANT_FAQ_SEARCH_ACTION_CLASS,
									faqBulkActionFlash !== 'collapse' &&
										ASSISTANT_FAQ_SEARCH_ACTION_READY_CLASS,
									faqBulkActionFlash === 'collapse' &&
										ASSISTANT_FAQ_SEARCH_ACTION_FLASH_CLASS
								)}
								onClick={() => {
									onOpenFaqIdsChange(new Set());
									onFaqBulkActionFlash('collapse');
								}}
							>
								<ChevronUpIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
								{t('faqSearchCollapseAll')}
							</DesktopAppButton>
						</div>
					) : (
						<div />
					)}
				</>
			) : (
				<p className={ASSISTANT_FAQ_INSERT_HINT_CLASS}>
					<PencilSquareIcon
						className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
						aria-hidden
					/>
					<span>{t('faqInsertClickHint')}</span>
				</p>
			)}
		</>
	);
}
