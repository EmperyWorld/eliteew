/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grouped like/dislike feedback surface for MusicForge result card.
 *
 * Related:
 * - MusicForgeResultCard.tsx
 */

import {
	HandThumbDownIcon,
	HandThumbUpIcon,
} from '@heroicons/react/24/outline';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	MUSIC_FORGE_DISLIKE_REASON_CODES,
	type MusicForgeDislikeReasonCode,
} from './musicForgeUiHelpers';

export type MusicForgeFeedbackPanelProps = {
	feedback: 'like' | 'dislike' | null;
	pending: boolean;
	selectedDislikeReason: MusicForgeDislikeReasonCode | null;
	feedbackError: string | null;
	feedbackOk: string | null;
	dislikeDetailsRef: RefObject<HTMLDetailsElement | null>;
	onLike: () => void;
	onDislike: () => void;
	onToggleDislikeReason: (code: MusicForgeDislikeReasonCode) => void;
};

export function MusicForgeFeedbackPanel({
	feedback,
	pending,
	selectedDislikeReason,
	feedbackError,
	feedbackOk,
	dislikeDetailsRef,
	onLike,
	onDislike,
	onToggleDislikeReason,
}: MusicForgeFeedbackPanelProps) {
	const { t } = useTranslation('desktopUi');
	const showDislikeReasons = feedback === 'dislike' || Boolean(feedbackError);

	return (
		<div
			className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4"
			data-testid="music-forge-feedback-panel"
		>
			<DesktopAppSectionLabel>
				{t('musicForge.result.feedbackSectionLabel')}
			</DesktopAppSectionLabel>
			<p className="mb-3 text-xs leading-relaxed text-(--desktop-text-dim)">
				{t('musicForge.result.feedbackSectionHint')}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppButton
					type="button"
					variant={feedback === 'like' ? 'accent' : 'neutral'}
					disabled={pending}
					aria-pressed={feedback === 'like'}
					onClick={onLike}
				>
					<HandThumbUpIcon className="size-4" />
					{t('musicForge.result.like')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant={feedback === 'dislike' ? 'danger' : 'neutral'}
					disabled={pending}
					aria-pressed={feedback === 'dislike'}
					onClick={onDislike}
				>
					<HandThumbDownIcon className="size-4" />
					{t('musicForge.result.dislike')}
				</DesktopAppButton>
			</div>

			<details
				ref={dislikeDetailsRef}
				className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
				open={showDislikeReasons || undefined}
			>
				<summary className="cursor-pointer text-xs font-medium text-(--desktop-text-secondary) [&::-webkit-details-marker]:hidden">
					{t('musicForge.result.dislikeReasonToggle')}
				</summary>
				<div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
					{MUSIC_FORGE_DISLIKE_REASON_CODES.map((code) => (
						<button
							key={code}
							type="button"
							disabled={pending}
							aria-pressed={selectedDislikeReason === code}
							className={cn(
								'rounded-full border px-3 py-1 text-xs transition',
								selectedDislikeReason === code
									? 'border-rose-300/60 bg-rose-500/20 text-rose-50'
									: 'border-white/15 bg-black/20 text-(--desktop-text-secondary) hover:border-white/25'
							)}
							onClick={() => onToggleDislikeReason(code)}
						>
							{t(`musicForge.result.dislikeReasons.${code}`)}
						</button>
					))}
				</div>
			</details>

			{feedbackError ? (
				<p className="mt-2 text-sm text-rose-200" role="alert">
					{feedbackError}
				</p>
			) : null}
			{feedbackOk ? (
				<p className="mt-2 text-sm text-emerald-100" role="status">
					{feedbackOk}
				</p>
			) : null}
		</div>
	);
}
