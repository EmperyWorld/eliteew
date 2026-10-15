/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single transcript bubble row with footer copy affordance and markdown body (U8.3 slice 15).
 *
 * Invariants:
 * - Streaming assistant rows skip Framer entry animation to avoid remount churn.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatMarkdown.tsx
 */

import {
	CheckCircleIcon,
	ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { MOBILE_EMBEDDED_EWA_ASSISTANT_BUBBLE_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { EwaCompanionChatMarkdown } from '@/features/ewa/EwaCompanionChatMarkdown';
import { isCompanionLongreadReply } from '@/features/ewa/companionLongreadReplyUi';
import type { CompanionChatMessageRow } from '@/services/ewa/ewaCompanionChatApi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionTranscriptKeyedMessage = {
	message: CompanionChatMessageRow;
	key: string;
};

export type CompanionTranscriptMessageRowProps = {
	row: CompanionTranscriptKeyedMessage;
	index: number;
	displayName: string;
	mobileEmbeddedLayout: boolean;
	reducedMotion: boolean;
	streamGrowingAssistant: boolean;
	copiedMessageKey: string | null;
	onCopyAssistantReply: (content: string, messageKey: string) => void;
};

export function CompanionTranscriptMessageRow({
	row,
	index,
	displayName,
	mobileEmbeddedLayout,
	reducedMotion,
	streamGrowingAssistant,
	copiedMessageKey,
	onCopyAssistantReply,
}: CompanionTranscriptMessageRowProps) {
	const { t, i18n } = useTranslation('marketing');
	const ru = i18n.language.startsWith('ru');
	const { message: m, key } = row;

	const rowClass = cn(
		'group flex flex-col gap-1 rounded-2xl border px-3 py-2.5 shadow-sm',
		m.role === 'user'
			? 'ml-auto max-w-[88%] border-sky-300/20 bg-sky-400/10'
			: mobileEmbeddedLayout
				? MOBILE_EMBEDDED_EWA_ASSISTANT_BUBBLE_CLASS
				: 'mr-auto max-w-[92%] border-(--companion-divider) bg-white/6',
		index > 0 && 'mt-2'
	);

	const inner = (
		<>
			<span
				className={cn(
					'text-[10px] font-medium uppercase tracking-wider',
					m.role === 'user'
						? 'text-(--desktop-text-secondary)'
						: 'text-(--companion-aura)'
				)}
			>
				{m.role === 'user' ? (ru ? 'Вы' : 'You') : displayName}
			</span>
			<EwaCompanionChatMarkdown
				markdown={m.content}
				density={
					m.role === 'assistant' && isCompanionLongreadReply(m.content)
						? 'longread'
						: 'default'
				}
			/>
			{m.role === 'assistant' ? (
				<div
					className={cn(
						'mt-1 flex justify-end border-t border-(--companion-divider)/40 pt-1.5',
						mobileEmbeddedLayout
							? 'opacity-100'
							: 'opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'
					)}
				>
					<button
						type="button"
						className={cn(
							'inline-flex items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-1',
							'text-[10px] font-medium text-(--companion-text-soft)',
							mobileEmbeddedLayout && 'min-h-8',
							'hover:bg-white/8 hover:text-(--desktop-text-primary)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label={t('ewaCompanion.chatCopyReply')}
						data-testid="ewa-companion-copy-reply"
						onClick={() => {
							void onCopyAssistantReply(m.content, key);
						}}
					>
						{copiedMessageKey === key ? (
							<CheckCircleIcon
								className="size-3 text-emerald-400"
								aria-hidden
							/>
						) : (
							<ClipboardDocumentIcon className="size-3" aria-hidden />
						)}
						{copiedMessageKey === key
							? t('ewaCompanion.chatCopied')
							: t('ewaCompanion.chatCopyReply')}
					</button>
				</div>
			) : null}
		</>
	);

	if (streamGrowingAssistant && m.role === 'assistant') {
		return (
			<li key={key} className={rowClass}>
				{inner}
			</li>
		);
	}

	return (
		<motion.li
			key={key}
			initial={reducedMotion ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: reducedMotion ? 0 : 0.2,
				ease: 'easeOut',
			}}
			className={rowClass}
		>
			{inner}
		</motion.li>
	);
}
