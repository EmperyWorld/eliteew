/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky expanded + collapsed UI for loading older Desktop AI Chat messages.
 *
 * Invariants:
 * - Testids: desktop-ai-chat-load-older, -dismiss, -btn, -collapsed, -restore.
 *
 * Related:
 * - useDesktopAiChatLoadOlderBanner.ts
 */
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiChatLoadOlderBannerProps = {
	activeId: string | null;
	showLoadOlderMessages: boolean;
	loadOlderBannerDismissed: boolean;
	messagesLength: number;
	messagesTotal: number | null;
	messagesLoadingOlder: boolean;
	lowGpu: boolean;
	lucideStroke: number;
	onLoadOlderMessages: () => void | Promise<void>;
	onDismiss: () => void;
	onRestore: () => void;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatLoadOlderBanner(
	props: DesktopAiChatLoadOlderBannerProps
) {
	const {
		activeId,
		showLoadOlderMessages,
		loadOlderBannerDismissed,
		messagesLength,
		messagesTotal,
		messagesLoadingOlder,
		lowGpu,
		lucideStroke,
		onLoadOlderMessages,
		onDismiss,
		onRestore,
		t,
	} = props;

	if (!activeId || !showLoadOlderMessages) return null;

	if (!loadOlderBannerDismissed) {
		return (
			<div
				data-testid="desktop-ai-chat-load-older"
				className={cn(
					'sticky top-0 z-10 mx-3 mb-2 flex flex-col gap-2 rounded-xl border px-3 py-2',
					'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]',
					'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.92)_100%,transparent)]',
					'shadow-[0_8px_20px_rgb(var(--desktop-fg-primary-rgb)/0.08)]',
					!lowGpu && 'backdrop-blur-sm'
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<p
						className={cn(
							'min-w-0 flex-1 text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('messagesOlderWindowHint', {
							shown: messagesLength,
							total: messagesTotal != null ? messagesTotal : messagesLength,
						})}
					</p>
					<button
						type="button"
						data-testid="desktop-ai-chat-load-older-dismiss"
						onClick={onDismiss}
						className={cn(
							'shrink-0 rounded-md p-1 text-(--desktop-text-muted) hover:text-(--desktop-text-primary)',
							DESKTOP_INTERACTIVE.btnRounded
						)}
						aria-label={t('messagesOlderHideAria')}
						title={t('messagesOlderHideTitle')}
					>
						<XMarkIcon className="h-4 w-4" strokeWidth={lucideStroke} />
					</button>
				</div>
				<button
					type="button"
					data-testid="desktop-ai-chat-load-older-btn"
					onClick={() => void onLoadOlderMessages()}
					disabled={messagesLoadingOlder}
					className={cn(
						'self-start rounded-lg px-2.5 py-1.5',
						DESKTOP_TYPOGRAPHY.captionInherit,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)]',
						'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,transparent)]',
						'text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
						messagesLoadingOlder && 'opacity-60 pointer-events-none'
					)}
				>
					{messagesLoadingOlder
						? t('messagesOlderLoading')
						: t('messagesLoadOlder')}
				</button>
			</div>
		);
	}

	return (
		<div
			data-testid="desktop-ai-chat-load-older-collapsed"
			className="sticky top-0 z-10 mx-3 mb-1 flex items-center justify-center gap-2 py-1"
		>
			<button
				type="button"
				data-testid="desktop-ai-chat-load-older-btn"
				onClick={() => void onLoadOlderMessages()}
				disabled={messagesLoadingOlder}
				className={cn(
					'rounded-lg px-2 py-1',
					DESKTOP_TYPOGRAPHY.captionInherit,
					DESKTOP_INTERACTIVE.btnRounded,
					'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)',
					messagesLoadingOlder && 'opacity-60 pointer-events-none'
				)}
			>
				{messagesLoadingOlder
					? t('messagesOlderLoading')
					: t('messagesLoadOlder')}
			</button>
			<span className="text-(--desktop-text-muted)" aria-hidden>
				·
			</span>
			<button
				type="button"
				data-testid="desktop-ai-chat-load-older-restore"
				onClick={onRestore}
				className={cn(
					'rounded-lg px-2 py-1',
					DESKTOP_TYPOGRAPHY.captionInherit,
					DESKTOP_INTERACTIVE.btnRounded,
					'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
				)}
			>
				{t('messagesOlderShowBanner')}
			</button>
		</div>
	);
}
