/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ sidebar panel shell: header, mode explainer, search, list (slice R04).
 *
 * Invariants:
 * - FAQ answers render without LLM; card actions delegate to parent callbacks.
 * - Sticky header uses sentence-case product chrome (no shouty overlines).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - AssistantFaqSearchBar.tsx, AssistantFaqCard.tsx, AssistantFaqListEmpty.tsx
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */
import { cn } from '@/utils/cn';
import type { RefObject } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import { AssistantDesktopTooltip } from './AssistantDesktopTooltip';
import { AssistantFaqCard } from './AssistantFaqCard';
import { AssistantFaqListEmpty } from './AssistantFaqListEmpty';
import { AssistantFaqModeExplainer } from './AssistantFaqModeExplainer';
import { AssistantFaqSearchBar } from './AssistantFaqSearchBar';
import {
	ASSISTANT_FAQ_COLLAPSED_HINT_CLASS,
	ASSISTANT_FAQ_COUNT_BADGE_CLASS,
	ASSISTANT_FAQ_COUNT_BADGE_FLASH_CLASS,
	ASSISTANT_FAQ_HEADER_REFRESHING_CLASS,
	ASSISTANT_FAQ_MOBILE_TOGGLE_CHEVRON_CLASS,
	ASSISTANT_FAQ_MOBILE_TOGGLE_CLOSED_CLASS,
	ASSISTANT_FAQ_MOBILE_TOGGLE_OPEN_CLASS,
	ASSISTANT_FAQ_REFRESH_FETCHING_CLASS,
	ASSISTANT_FAQ_REFRESH_READY_CLASS,
	ASSISTANT_FAQ_REFRESH_SUCCESS_CLASS,
} from './assistantFaqPanelStyles';

