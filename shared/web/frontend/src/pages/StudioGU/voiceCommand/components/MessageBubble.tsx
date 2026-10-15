/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat bubble rendering for Voice Command Center message feed.
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `desktopUi.voiceCommand.bubble`
 */

import * as React from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { VoiceMessage } from '../types';
import { AssistantMessageRenderer } from '@/components/assistantMessage';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { commandMessageBubbleClasses } from '../utils/voiceCommandSurfaceStyles';
import { formatVoiceCommandTime } from '../utils/voiceCommandI18n';

export interface MessageBubbleProps {
	message: VoiceMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
	const { t, i18n } = useTranslation('desktopUi', {
		keyPrefix: 'voiceCommand',
	});
	const sw = DESKTOP_LUCIDE.stroke;
	const reduceMotion = useReducedMotion();
	const isUser = message.type === 'user';
	const isCommand = message.type === 'command';
	const isSystem = message.type === 'system';
	const renderMessageContent = () => {
		if (message.text.includes('```')) {
			return (
				<AssistantMessageRenderer
					content={message.text}
					className={
						isUser
							? 'text-white [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1'
							: '[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 text-(--desktop-text-primary)'
					}
				/>
			);
		}
		return (
			<p
				className={cn(
					'text-[15px] leading-snug whitespace-pre-wrap wrap-break-word antialiased',
					isUser ? 'text-white' : 'text-(--desktop-text-primary)'
				)}
			>
				{message.text}
			</p>
		);
	};

	const bubbleAriaLabel = isUser
		? t('bubble.user')
		: isCommand
			? t('bubble.command')
			: isSystem
				? t('bubble.system')
				: t('bubble.assistant');

	return (
		<motion.div
			initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduceMotion ? 0 : 0.2 }}
			className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
			role="article"
			aria-label={bubbleAriaLabel}
		>
			<div
				className={cn(
					'max-w-[min(85%,28rem)] rounded-(--desktop-radius-lg) px-4 py-2.5 shadow-(--desktop-shadow-soft)',
					isUser
						? 'bg-[rgb(var(--desktop-accent-rgb))] text-white ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.12)]'
						: isCommand
							? commandMessageBubbleClasses(
									message.status === 'success' ? 'success' : 'error'
								)
							: isSystem
								? 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-sm text-(--desktop-text-muted) antialiased ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]'
								: 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary) ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.06)]'
				)}
			>
				{isCommand && (
					<div className="flex items-center gap-2 mb-1">
						{message.status === 'success' ? (
							<CheckCircleIcon
								className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={sw}
							/>
						) : (
							<XCircleIcon
								className="h-4 w-4 shrink-0 text-[color-mix(in_srgb,rgb(252_165_165)_88%,var(--desktop-text-primary))]"
								strokeWidth={sw}
							/>
						)}
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-secondary)'
							)}
						>
							{t('bubble.commandLabel')}
						</span>
					</div>
				)}
				{renderMessageContent()}
				<time
					dateTime={message.timestamp.toISOString()}
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'mt-1.5 block text-(--desktop-text-dim) tabular-nums'
					)}
				>
					{formatVoiceCommandTime(message.timestamp, i18n.language, {
						hour: '2-digit',
						minute: '2-digit',
					})}
				</time>
			</div>
		</motion.div>
	);
};
