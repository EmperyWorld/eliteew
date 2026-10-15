/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin-only modal in GAF Chat to pick a desktop app visible to the chat partner and send
 * a validated app-link message (server builds metadata; no admin catalog API).
 *
 * Invariants:
 * - Shown only when caller is EliteEW admin; list endpoint returns 403 otherwise.
 * - Sends via POST `/gaf-chat/chats/{id}/messages/desktop-app-link` only.
 *
 * Related:
 * - gafChatApi.ts; GAFChatApp.tsx
 * - DesktopChromeTooltip.tsx
 */
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppModalFrame,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import {
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { cn } from '@/utils/cn';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactElement, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gafChatPartnerDesktopAppsQueryOptions } from '../gafChatQueryOptions';
import {
	sendDesktopAppLinkMessage,
	type GafPartnerDesktopAppOption,
} from '../api/gafChatApi';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export interface GafChatAdminAppLinkPickerProps {
	isOpen: boolean;
	chatId: string | null;
	onClose: () => void;
	onSent?: () => void;
}

export function GafChatAdminAppLinkPicker({
	isOpen,
	chatId,
	onClose,
	onSent,
}: GafChatAdminAppLinkPickerProps): ReactElement | null {
	const { t } = useTranslation('gafChat');
	const portalSurfaceRef = useRef<HTMLDivElement>(null);
	useSyncDesktopThemeFromMain(isOpen, portalSurfaceRef);
	const [query, setQuery] = useState('');
	const [note, setNote] = useState('');

	const enabled = isOpen && Boolean(chatId);
	const appsQuery = useQuery({
		...gafChatPartnerDesktopAppsQueryOptions(chatId ?? ''),
		enabled,
	});

	const sendMutation = useMutation({
		mutationFn: (app: GafPartnerDesktopAppOption) =>
			sendDesktopAppLinkMessage(
				chatId as string,
				app.app_id,
				note.trim() || undefined
			),
		onSuccess: () => {
			setNote('');
			setQuery('');
			onSent?.();
			onClose();
		},
	});

	const filtered = useMemo(() => {
		const apps = appsQuery.data ?? [];
		const q = query.trim().toLowerCase();
		if (!q) return apps;
		return apps.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				a.app_id.toLowerCase().includes(q) ||
				a.category.toLowerCase().includes(q)
		);
	}, [appsQuery.data, query]);

	if (!isOpen || !chatId || typeof document === 'undefined') return null;

	return (
		<ShellPortalMount>
			<div
				ref={portalSurfaceRef}
				className={cn(
					'fixed inset-0 flex items-center justify-center p-3 sm:p-4',
					'text-(--desktop-text-primary)',
					DESKTOP_OVERLAY.backdrop
				)}
				style={{ zIndex: DESKTOP_Z_INDEX.GAF_CONTENT_LIBRARY_BACKDROP }}
				role="presentation"
			>
				<button
					type="button"
					className="absolute inset-0 cursor-default border-0 bg-transparent"
					aria-label={t('adminAppLinkPickerClose')}
					onClick={onClose}
				/>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: stop backdrop close on panel click */}
				<div
					className="relative flex max-h-[min(92vh,720px)] w-full max-w-lg min-h-0 flex-col"
					style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_BASE }}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<DesktopAppModalFrame
						title={t('adminAppLinkPickerTitle')}
						onClose={onClose}
						closeLabel={t('adminAppLinkPickerClose')}
						className="flex max-h-[min(92vh,720px)] w-full flex-col shadow-(--desktop-shadow-panel)"
					>
						<div className="flex min-h-0 flex-col gap-3 p-4">
							<p
								className={cn(
									'text-(--desktop-text-secondary)',
									DESKTOP_TYPOGRAPHY.shellMeta10
								)}
							>
								{t('adminAppLinkPickerSubtitle')}
							</p>
							<label className="block">
								<span className="sr-only">
									{t('adminAppLinkPickerSearchAria')}
								</span>
								<div className="relative">
									<MagnifyingGlassIcon
										className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--desktop-text-muted)"
										aria-hidden
									/>
									<input
										type="search"
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder={t('adminAppLinkPickerSearchPlaceholder')}
										className={cn(
											'w-full rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 py-2 pr-3 pl-9 text-(--desktop-text-primary) outline-none focus:border-[rgb(var(--desktop-accent-rgb)/0.45)]',
											DESKTOP_TYPOGRAPHY.body
										)}
									/>
								</div>
							</label>
							<label className="block">
								<span
									className={cn(
										'mb-1 block text-(--desktop-text-secondary)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{t('adminAppLinkPickerNoteLabel')}
								</span>
								<textarea
									value={note}
									onChange={(e) => setNote(e.target.value.slice(0, 500))}
									rows={2}
									placeholder={t('adminAppLinkPickerNotePlaceholder')}
									className={cn(
										'w-full resize-none rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-3 py-2 text-(--desktop-text-primary) outline-none focus:border-[rgb(var(--desktop-accent-rgb)/0.45)]',
										DESKTOP_TYPOGRAPHY.body
									)}
								/>
							</label>
							<DesktopAppPanel className="min-h-48 max-h-[min(40vh,18rem)] overflow-y-auto p-1">
								{appsQuery.isLoading ? (
									<p
										className={cn(
											'p-3 text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.body
										)}
									>
										{t('adminAppLinkPickerLoading')}
									</p>
								) : appsQuery.isError ? (
									<DesktopAppEmptyState
										title={t('adminAppLinkPickerLoadError')}
										description={t('adminAppLinkPickerLoadErrorHint')}
									/>
								) : filtered.length === 0 ? (
									<DesktopAppEmptyState
										title={t('adminAppLinkPickerEmpty')}
										description={t('adminAppLinkPickerEmptyHint')}
									/>
								) : (
									<ul className="flex flex-col gap-1">
										{filtered.map((app) => (
											<li key={app.app_id}>
												<DesktopChromeTooltip
													content={app.name}
													placement="top"
													offsetExtra={4}
												>
													<DesktopAppButton
														type="button"
														variant="ghost"
														className="h-auto w-full justify-start px-3 py-2 text-left"
														disabled={sendMutation.isPending}
														onClick={() => sendMutation.mutate(app)}
													>
														<span className="block font-medium text-(--desktop-text-primary)">
															{app.name}
														</span>
														<span
															className={cn(
																'block text-(--desktop-text-muted)',
																DESKTOP_TYPOGRAPHY.shellMeta10
															)}
														>
															{app.category || app.app_id}
														</span>
													</DesktopAppButton>
												</DesktopChromeTooltip>
											</li>
										))}
									</ul>
								)}
							</DesktopAppPanel>
							{sendMutation.isError ? (
								<p className={cn('text-amber-400', DESKTOP_TYPOGRAPHY.body)}>
									{t('adminAppLinkPickerSendError')}
								</p>
							) : null}
						</div>
					</DesktopAppModalFrame>
				</div>
			</div>
		</ShellPortalMount>
	);
}
