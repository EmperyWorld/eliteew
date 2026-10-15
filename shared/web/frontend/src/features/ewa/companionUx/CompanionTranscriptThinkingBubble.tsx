/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pending-turn thinking bubble while companion reply is in flight (U8.3 slice 15).
 *
 * Invariants:
 * - Shown only when pending and no streaming assistant text yet.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { motion } from 'framer-motion';

import { MOBILE_EMBEDDED_EWA_ASSISTANT_BUBBLE_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { cn } from '@/utils/cn';

export type CompanionTranscriptThinkingBubbleProps = {
	displayName: string;
	thinkingHintText: string;
	mobileEmbeddedLayout: boolean;
	reducedMotion: boolean;
};

export function CompanionTranscriptThinkingBubble({
	displayName,
	thinkingHintText,
	mobileEmbeddedLayout,
	reducedMotion,
}: CompanionTranscriptThinkingBubbleProps) {
	return (
		<motion.li
			initial={reducedMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: reducedMotion ? 0 : 0.18 }}
			className={cn(
				mobileEmbeddedLayout
					? cn(MOBILE_EMBEDDED_EWA_ASSISTANT_BUBBLE_CLASS, 'mt-2')
					: 'mr-auto mt-2 flex max-w-[92%] flex-col gap-1 rounded-2xl border border-(--companion-divider) bg-white/6 px-3 py-2.5 shadow-sm'
			)}
		>
			<span
				className={cn(
					'text-[10px] font-medium uppercase tracking-wider text-(--companion-aura)'
				)}
			>
				{displayName}
			</span>
			<p
				className={cn(
					'text-[12px] font-medium italic',
					!reducedMotion && 'companion-thinking-hint',
					reducedMotion && 'text-(--companion-text-soft)'
				)}
			>
				{thinkingHintText}
			</p>
		</motion.li>
	);
}
