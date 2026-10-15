/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion chat draft textarea with Enter-to-send and half-column expand toggle.
 *
 * Invariants:
 * - Parent owns draft state and send handler; Shift+Enter inserts newline.
 * - Native CSS resize is disabled; expand uses half of `[data-ewa-composer-layout]`.
 * - Parent collapses expand on send (any send path).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionComposerDraftStack.tsx
 * - src/features/ewa/companionUx/CompanionChatMainColumn.tsx
 */

import {
	ArrowsPointingInIcon,
	ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { type CSSProperties, type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionComposerTextareaDensity = 'mobile' | 'desktop';

export type CompanionComposerTextareaProps = {
	density: CompanionComposerTextareaDensity;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	draft: string;
	pending: boolean;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onDraftChange: (value: string) => void;
	onSend: () => void;
};

const COMPOSER_LAYOUT_SELECTOR = '[data-ewa-composer-layout]';
const EXPANDED_FRACTION = 0.5;
const EXPANDED_MIN_PX = 160;

export function CompanionComposerTextarea({
	density,
	inputRef,
	draft,
	pending,
	expanded,
	onExpandedChange,
	onDraftChange,
	onSend,
}: CompanionComposerTextareaProps) {
	const { t } = useTranslation('marketing');
	const [expandedHeightPx, setExpandedHeightPx] = useState<number | null>(null);

	useEffect(() => {
		if (!expanded) {
			setExpandedHeightPx(null);
			return;
		}
		const field = inputRef.current;
		const layout = field?.closest(COMPOSER_LAYOUT_SELECTOR);
		if (!(layout instanceof HTMLElement)) {
			setExpandedHeightPx(Math.round(window.innerHeight * EXPANDED_FRACTION));
			return;
		}
		const measure = () => {
			const half = Math.round(
				layout.getBoundingClientRect().height * EXPANDED_FRACTION
			);
			setExpandedHeightPx(Math.max(EXPANDED_MIN_PX, half));
		};
		measure();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(layout);
		return () => observer.disconnect();
	}, [expanded, inputRef]);

	const expandedStyle: CSSProperties | undefined =
		expanded && expandedHeightPx != null
			? { height: `${expandedHeightPx}px`, minHeight: `${expandedHeightPx}px` }
			: undefined;

	return (
		<div className="relative w-full min-w-0">
			<textarea
				ref={inputRef}
				id="ewa-companion-chat-input"
				rows={density === 'mobile' ? 3 : 2}
				value={draft}
				disabled={pending}
				onChange={(e) => onDraftChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						void onSend();
					}
				}}
				placeholder={t('ewaCompanion.chatPlaceholder')}
				style={expandedStyle}
				className={cn(
					density === 'mobile'
						? 'min-h-16 w-full flex-1 rounded-xl'
						: 'min-h-12 w-full rounded-xl',
					'resize-none overflow-y-auto',
					'border border-white/10',
					'bg-black/20 px-3 py-2 pr-11',
					'text-[13px] leading-relaxed text-(--desktop-text-primary)',
					'placeholder:text-(--companion-text-soft)',
					DESKTOP_CHROME_FOCUS_VISIBLE,
					expanded && 'transition-[height] duration-200 ease-out'
				)}
			/>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				disabled={pending}
				className={cn(
					'absolute top-1.5 right-1.5 z-10 size-8 shrink-0 p-0',
					'text-(--companion-text-soft) hover:text-(--desktop-text-primary)'
				)}
				aria-label={
					expanded
						? t('ewaCompanion.chatComposerCollapseAria')
						: t('ewaCompanion.chatComposerExpandAria')
				}
				aria-pressed={expanded}
				title={
					expanded
						? t('ewaCompanion.chatComposerCollapse')
						: t('ewaCompanion.chatComposerExpand')
				}
				onClick={() => onExpandedChange(!expanded)}
			>
				{expanded ? (
					<ArrowsPointingInIcon className="size-4" aria-hidden />
				) : (
					<ArrowsPointingOutIcon className="size-4" aria-hidden />
				)}
			</DesktopAppButton>
		</div>
	);
}
