/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat main column shell: portal root for in-app overlays, no-chat empty state,
 * opening-chat spinner, and slot for active thread + composer.
 *
 * Invariants:
 * - Empty and resolving states stay mutually exclusive with active thread content.
 * - Portal root ref is owned here for attachment preview stacking inside the main column.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/GafChatPortalRootContext.tsx
 */
import { cn } from '@/utils/cn';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DesktopAppButton, DesktopAppEmptyState } from '../../DesktopAppChrome';
import { GafChatPortalRootContext } from '../GafChatPortalRootContext';
import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

export type GafChatMainColumnChromeProps = {
	shellMainColumnClass: string;
	gafPortalRoot: HTMLElement | null;
	setGafPortalRoot: (el: HTMLElement | null) => void;
	selectedChatId: string | null;
	resolvingInitialUsername: boolean;
	openingChatTimedOut?: boolean;
	onRetryOpenChat?: () => void;
	activeThreadContent: ReactNode;
};

export const GafChatMainColumnChrome = memo(function GafChatMainColumnChrome({
	shellMainColumnClass,
	gafPortalRoot,
	setGafPortalRoot,
	selectedChatId,
	resolvingInitialUsername,
	openingChatTimedOut = false,
	onRetryOpenChat,
	activeThreadContent,
}: GafChatMainColumnChromeProps) {
	const { t } = useTranslation('gafChat');
	const lucideStroke = DESKTOP_LUCIDE.stroke;

	return (
		<GafChatPortalRootContext.Provider value={gafPortalRoot}>
			<main
				ref={setGafPortalRoot}
				className={cn(shellMainColumnClass, 'relative')}
			>
				{!selectedChatId ? (
					resolvingInitialUsername ? (
						openingChatTimedOut ? (
							<DesktopAppEmptyState
								className="min-h-0 flex-1"
								icon={
									<ChatBubbleLeftRightIcon
										className="w-8 h-8 text-[rgb(var(--desktop-accent-rgb)/0.75)]"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								}
								title={
									<span className={cn('block', DESKTOP_TYPOGRAPHY.subtitle)}>
										{t('openingChatFailedTitle')}
									</span>
								}
								description={
									<span className={DESKTOP_TYPOGRAPHY.bodyMuted}>
										{t('openingChatFailedDescription')}
									</span>
								}
							>
								{onRetryOpenChat ? (
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										onClick={onRetryOpenChat}
									>
										{t('openingChatRetry')}
									</DesktopAppButton>
								) : null}
							</DesktopAppEmptyState>
						) : (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-(--desktop-text-muted)"
								role="status"
								aria-live="polite"
								aria-busy="true"
							>
								<ArrowPathIcon
									className="h-9 w-9 animate-spin motion-reduce:animate-none text-[rgb(var(--desktop-accent-rgb))]"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.body,
										'text-center text-(--desktop-text-secondary)'
									)}
								>
									{t('openingChat')}
								</p>
							</div>
						)
					) : (
						<DesktopAppEmptyState
							className="min-h-0 flex-1"
							icon={
								<ChatBubbleLeftRightIcon
									className="w-8 h-8 text-[rgb(var(--desktop-accent-rgb)/0.75)]"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							}
							title={
								<span className={cn('block', DESKTOP_TYPOGRAPHY.subtitle)}>
									{t('noChatSelectedTitle')}
								</span>
							}
							description={
								<div
									className={cn(
										'flex max-w-sm flex-col gap-2 leading-relaxed',
										DESKTOP_TYPOGRAPHY.bodyMuted
									)}
								>
									<span className="text-(--desktop-text-muted)">
										{t('noChatSelectedDescription')}
									</span>
									<span
										className={cn(
											'text-(--desktop-text-dim)',
											DESKTOP_TYPOGRAPHY.captionInherit
										)}
									>
										{t('noChatSelectedHint')}
									</span>
								</div>
							}
						/>
					)
				) : (
					activeThreadContent
				)}
			</main>
		</GafChatPortalRootContext.Provider>
	);
});
