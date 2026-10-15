/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context summary row and attachment chip strip above the messages pane.
 *
 * Invariants:
 * - Primary row uses human labels only; no raw ids in the main context line.
 *
 * Related:
 * - hooks/useDesktopAiChatAttachments.ts, DesktopAiChatApp.tsx
 */
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import type { TFunction } from 'i18next';
import type {
	DesktopAiAttachment,
	DesktopAiChatItem,
} from '../api/desktopChatClient';
import { looksLikeUrlLabel } from '../hooks/useDesktopAiChatAttachments';
import { DocumentTextIcon, LinkIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiChatContextBarProps = {
	activeChat: DesktopAiChatItem | null;
	activeId: string | null;
	attachments: DesktopAiAttachment[];
	selectedProjectName: string | null;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

function attachmentChipLabel(
	a: DesktopAiAttachment,
	t: TFunction<'desktopAiChat'>
): string {
	const label = a.source_label?.trim();
	if (label) {
		return label;
	}
	return t('attachFallbackName');
}

export function DesktopAiChatContextBar({
	activeChat,
	activeId,
	attachments,
	selectedProjectName,
	lucideStroke,
	t,
}: DesktopAiChatContextBarProps) {
	const hasProject = Boolean(activeChat?.project_id);
	const hasAttachments = Boolean(activeId && attachments.length > 0);
	// Quiet chrome: hide empty «no project / no attachments» noise above the thread.
	if (!hasProject && !hasAttachments) {
		return null;
	}

	return (
		<div className="flex flex-col gap-1">
			{hasProject && activeChat ? (
				<div
					className={cn(
						'flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
				>
					<span>
						{selectedProjectName
							? t('contextProjectNamed', { name: selectedProjectName })
							: t('contextProjectBound')}
					</span>
					<span>
						{activeChat.use_project_rag
							? t('contextProjectMemoryOn')
							: t('contextProjectMemoryOff')}
					</span>
					{hasAttachments ? (
						<span>{t('attachmentsCount', { count: attachments.length })}</span>
					) : null}
				</div>
			) : null}
			{hasAttachments ? (
				<div
					className={cn(
						'flex max-h-24 gap-1.5 overflow-x-auto py-0.5',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
				>
					{attachments.map((a) => {
						const label = attachmentChipLabel(a, t);
						const urlish = looksLikeUrlLabel(a.source_label ?? null);
						const chipStatus = a.rag_indexed_at
							? t('attachChipIndexed')
							: t('attachChipPending');
						return (
							<DesktopChromeTooltip
								key={a.id}
								content={`${label}\n${chipStatus}`}
								placement="top"
								offsetExtra={4}
							>
								<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] px-2 py-0.5 max-w-56">
									{urlish ? (
										<LinkIcon
											className="h-3 w-3 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
											strokeWidth={lucideStroke}
										/>
									) : (
										<DocumentTextIcon
											className="h-3 w-3 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
											strokeWidth={lucideStroke}
										/>
									)}
									<span className="truncate">{label}</span>
									<span
										className={
											a.rag_indexed_at
												? 'shrink-0 text-emerald-300/90'
												: 'shrink-0 text-amber-200/85'
										}
										aria-hidden
									>
										{a.rag_indexed_at
											? t('attachChipBadgeIndexed')
											: t('attachChipBadgePending')}
									</span>
								</span>
							</DesktopChromeTooltip>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
