/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-side command audit drawer (GET /api/v1/voice-commands/audit) — distinct from device journal.
 *
 * Related:
 * - `CommandHistoryPanel.tsx`, `desktopUi.voiceCommand.audit`
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api/client';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import {
	ClipboardDocumentListIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	auditStatusLabel,
	formatVoiceCommandDateTime,
} from '../utils/voiceCommandI18n';

interface AuditEntry {
	id: string;
	user_id: string;
	command_id: string;
	transcript: string;
	status: string;
	created_at: string;
}

interface VoiceAuditPanelProps {
	open: boolean;
	onClose: () => void;
}

export const VoiceAuditPanel: React.FC<VoiceAuditPanelProps> = ({
	open,
	onClose,
}) => {
	const { t, i18n } = useTranslation('desktopUi', {
		keyPrefix: 'voiceCommand',
	});
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [entries, setEntries] = useState<AuditEntry[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		api
			.get<AuditEntry[]>('/api/v1/voice-commands/audit?limit=50')
			.then((data) => setEntries(Array.isArray(data) ? data : []))
			.catch(() => setEntries([]))
			.finally(() => setLoading(false));
	}, [open]);

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className={`fixed inset-0 ${DESKTOP_OVERLAY.backdrop}`}
						style={{ zIndex: portalStackBase - 1 }}
						aria-hidden
					/>
					<motion.div
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ type: 'tween', duration: 0.2 }}
						className={`fixed bottom-0 right-0 top-0 flex w-full max-w-md flex-col border-l border-(--desktop-border-strong) shadow-(--desktop-shadow-panel) ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)] ${DESKTOP_OVERLAY.panelSurface}`}
						style={{ zIndex: portalStackBase }}
					>
						<div className="flex shrink-0 items-center justify-between border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_30%,transparent)] p-4 shadow-[inset_0_-1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]">
							<div className="flex min-w-0 flex-col gap-0.5">
								<div className="flex min-w-0 items-center gap-2.5">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--desktop-radius) bg-(--desktop-surface-accent) text-[rgb(var(--desktop-accent-rgb))] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.08)]">
										<ClipboardDocumentListIcon
											className="h-4 w-4"
											aria-hidden
										/>
									</div>
									<h2
										className={cn(
											DESKTOP_TYPOGRAPHY.subtitle,
											'truncate text-(--desktop-text-primary)'
										)}
									>
										{t('audit.title')}
									</h2>
								</div>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'pl-11 text-(--desktop-text-dim)'
									)}
								>
									{t('audit.subtitle')}
								</p>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								onClick={onClose}
								aria-label={t('actions.close')}
								className={cn(
									'shrink-0 transition-colors hover:bg-(--desktop-surface-soft-hover)',
									DESKTOP_INTERACTIVE.focusRing
								)}
							>
								<XMarkIcon className="h-5 w-5" />
							</DesktopAppButton>
						</div>
						<div className="flex-1 overflow-y-auto p-4">
							{loading ? (
								<div
									role="status"
									aria-busy="true"
									aria-label={t('audit.loadingAria')}
								>
									<p className="text-sm text-(--desktop-text-muted) antialiased">
										{t('audit.loading')}
									</p>
								</div>
							) : entries.length === 0 ? (
								<DesktopAppEmptyState
									className="py-6"
									icon={
										<ClipboardDocumentListIcon
											className="h-10 w-10 text-[rgb(var(--desktop-accent-rgb))]/75"
											aria-hidden
										/>
									}
									title={t('audit.emptyTitle')}
									description={t('audit.emptyDescription')}
								/>
							) : (
								<ul className="space-y-2">
									{entries.map((entry) => (
										<li
											key={entry.id}
											className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2 text-sm"
										>
											<div className="font-medium text-(--desktop-text-primary)">
												{entry.command_id}
											</div>
											<div className={cn('truncate', DESKTOP_TYPOGRAPHY.meta)}>
												"{entry.transcript}"
											</div>
											<div className="mt-1 flex items-center gap-2">
												<span
													className={`rounded px-1.5 py-0.5 text-xs ${
														entry.status === 'success'
															? 'border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent)/40 text-(--desktop-text-primary)'
															: entry.status === 'cancelled'
																? 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
																: 'border border-[color-mix(in_srgb,rgb(239_68_68)_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_76%,rgb(239_68_68)_24%)] text-(--desktop-text-primary)'
													}`}
												>
													{auditStatusLabel(entry.status, t)}
												</span>
												<span className="text-xs text-(--desktop-text-dim)">
													{formatVoiceCommandDateTime(
														entry.created_at,
														i18n.language
													)}
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};

export default VoiceAuditPanel;
