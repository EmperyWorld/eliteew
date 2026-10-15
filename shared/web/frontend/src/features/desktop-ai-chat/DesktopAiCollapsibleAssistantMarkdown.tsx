/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible wrapper for long Desktop AI markdown in conversational or professional-document presentation.
 * Supports optional controlled expand state for document navigation.
 *
 * Invariants:
 * - When `expanded` is controlled, parent owns clamp/expand for TOC navigation and similar flows.
 * - Once content exceeds maxCollapsedPx, the expand/collapse control stays available even while expanded
 *   (do not clear `needsClamp` on expand — that left long documents stuck fully open).
 *
 * Related:
 * - src/features/desktop-ai-chat/DesktopAiChatMarkdown.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { DesktopAiChatMarkdown } from './DesktopAiChatMarkdown';
import type { DesktopAiContextSource } from './api/desktopChatClient';

const DEFAULT_MAX_PX = 288;

/** Default collapsed height for expert-document presentation (body owns fold). */
export const DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX = 640;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
	if (!ref) {
		return;
	}
	if (typeof ref === 'function') {
		ref(value);
		return;
	}
	ref.current = value;
}

export function DesktopAiCollapsibleAssistantMarkdown({
	markdown,
	maxCollapsedPx = DEFAULT_MAX_PX,
	ensembleBodyTint,
	presentation = 'chat',
	citationSources,
	expanded: expandedProp,
	onExpandedChange,
	contentRef,
}: {
	markdown: string;
	maxCollapsedPx?: number;
	ensembleBodyTint?: string;
	presentation?: 'chat' | 'document';
	citationSources?: DesktopAiContextSource[];
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
	contentRef?: React.Ref<HTMLDivElement | null>;
}) {
	const { t } = useTranslation('desktopAiChat');
	const shellTheme = useDesktopShellTheme();
	const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(false);
	const expanded = expandedProp ?? uncontrolledExpanded;
	const setExpanded = React.useCallback(
		(next: boolean | ((prev: boolean) => boolean)) => {
			const resolved =
				typeof next === 'function'
					? next(expandedProp ?? uncontrolledExpanded)
					: next;
			onExpandedChange?.(resolved);
			if (expandedProp === undefined) {
				setUncontrolledExpanded(resolved);
			}
		},
		[expandedProp, onExpandedChange, uncontrolledExpanded]
	);
	const innerRef = React.useRef<HTMLDivElement>(null);
	const [needsClamp, setNeedsClamp] = React.useState(false);

	const setContentNode = React.useCallback(
		(node: HTMLDivElement | null) => {
			innerRef.current = node;
			assignRef(contentRef, node);
		},
		[contentRef]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: measure scrollHeight after markdown child updates DOM
	React.useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) {
			return;
		}
		setNeedsClamp(el.scrollHeight > maxCollapsedPx + 8);
	}, [markdown, expanded, maxCollapsedPx]);

	if (!markdown.trim()) {
		return null;
	}

	return (
		<div className="relative min-w-0" data-testid="desktop-ai-collapsible-md">
			<div
				ref={setContentNode}
				data-testid="desktop-ai-collapsible-md-body"
				className={[
					'relative min-w-0',
					needsClamp && !expanded ? 'overflow-hidden' : '',
					needsClamp && !expanded ? 'motion-reduce:transition-none' : '',
				]
					.filter(Boolean)
					.join(' ')}
				style={
					needsClamp && !expanded ? { maxHeight: maxCollapsedPx } : undefined
				}
			>
				<DesktopAiChatMarkdown
					markdown={markdown}
					ensembleBodyTint={ensembleBodyTint}
					presentation={presentation}
					citationSources={citationSources}
				/>
				{needsClamp && !expanded ? (
					<div
						className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-14 bg-linear-to-t from-[color-mix(in_srgb,var(--desktop-surface-soft)_94%,rgb(0,0,0)_06%)] via-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)] to-transparent motion-reduce:hidden"
						aria-hidden
					/>
				) : null}
			</div>
			{needsClamp ? (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
					data-testid="desktop-ai-collapsible-md-toggle"
					className={cn(
						'mt-1.5 min-h-9 underline-offset-2 hover:underline px-0.5 py-1 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent rounded-md',
						DESKTOP_INTERACTIVE.btnRounded,
						DESKTOP_TYPOGRAPHY.captionInherit,
						shellTheme === 'light'
							? 'text-[rgb(var(--desktop-accent-rgb))]'
							: 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
					)}
				>
					{expanded ? t('markdownCollapse') : t('markdownExpand')}
				</button>
			) : null}
		</div>
	);
}
