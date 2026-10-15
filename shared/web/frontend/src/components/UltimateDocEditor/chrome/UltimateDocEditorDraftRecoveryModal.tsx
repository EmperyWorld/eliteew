import { AnimatePresence, motion } from 'framer-motion';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

import {
	DraftDiffPreview,
	LocalDraftConflict,
	LocalEditorDraft,
} from '../utils/docEditorDraftLocal';

export interface UltimateDocEditorDraftRecoveryModalProps {
	open: boolean;
	pendingDraft: LocalEditorDraft | null;
	fallbackDocumentTitle?: string | null;
	draftConflict: LocalDraftConflict | null;
	draftDiffPreview: DraftDiffPreview | null;
	draftRecoverySource: 'auto' | 'manual';
	embeddedBackdropZ: number;
	embeddedContentZ: number;
	onRequestClose: () => void;
	onDiscardDraft: () => void;
	onRestoreDraft: () => void;
}

export const UltimateDocEditorDraftRecoveryModal: FC<
	UltimateDocEditorDraftRecoveryModalProps
> = ({
	open,
	pendingDraft,
	fallbackDocumentTitle,
	draftConflict,
	draftDiffPreview,
	draftRecoverySource,
	embeddedBackdropZ,
	embeddedContentZ,
	onRequestClose,
	onDiscardDraft,
	onRestoreDraft,
}) => {
	const { t, i18n } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const dateLocale = i18n.language?.toLowerCase().startsWith('ru')
		? 'ru-RU'
		: 'en-US';
	const draft = pendingDraft;
	return (
		<AnimatePresence>
			{open && draft ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedBackdropZ }}
					onClick={onRequestClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.18 }}
						className="w-full max-w-xl"
						style={{ zIndex: embeddedContentZ }}
						onClick={(event) => event.stopPropagation()}
					>
						<DesktopAppModalFrame
							onClose={onRequestClose}
							title={
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/12 text-amber-100 shadow-(--desktop-shadow-panel)">
										<ExclamationCircleIcon width={18} height={18} />
									</span>
									<span className="truncate">{t('draftRecovery.title')}</span>
									<DesktopAppStatusBadge
										className="ml-auto shrink-0 border-amber-400/30 bg-amber-500/18 text-amber-100"
										title={
											draftRecoverySource === 'manual'
												? t('draftRecovery.badgeManualTitle')
												: t('draftRecovery.badgeAutoTitle')
										}
									>
										{draftRecoverySource === 'manual'
											? t('draftRecovery.badgeManual')
											: t('draftRecovery.badgeAuto')}
									</DesktopAppStatusBadge>
								</div>
							}
							className="max-w-none"
						>
							<div className="space-y-4 p-4">
								<p className="text-sm text-(--desktop-text-secondary)">
									{t('draftRecovery.body')}
								</p>
								{draftConflict ? (
									<DesktopAppPanel className="space-y-1 border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs">
										<div className="font-semibold text-amber-100">
											{t('draftRecovery.conflictTitle')}
										</div>
										<div className="text-(--desktop-text-secondary)">
											{t('draftRecovery.conflictExternalUpdate', {
												date: new Date(
													draftConflict.incomingUpdatedAt
												).toLocaleString(dateLocale),
											})}
										</div>
										<div className="text-(--desktop-text-secondary)">
											{t('draftRecovery.conflictRevision', {
												rev: draftConflict.incomingRevision,
												session: draftConflict.incomingSessionId.slice(0, 8),
											})}
										</div>
									</DesktopAppPanel>
								) : null}
								<DesktopAppPanel className="space-y-1 px-3 py-2 text-sm">
									<div className="text-(--desktop-text-muted)">
										{t('draftRecovery.documentLabel')}{' '}
										<strong className="text-(--desktop-text-primary)">
											{draft.title ||
												fallbackDocumentTitle ||
												t('draftRecovery.untitled')}
										</strong>
									</div>
									<div className="text-(--desktop-text-muted)">
										{t('draftRecovery.draftLabel')}{' '}
										<strong className="text-(--desktop-text-primary)">
											{new Date(draft.updatedAt).toLocaleString(dateLocale)}
										</strong>
									</div>
								</DesktopAppPanel>
								{draftDiffPreview ? (
									<div className="space-y-2 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
										<div className="flex flex-wrap items-center gap-2 text-[11px] text-(--desktop-text-muted)">
											<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-panel)">
												{t('draftRecovery.serverStats', {
													words: draftDiffPreview.serverWords,
													chars: draftDiffPreview.serverChars,
												})}
											</DesktopAppStatusBadge>
											<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-panel)">
												{t('draftRecovery.localStats', {
													words: draftDiffPreview.localWords,
													chars: draftDiffPreview.localChars,
												})}
											</DesktopAppStatusBadge>
											{draftDiffPreview.hasChanges ? (
												<DesktopAppStatusBadge className="border-amber-400/30 bg-amber-500/15 text-amber-100">
													{t('draftRecovery.diffFromPosition', {
														n: draftDiffPreview.firstDiffIndex + 1,
													})}
												</DesktopAppStatusBadge>
											) : (
												<DesktopAppStatusBadge className="border-green-400/30 bg-green-500/15 text-green-100">
													{t('draftRecovery.versionsMatch')}
												</DesktopAppStatusBadge>
											)}
										</div>
										<div className="grid gap-2 md:grid-cols-2">
											<div className="min-h-28 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-2">
												<div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-(--desktop-text-dim)">
													{t('draftRecovery.columnServer')}
												</div>
												<div className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-(--desktop-text-secondary)">
													{draftDiffPreview.serverPreview}
												</div>
											</div>
											<div className="min-h-28 rounded-lg border border-amber-400/25 bg-amber-500/8 p-2">
												<div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-amber-100">
													{t('draftRecovery.columnLocalDraft')}
												</div>
												<div className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-(--desktop-text-secondary)">
													{draftDiffPreview.localPreview}
												</div>
											</div>
										</div>
									</div>
								) : null}
								<div className="flex flex-wrap items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onRequestClose}
									>
										{t('draftRecovery.keepCurrent')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="danger"
										size="sm"
										onClick={onDiscardDraft}
									>
										{t('draftRecovery.discardDraft')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										onClick={onRestoreDraft}
									>
										{t('draftRecovery.restoreDraft')}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};
