/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Header chrome for CommentsReviewPanel: title, counts, capabilities hint, hotkeys toggle, close.
 *
 * Related:
 * - commentsReview/CommentsReviewPanel.tsx
 */

import {
	ChatBubbleLeftRightIcon,
	QuestionMarkCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export interface CommentsReviewPanelHeaderProps {
	t: TFunction;
	commentsLoading: boolean;
	unresolvedCount: number;
	totalThreads: number;
	commentsError: string | null;
	documentId?: string;
	capabilitiesKnown: boolean;
	permissionRole: 'owner' | 'reviewer' | 'viewer';
	showHotkeysHelp: boolean;
	onToggleHotkeysHelp: () => void;
	onClose: () => void;
}

export function CommentsReviewPanelHeader({
	t,
	commentsLoading,
	unresolvedCount,
	totalThreads,
	commentsError,
	documentId,
	capabilitiesKnown,
	permissionRole,
	showHotkeysHelp,
	onToggleHotkeysHelp,
	onClose,
}: CommentsReviewPanelHeaderProps) {
	return (
		<div className="flex shrink-0 items-center justify-between border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
			<div className="flex min-w-0 items-center gap-3">
				<div className="shrink-0 rounded-xl border border-blue-400/30 bg-linear-to-br from-blue-500/30 to-purple-500/30 p-2">
					<ChatBubbleLeftRightIcon
						className="text-blue-300"
						width={18}
						height={18}
						aria-hidden
					/>
				</div>
				<div className="min-w-0">
					<h3
						id="comments-review-panel-title"
						className="truncate text-base font-semibold leading-tight tracking-tight text-(--desktop-text-primary)"
					>
						{t('comments.title')}
					</h3>
					<p className="text-xs leading-snug text-(--desktop-text-muted)">
						{commentsLoading
							? t('comments.header.loading')
							: t('comments.header.subtitleCounts', {
									unresolved: unresolvedCount,
									total: totalThreads,
								})}
						{commentsError && (
							<span className="ml-2 text-amber-300" title={commentsError}>
								• {t('comments.header.limitedMode')}
							</span>
						)}
						{!commentsLoading && documentId && !capabilitiesKnown && (
							<span
								className="ml-2 text-amber-300"
								title={t('comments.header.capabilitiesUnavailableTitle')}
							>
								• {t('comments.header.capabilitiesUnavailable')}
							</span>
						)}
						<span
							className="ml-2 text-(--desktop-text-dim)"
							title={t('comments.header.capabilitiesMatrixTitle')}
						>
							• {t(`comments.roles.${permissionRole}`)}
						</span>
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<DesktopAppButton
					onClick={onToggleHotkeysHelp}
					variant="ghost"
					size="icon"
					className="min-h-11 min-w-11"
					title={
						showHotkeysHelp
							? t('comments.header.hotkeysHide')
							: t('comments.header.hotkeysShow')
					}
					aria-label={
						showHotkeysHelp
							? t('comments.header.hotkeysHide')
							: t('comments.header.hotkeysShow')
					}
				>
					<QuestionMarkCircleIcon
						width={18}
						height={18}
						className="text-(--desktop-text-muted)"
					/>
				</DesktopAppButton>
				<DesktopAppButton
					onClick={onClose}
					variant="ghost"
					size="icon"
					className="min-h-11 min-w-11"
					title={t('comments.header.closeTitle')}
					aria-label={t('comments.header.closeAria')}
				>
					<XMarkIcon
						width={20}
						height={20}
						className="text-(--desktop-text-muted)"
					/>
				</DesktopAppButton>
			</div>
		</div>
	);
}
