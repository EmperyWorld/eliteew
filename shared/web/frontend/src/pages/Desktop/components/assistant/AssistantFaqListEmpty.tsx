/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ panel loading, error, empty, and search-empty states (slice R04).
 *
 * Invariants:
 * - Parent owns query refetch; frames are presentational.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
	QuestionMarkCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../DesktopAppChrome';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import {
	ASSISTANT_ERROR_RETRY_BUTTON_CLASS,
	ASSISTANT_ERROR_RETRY_READY_CLASS,
	ASSISTANT_ERROR_STATE_FRAME_CLASS,
	ASSISTANT_ERROR_STATE_ICON_WRAP_CLASS,
	ASSISTANT_FAQ_EMPTY_FRAME_CLASS,
	ASSISTANT_FAQ_SEARCH_CLEAR_BUTTON_CLASS,
	ASSISTANT_FAQ_SEARCH_CLEAR_READY_CLASS,
	ASSISTANT_FAQ_SEARCH_EMPTY_FRAME_CLASS,
	ASSISTANT_FAQ_SKELETON_CLASS,
} from './assistantFaqPanelStyles';

export type AssistantFaqListEmptyProps = {
	faqQuery: UseQueryResult<AssistantFaqEntry[]>;
	faq: AssistantFaqEntry[];
	filteredFaq: AssistantFaqEntry[];
	faqSearch: string;
	faqSearchInputRef: RefObject<HTMLInputElement | null>;
	onFaqSearchChange: (value: string) => void;
	onRefreshFaq: () => void | Promise<void>;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantFaqListEmpty({
	faqQuery,
	faq,
	filteredFaq,
	faqSearch,
	faqSearchInputRef,
	onFaqSearchChange,
	onRefreshFaq,
	t,
}: AssistantFaqListEmptyProps): React.ReactElement | null {
	if (faqQuery.isLoading) {
		return (
			<ul
				className="space-y-3 motion-safe:animate-pulse motion-reduce:animate-none"
				aria-busy="true"
				aria-live="polite"
			>
				{[0, 1, 2].map((slot) => (
					<li key={slot} className={ASSISTANT_FAQ_SKELETON_CLASS} />
				))}
				<span className="sr-only">{t('faqLoading')}</span>
			</ul>
		);
	}

	if (faqQuery.isError) {
		return (
			<div
				className={cn(
					ASSISTANT_ERROR_STATE_FRAME_CLASS,
					'mx-1 flex flex-col items-center gap-3 py-6 text-center'
				)}
			>
				<div className={ASSISTANT_ERROR_STATE_ICON_WRAP_CLASS}>
					<ArrowPathIcon className="h-5 w-5 text-rose-300/90" aria-hidden />
				</div>
				<p
					className={cn(DESKTOP_TYPOGRAPHY.small, 'text-(--desktop-text-dim)')}
				>
					{t('faqLoadError')}
				</p>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={cn(
						ASSISTANT_ERROR_RETRY_BUTTON_CLASS,
						!faqQuery.isFetching && ASSISTANT_ERROR_RETRY_READY_CLASS
					)}
					disabled={faqQuery.isFetching}
					onClick={() => void onRefreshFaq()}
				>
					<ArrowPathIcon
						className={cn(
							'h-4 w-4 shrink-0',
							faqQuery.isFetching && 'animate-spin'
						)}
						aria-hidden
					/>
					{t('faqRetry')}
				</DesktopAppButton>
			</div>
		);
	}

	if (faq.length === 0) {
		return (
			<div className={ASSISTANT_FAQ_EMPTY_FRAME_CLASS}>
				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.emptyIcon,
						'h-11! w-11! border-[rgb(var(--desktop-accent-rgb)/0.28)]',
						'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
					)}
				>
					<QuestionMarkCircleIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
						aria-hidden
					/>
				</div>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'max-w-56 text-(--desktop-text-secondary)'
					)}
				>
					{t('faqEmpty')}
				</p>
			</div>
		);
	}

	if (filteredFaq.length === 0 && faqSearch.trim()) {
		return (
			<div className={ASSISTANT_FAQ_SEARCH_EMPTY_FRAME_CLASS}>
				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.emptyIcon,
						'h-10! w-10! border-[rgb(var(--desktop-accent-rgb)/0.32)]',
						'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
					)}
				>
					<MagnifyingGlassIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
						aria-hidden
					/>
				</div>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('faqSearchEmpty')}
				</p>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						ASSISTANT_FAQ_SEARCH_CLEAR_BUTTON_CLASS,
						ASSISTANT_FAQ_SEARCH_CLEAR_READY_CLASS
					)}
					onClick={() => {
						onFaqSearchChange('');
						faqSearchInputRef.current?.focus();
					}}
				>
					<XMarkIcon className="h-4 w-4 shrink-0" aria-hidden />
					{t('faqSearchClear')}
				</DesktopAppButton>
			</div>
		);
	}

	return null;
}
