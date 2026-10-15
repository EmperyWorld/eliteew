/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command journal drawer: recent voice commands with replay/undo and local-only affordances.
 *
 * Invariants:
 * - Row context menu mounts via ShellPortalMount (no createPortal(document.body)).
 *
 * Related:
 * - `useVoiceCommandHistory.ts`, `desktopUi.voiceCommand.history`
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import {
	DesktopAppButton,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
	DesktopAppModalFrame,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { getFloatingMenuPosition } from '@/pages/Desktop/utils/desktopUi';
import { cn } from '@/utils/cn';
import { MAX_PERSISTED_HISTORY } from '../types';
import {
	formatVoiceCommandTime,
	historyStatusLabel,
	type HistoryStatus,
} from '../utils/voiceCommandI18n';
import {
	ArrowUturnLeftIcon,
	CheckCircleIcon,
	ClockIcon,
	DocumentDuplicateIcon,
	HashtagIcon,
	MinusCircleIcon,
	TrashIcon,
	XCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export interface CommandHistoryItem {
	id: string;
	transcript: string;
	status: HistoryStatus;
	responseText?: string;
	timestamp: Date;
	commandId?: string;
	params?: Record<string, string>;
}

interface CommandHistoryPanelProps {
	open: boolean;
	onClose: () => void;
	items: CommandHistoryItem[];
	showLocalOnlyBanner?: boolean;
	showSaveFailed?: boolean;
	onReplay?: (item: CommandHistoryItem) => void;
	onUndo?: (item: CommandHistoryItem) => void;
	onClearJournal?: () => void;
	isReversible?: (commandId: string) => boolean;
}

const statusIcon = {
	success: CheckCircleIcon,
	error: XCircleIcon,
	cancelled: MinusCircleIcon,
} as const;

const statusClassName = {
	success:
		'border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent)/40 text-(--desktop-text-primary)',
	error:
		'border-[color-mix(in_srgb,rgb(239_68_68)_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_76%,rgb(239_68_68)_24%)] text-(--desktop-text-primary)',
	cancelled:
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
} as const;

const sw = DESKTOP_LUCIDE.stroke;

async function copyTextToClipboard(text: string): Promise<void> {
	if (
		!text ||
		typeof navigator === 'undefined' ||
		!navigator.clipboard?.writeText
	) {
		return;
	}
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		/* ignore */
	}
}

export const CommandHistoryPanel: React.FC<CommandHistoryPanelProps> = ({
	open,
	onClose,
	items,
	showLocalOnlyBanner = false,
	showSaveFailed = false,
	onReplay,
	onUndo,
	onClearJournal,
	isReversible: isReversibleFn,
}) => {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'voiceCommand' });
	const { t: tWorkspace } = useTranslation('desktopUi', {
		keyPrefix: 'workspace',
	});
	const { i18n } = useTranslation();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [rowMenu, setRowMenu] = React.useState<{
		item: CommandHistoryItem;
		clientX: number;
		clientY: number;
	} | null>(null);
	const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
	const rowMenuRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (!rowMenu) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setRowMenu(null);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [rowMenu]);

	React.useEffect(() => {
		if (!rowMenu) return;
		const onMouseDown = (e: MouseEvent) => {
			const el = rowMenuRef.current;
			const target = e.target;
			if (el && target instanceof globalThis.Node && !el.contains(target)) {
				setRowMenu(null);
			}
		};
		document.addEventListener('mousedown', onMouseDown, true);
		return () => document.removeEventListener('mousedown', onMouseDown, true);
	}, [rowMenu]);

	React.useEffect(() => {
		if (!open) {
			setRowMenu(null);
			setClearConfirmOpen(false);
		}
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
						role="dialog"
						aria-modal="true"
						aria-labelledby="vcc-history-title"
						className={cn(
							'fixed bottom-0 right-0 top-0 flex w-full max-w-md flex-col border-l border-(--desktop-border-strong) shadow-(--desktop-shadow-panel) ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)]',
							DESKTOP_OVERLAY.panelSurface
						)}
						style={{ zIndex: portalStackBase }}
					>
						<div className="flex shrink-0 items-center justify-between border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_30%,transparent)] p-4 shadow-[inset_0_-1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]">
							<div className="flex min-w-0 flex-col gap-0.5">
								<div className="flex min-w-0 items-center gap-2.5">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--desktop-radius) bg-(--desktop-surface-accent) text-[rgb(var(--desktop-accent-rgb))] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.08)]">
										<ClockIcon
											className="h-4 w-4"
											strokeWidth={sw}
											aria-hidden
										/>
									</div>
									<h2
										id="vcc-history-title"
										className={cn(
											DESKTOP_TYPOGRAPHY.subtitle,
											'truncate text-(--desktop-text-primary)'
										)}
									>
										{t('history.title')}
									</h2>
								</div>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'pl-11 text-(--desktop-text-dim)'
									)}
								>
									{t('history.subtitle', { count: MAX_PERSISTED_HISTORY })}
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
								<XMarkIcon className="h-5 w-5" strokeWidth={sw} />
							</DesktopAppButton>
						</div>
						<div
							className="flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-color:color-mix(in_srgb,var(--desktop-text-primary)_20%,transparent)_transparent] scrollbar-thin"
							data-local-only={showLocalOnlyBanner ? 'true' : undefined}
						>
							{showLocalOnlyBanner ? (
								<div
									className="space-y-0.5"
									data-local-only="true"
									role="status"
								>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'text-(--desktop-text-dim)'
										)}
									>
										{tWorkspace('localOnlyHint')}
									</p>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'text-(--desktop-text-dim)'
										)}
									>
										{tWorkspace('localOnlyVoiceDetail')}
									</p>
								</div>
							) : null}
							{showSaveFailed ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'text-[color-mix(in_srgb,rgb(245_158_11)_88%,var(--desktop-text-primary))]'
									)}
									role="status"
								>
									{t('history.saveFailed')}
								</p>
							) : null}
							{items.length === 0 ? (
								<p
									className={cn(
										'py-10 text-center',
										DESKTOP_TYPOGRAPHY.body,
										'text-(--desktop-text-muted)'
									)}
								>
									{t('history.empty')}
								</p>
							) : (
								items.map((item) => {
									const Icon = statusIcon[item.status];
									const canReplay = Boolean(
										onReplay && (item.commandId || item.transcript)
									);
									const cmdId = item.commandId;
									const canUndoRow =
										Boolean(onUndo) &&
										item.status === 'success' &&
										typeof cmdId === 'string' &&
										Boolean(isReversibleFn?.(cmdId));
									return (
										// biome-ignore lint/a11y/noStaticElementInteractions: context menu on command row (RMB); nested action buttons forbid a single wrapping <button>.
										<div
											key={item.id}
											className="space-y-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)] p-3 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]"
											onContextMenu={(e) => {
												e.preventDefault();
												setRowMenu({
													item,
													clientX: e.clientX,
													clientY: e.clientY,
												});
											}}
										>
											<p
												className={cn(
													'text-sm font-medium text-(--desktop-text-primary) antialiased'
												)}
											>
												«{item.transcript}»
											</p>
											<div className="flex flex-wrap items-center gap-2">
												<span
													className={cn(
														'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
														statusClassName[item.status]
													)}
												>
													<Icon className="h-3.5 w-3.5" strokeWidth={sw} />
													{historyStatusLabel(item.status, t)}
												</span>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.small,
														'text-(--desktop-text-dim) tabular-nums'
													)}
												>
													{formatVoiceCommandTime(
														item.timestamp,
														i18n.language,
														{
															hour: '2-digit',
															minute: '2-digit',
															second: '2-digit',
														}
													)}
												</span>
											</div>
											{item.responseText && (
												<p
													className={cn(
														DESKTOP_TYPOGRAPHY.small,
														'line-clamp-2 text-(--desktop-text-muted)'
													)}
												>
													{item.responseText}
												</p>
											)}
											<div className="mt-1 flex flex-wrap gap-2">
												{onReplay && canReplay && (
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => onReplay(item)}
														className={cn(
															'inline-flex items-center gap-1 rounded-(--desktop-radius) px-2 py-1 text-xs text-(--desktop-text-secondary) transition-colors hover:bg-(--desktop-surface-soft-hover)',
															DESKTOP_INTERACTIVE.focusRing
														)}
													>
														<ArrowUturnLeftIcon
															className="h-3.5 w-3.5"
															strokeWidth={sw}
														/>
														{t('history.replay')}
													</DesktopAppButton>
												)}
												{onUndo && canUndoRow && (
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => onUndo(item)}
														className={cn(
															'inline-flex items-center gap-1 rounded-(--desktop-radius) border border-[color-mix(in_srgb,rgb(245_158_11)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(245_158_11)_12%)] px-2 py-1 text-xs text-(--desktop-text-primary) transition-colors hover:bg-[color-mix(in_srgb,var(--desktop-surface-soft-hover)_82%,rgb(245_158_11)_18%)]',
															DESKTOP_INTERACTIVE.focusRing
														)}
													>
														<ArrowUturnLeftIcon
															className="h-3.5 w-3.5"
															strokeWidth={sw}
														/>
														{t('history.undo')}
													</DesktopAppButton>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>
						{onClearJournal && items.length > 0 ? (
							<div className="shrink-0 border-t border-(--desktop-border-subtle) p-4">
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setClearConfirmOpen(true)}
									className="inline-flex w-full items-center justify-center gap-2 text-(--desktop-text-muted) hover:text-(--desktop-text-primary)"
								>
									<TrashIcon className="h-4 w-4" strokeWidth={sw} />
									{t('history.clearJournal')}
								</DesktopAppButton>
							</div>
						) : null}
					</motion.div>
				</>
			)}
			{clearConfirmOpen ? (
				<DesktopAppModalFrame
					title={t('confirm.clearJournalTitle')}
					onClose={() => setClearConfirmOpen(false)}
					className="max-w-md"
				>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('confirm.clearJournalBody')}
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setClearConfirmOpen(false)}
						>
							{t('confirm.cancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							onClick={() => {
								onClearJournal?.();
								setClearConfirmOpen(false);
							}}
						>
							{t('confirm.clearJournalConfirm')}
						</DesktopAppButton>
					</div>
				</DesktopAppModalFrame>
			) : null}
			{rowMenu ? (
				<ShellPortalMount>
					<div
						ref={rowMenuRef}
						role="menu"
						className="fixed text-(--desktop-text-primary)"
						style={{
							left: getFloatingMenuPosition(
								{ x: rowMenu.clientX, y: rowMenu.clientY },
								{ menuWidth: 240, menuHeight: 220 }
							).x,
							top: getFloatingMenuPosition(
								{ x: rowMenu.clientX, y: rowMenu.clientY },
								{ menuWidth: 240, menuHeight: 220 }
							).y,
							zIndex:
								portalStackBase +
								DESKTOP_PORTAL_STACK_BUMP.COMMAND_HISTORY_ROW_CONTEXT_MENU,
						}}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<DesktopAppMenuSurface className="min-w-52">
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								icon={
									<DocumentDuplicateIcon
										className="h-4 w-4"
										strokeWidth={sw}
										aria-hidden
									/>
								}
								className={DESKTOP_INTERACTIVE.focusRing}
								onClick={() => {
									void copyTextToClipboard(rowMenu.item.transcript);
									setRowMenu(null);
								}}
							>
								{t('history.copyPhrase')}
							</DesktopAppMenuItem>
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								icon={
									<HashtagIcon
										className="h-4 w-4"
										strokeWidth={sw}
										aria-hidden
									/>
								}
								className={DESKTOP_INTERACTIVE.focusRing}
								onClick={() => {
									void copyTextToClipboard(rowMenu.item.id);
									setRowMenu(null);
								}}
							>
								{t('history.copyEntryId')}
							</DesktopAppMenuItem>
							{rowMenu.item.responseText ? (
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									icon={
										<DocumentDuplicateIcon
											className="h-4 w-4"
											strokeWidth={sw}
											aria-hidden
										/>
									}
									className={DESKTOP_INTERACTIVE.focusRing}
									onClick={() => {
										const text = rowMenu.item.responseText;
										if (text) void copyTextToClipboard(text);
										setRowMenu(null);
									}}
								>
									{t('history.copyResponse')}
								</DesktopAppMenuItem>
							) : null}
							{onReplay &&
							(rowMenu.item.commandId || rowMenu.item.transcript) ? (
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									icon={
										<ArrowUturnLeftIcon
											className="h-4 w-4"
											strokeWidth={sw}
											aria-hidden
										/>
									}
									className={DESKTOP_INTERACTIVE.focusRing}
									onClick={() => {
										onReplay(rowMenu.item);
										setRowMenu(null);
									}}
								>
									{t('history.replay')}
								</DesktopAppMenuItem>
							) : null}
							{onUndo &&
							rowMenu.item.status === 'success' &&
							rowMenu.item.commandId &&
							isReversibleFn?.(rowMenu.item.commandId) ? (
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									icon={
										<ArrowUturnLeftIcon
											className="h-4 w-4"
											strokeWidth={sw}
											aria-hidden
										/>
									}
									className={DESKTOP_INTERACTIVE.focusRing}
									onClick={() => {
										onUndo(rowMenu.item);
										setRowMenu(null);
									}}
								>
									{t('history.undo')}
								</DesktopAppMenuItem>
							) : null}
						</DesktopAppMenuSurface>
					</div>
				</ShellPortalMount>
			) : null}
		</AnimatePresence>
	);
};

export default CommandHistoryPanel;