export type AssistantFaqPanelProps = {
	asideClassName: string;
	embeddedMobileLayout: boolean;
	faqMobileOpen: boolean;
	onFaqMobileOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
	faqQuery: UseQueryResult<AssistantFaqEntry[]>;
	faq: AssistantFaqEntry[];
	filteredFaq: AssistantFaqEntry[];
	faqSearch: string;
	onFaqSearchChange: (value: string) => void;
	faqSearchInputRef: RefObject<HTMLInputElement | null>;
	faqSearchFocused: boolean;
	onFaqSearchFocusedChange: (focused: boolean) => void;
	faqSearchFocusFlash: boolean;
	faqRefreshFlash: boolean;
	onRefreshFaq: () => void | Promise<void>;
	openFaqIds: Set<string>;
	onOpenFaqIdsChange: (
		updater: Set<string> | ((prev: Set<string>) => Set<string>)
	) => void;
	faqBulkActionFlash: 'expand' | 'collapse' | null;
	onFaqBulkActionFlash: (value: 'expand' | 'collapse' | null) => void;
	sending: boolean;
	copiedMessageFlashId: string | null;
	faqInsertFlashId: string | null;
	faqShowFlashId: string | null;
	faqAskFlashId: string | null;
	faqAskDisabled: boolean;
	faqAskDisabledTitle: string | undefined;
	onShowFaqInChat: (entry: AssistantFaqEntry) => void;
	onCopyMessageText: (
		text: string,
		opts?: {
			doneKey?: 'copyMessageDone' | 'faqCopyQuestionDone' | 'faqCopyAnswerDone';
			flashId?: string;
		}
	) => void | Promise<void>;
	onInsertFaqQuestion: (question: string, flashId: string) => void;
	onTryAskFaq: (question: string, flashId: string) => void;
	onFaqActionAck?: (messageKey: string) => void;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantFaqPanel(props: AssistantFaqPanelProps) {
	const {
		asideClassName,
		embeddedMobileLayout,
		faqMobileOpen,
		onFaqMobileOpenChange,
		faqQuery,
		faq,
		filteredFaq,
		faqSearch,
		onFaqSearchChange,
		faqSearchInputRef,
		faqSearchFocused,
		onFaqSearchFocusedChange,
		faqSearchFocusFlash,
		faqRefreshFlash,
		onRefreshFaq,
		openFaqIds,
		onOpenFaqIdsChange,
		faqBulkActionFlash,
		onFaqBulkActionFlash,
		sending,
		copiedMessageFlashId,
		faqInsertFlashId,
		faqShowFlashId,
		faqAskFlashId,
		faqAskDisabled,
		faqAskDisabledTitle,
		onShowFaqInChat,
		onCopyMessageText,
		onInsertFaqQuestion,
		onTryAskFaq,
		onFaqActionAck,
		t,
	} = props;

	const listHidden = !faqMobileOpen && embeddedMobileLayout;
	const listHiddenMd = !faqMobileOpen && !embeddedMobileLayout;

	return (
		<div
			className={cn(
				asideClassName,
				embeddedMobileLayout &&
					!faqMobileOpen &&
					'mobile-handbook-faq-collapsed',
				embeddedMobileLayout && faqMobileOpen && 'mobile-handbook-faq-open'
			)}
			data-assistant-guide="faq-panel"
		>
			<div
				className={cn(
					'sticky top-0 z-1 -mx-2.5 mb-2.5 space-y-2 px-2.5 pb-2',
					'border-b border-(--desktop-border-subtle)/45',
					'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_92%,transparent)]',
					'backdrop-blur-[6px] supports-backdrop-filter:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_84%,transparent)]',
					'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:rounded-full before:bg-white/12',
					'relative',
					faqQuery.isFetching && ASSISTANT_FAQ_HEADER_REFRESHING_CLASS
				)}
			>
				<div className="flex items-center justify-between gap-2 pt-0.5">
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-(--desktop-text-primary)'
						)}
					>
						<QuestionMarkCircleIcon
							className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
							aria-hidden
						/>
						{t('faqLabel')}
						{faq.length > 0 && !faqQuery.isLoading ? (
							<DesktopChromeTooltip
								content={t('faqTotalCount', { count: faq.length })}
								placement="top"
								offsetExtra={4}
							>
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'rounded-full border px-2 py-0.5 tabular-nums',
										ASSISTANT_FAQ_COUNT_BADGE_CLASS,
										faqRefreshFlash &&
											!faqQuery.isFetching &&
											ASSISTANT_FAQ_COUNT_BADGE_FLASH_CLASS
									)}
								>
									{faq.length}
								</span>
							</DesktopChromeTooltip>
						) : null}
					</div>
					<AssistantDesktopTooltip
						content={
							faqRefreshFlash && !faqQuery.isFetching
								? t('faqRefreshDone')
								: t('faqRefresh')
						}
					>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className={cn(
								'shrink-0 px-2 text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
								faqQuery.isFetching && ASSISTANT_FAQ_REFRESH_FETCHING_CLASS,
								!faqQuery.isFetching &&
									!faqRefreshFlash &&
									ASSISTANT_FAQ_REFRESH_READY_CLASS,
								faqRefreshFlash &&
									!faqQuery.isFetching &&
									ASSISTANT_FAQ_REFRESH_SUCCESS_CLASS
							)}
							disabled={faqQuery.isFetching || sending}
							onClick={() => void onRefreshFaq()}
							aria-label={
								faqRefreshFlash && !faqQuery.isFetching
									? t('faqRefreshDone')
									: t('faqRefresh')
							}
						>
							{faqRefreshFlash && !faqQuery.isFetching ? (
								<CheckCircleIcon
									className="h-4 w-4 text-emerald-300/95"
									aria-hidden
								/>
							) : (
								<ArrowPathIcon
									className={cn(
										'h-4 w-4',
										faqQuery.isFetching && 'motion-safe:animate-spin'
									)}
									aria-hidden
								/>
							)}
						</DesktopAppButton>
					</AssistantDesktopTooltip>
					<AssistantDesktopTooltip
						content={
							faqMobileOpen ? t('faqCollapsePanel') : t('faqExpandPanel')
						}
					>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							data-assistant-guide="faq-panel-toggle"
							className={cn(
								faqMobileOpen
									? ASSISTANT_FAQ_MOBILE_TOGGLE_OPEN_CLASS
									: ASSISTANT_FAQ_MOBILE_TOGGLE_CLOSED_CLASS,
								embeddedMobileLayout && 'md:inline-flex'
							)}
							aria-expanded={faqMobileOpen}
							aria-label={
								faqMobileOpen ? t('faqCollapsePanel') : t('faqExpandPanel')
							}
							onClick={() => onFaqMobileOpenChange((open) => !open)}
						>
							<ChevronDownIcon
								className={cn(
									ASSISTANT_FAQ_MOBILE_TOGGLE_CHEVRON_CLASS,
									faqMobileOpen && '-rotate-180'
								)}
								aria-hidden
							/>
							{!faqMobileOpen && faq.length > 0 ? (
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'rounded-full border px-1.5 py-0 tabular-nums',
										ASSISTANT_FAQ_COUNT_BADGE_CLASS
									)}
									aria-hidden
								>
									{faq.length}
								</span>
							) : null}
						</DesktopAppButton>
					</AssistantDesktopTooltip>
				</div>
				{!embeddedMobileLayout &&
				!faqMobileOpen &&
				faq.length > 0 &&
				!faqQuery.isLoading ? (
					<AssistantDesktopTooltip
						content={t('faqCollapsedTapHint', { count: faq.length })}
						inlineClassName="w-full max-md:block"
					>
						<button
							type="button"
							className={cn(ASSISTANT_FAQ_COLLAPSED_HINT_CLASS, 'group')}
							onClick={() => {
								onFaqMobileOpenChange(true);
								window.requestAnimationFrame(() => {
									faqSearchInputRef.current?.focus();
								});
							}}
						>
							<span className="flex w-full items-center justify-center gap-2">
								<QuestionMarkCircleIcon
									className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
									aria-hidden
								/>
								<span className="min-w-0 truncate">
									{t('faqCollapsedTapHint', { count: faq.length })}
								</span>
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'shrink-0 rounded-full border px-2 py-0.5 tabular-nums',
										ASSISTANT_FAQ_COUNT_BADGE_CLASS
									)}
									aria-hidden
								>
									{faq.length}
								</span>
								<ChevronDownIcon
									className="h-4 w-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none"
									aria-hidden
								/>
							</span>
						</button>
					</AssistantDesktopTooltip>
				) : null}
				<div
					className={cn(
						listHidden && 'hidden',
						listHiddenMd && 'max-md:hidden'
					)}
				>
					<AssistantFaqModeExplainer t={t} />
					{!faqQuery.isLoading && faq.length > 0 ? (
						<AssistantFaqSearchBar
							faq={faq}
							filteredFaq={filteredFaq}
							faqSearch={faqSearch}
							onFaqSearchChange={onFaqSearchChange}
							faqSearchInputRef={faqSearchInputRef}
							faqSearchFocused={faqSearchFocused}
							onFaqSearchFocusedChange={onFaqSearchFocusedChange}
							faqSearchFocusFlash={faqSearchFocusFlash}
							openFaqIds={openFaqIds}
							onOpenFaqIdsChange={onOpenFaqIdsChange}
							faqBulkActionFlash={faqBulkActionFlash}
							onFaqBulkActionFlash={onFaqBulkActionFlash}
							t={t}
						/>
					) : null}
				</div>
			</div>
			<div
				className={cn(listHidden && 'hidden', listHiddenMd && 'max-md:hidden')}
			>
				<AssistantFaqListEmpty
					faqQuery={faqQuery}
					faq={faq}
					filteredFaq={filteredFaq}
					faqSearch={faqSearch}
					faqSearchInputRef={faqSearchInputRef}
					onFaqSearchChange={onFaqSearchChange}
					onRefreshFaq={onRefreshFaq}
					t={t}
				/>
				<ul className="space-y-2.5" data-assistant-guide="faq-list">
					{filteredFaq.map((f) => (
						<AssistantFaqCard
							key={f.id}
							entry={f}
							faqSearch={faqSearch}
							openFaqIds={openFaqIds}
							onOpenFaqIdsChange={onOpenFaqIdsChange}
							sending={sending}
							copiedMessageFlashId={copiedMessageFlashId}
							faqInsertFlashId={faqInsertFlashId}
							faqShowFlashId={faqShowFlashId}
							faqAskFlashId={faqAskFlashId}
							faqAskDisabled={faqAskDisabled}
							faqAskDisabledTitle={faqAskDisabledTitle}
							onShowFaqInChat={onShowFaqInChat}
							onCopyMessageText={onCopyMessageText}
							onInsertFaqQuestion={onInsertFaqQuestion}
							onTryAskFaq={onTryAskFaq}
							onActionAck={onFaqActionAck}
							t={t}
						/>
					))}
				</ul>
			</div>
		</div>
	);
}
