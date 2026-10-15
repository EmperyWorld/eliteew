/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin live Socket.IO presence list with reload/logout commands (Redis-backed).
 *
 * Invariants:
 * - Commands deliver only when target user has an active Socket.IO session.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx` (embedded tab)
 * - `services/admin/api.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SecureAvatar } from '../../components/profile/SecureAvatar';
import { APIError } from '../../services/api/client';
import { adminApi } from '../../services/admin/api';
import { log } from '../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../Desktop/context/DesktopWindowPortalStackContext';
import {
	ArrowPathIcon,
	ArrowRightStartOnRectangleIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';
import { adminUserRoleLabelI18n } from './adminUserRolesI18n';

type PresenceUser = {
	user_id: string;
	email?: string | null;
	display_name?: string | null;
	full_name?: string | null;
	username?: string | null;
	avatar_url?: string | null;
	role?: string | null;
	is_active?: boolean | null;
	last_login_at?: string | null;
	connected_at?: string | null;
	last_seen_at?: string | null;
	sessions: number;
};

function formatDt(iso: string | null | undefined): string {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function primaryName(u: PresenceUser): string {
	const n = (u.full_name || u.display_name || '').trim();
	if (n) return n;
	if (u.username?.trim()) return u.username.trim();
	return u.email?.trim() || '—';
}

type PendingCommand = {
	userId: string;
	action: 'logout' | 'reload';
	label: string;
};

export function PresenceCommandModal({
	open,
	pending,
	onCancel,
	onConfirm,
	confirmBusy,
}: {
	open: boolean;
	pending: PendingCommand | null;
	onCancel: () => void;
	onConfirm: () => void;
	confirmBusy: boolean;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	const dialogRef = React.useRef<HTMLDivElement>(null);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	/** Выше обычной embedded-модалки (например slide-over `AdminUserDetailPanel`). */
	const presenceModalZ = React.useMemo(
		() => ({
			backdrop: embeddedModalZ.content + 1,
			content: embeddedModalZ.content + 2,
		}),
		[embeddedModalZ]
	);

	React.useEffect(() => {
		if (!open) return;
		const el = dialogRef.current;
		const focusable = el?.querySelector<HTMLElement>(
			'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		focusable?.focus();
	}, [open]);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCancel();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onCancel]);

	if (!open || !pending) return null;

	const isLogout = pending.action === 'logout';
	const title = isLogout
		? t('adminPresence.logoutTitle')
		: t('adminPresence.reloadTitle');
	const body = isLogout
		? t('adminPresence.logoutBody')
		: t('adminPresence.reloadBody');

	return (
		<div
			className="fixed inset-0 flex items-center justify-center p-4"
			style={{ zIndex: presenceModalZ.backdrop }}
			role="presentation"
		>
			<button
				type="button"
				className={`absolute inset-0 ${DESKTOP_OVERLAY.backdrop}`}
				onClick={onCancel}
				aria-label={t('adminPresence.close')}
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="presence-cmd-title"
				className={`relative w-full max-w-md ${DESKTOP_SURFACE.radiusLg} ${DESKTOP_SURFACE.border} bg-slate-900 p-6 shadow-xl`}
				style={{ zIndex: presenceModalZ.content }}
			>
				<h3
					id="presence-cmd-title"
					className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white`}
				>
					{title}
				</h3>
				<p className={`${DESKTOP_TYPOGRAPHY.body} mb-2 text-slate-300`}>
					<span className="font-medium text-white">{pending.label}</span>
				</p>
				<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-6 text-slate-400`}>
					{body}
				</p>
				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						disabled={confirmBusy}
						className={`px-4 py-2 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} border border-white/15 bg-white/5 text-slate-200 text-sm hover:bg-white/10 disabled:opacity-50`}
					>
						{t('adminPresence.cancel')}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={confirmBusy}
						className={`inline-flex items-center gap-2 px-4 py-2 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-sm text-white disabled:opacity-50 ${
							isLogout
								? 'bg-amber-600/90 hover:bg-amber-600'
								: 'bg-violet-600/90 hover:bg-violet-600'
						}`}
					>
						{confirmBusy ? (
							<ArrowPathIcon
								className="w-4 h-4 animate-spin shrink-0"
								aria-hidden
							/>
						) : null}
						{isLogout
							? t('adminPresence.confirmLogout')
							: t('adminPresence.confirmReload')}
					</button>
				</div>
			</div>
		</div>
	);
}

export type AdminPresenceSectionProps = {
	/** Встроенная вкладка в Users hub — без отдельного заголовка страницы. */
	embedded?: boolean;
	/** Открыть пользователя в каталоге (поиск по ID + карточка). */
	onOpenInCatalog?: (userId: string) => void;
};

export function AdminPresenceSection({
	embedded = false,
	onOpenInCatalog,
}: AdminPresenceSectionProps = {}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [redisAvailable, setRedisAvailable] = React.useState<boolean | null>(
		null
	);
	const [users, setUsers] = React.useState<PresenceUser[]>([]);
	const [pending, setPending] = React.useState<PendingCommand | null>(null);
	const [confirmBusy, setConfirmBusy] = React.useState(false);
	const [rowBusy, setRowBusy] = React.useState<{
		userId: string;
		action: 'logout' | 'reload';
	} | null>(null);

	const load = React.useCallback(async () => {
		setError(null);
		setLoading(true);
		try {
			const res = await adminApi.getPresenceOnline();
			setRedisAvailable(res.redis_available);
			setUsers(res.users ?? []);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			setError(msg);
			log.error(
				'AdminPresenceSection',
				'load failed',
				e instanceof Error ? e : undefined
			);
		} finally {
			setLoading(false);
		}
	}, []);

	const runConfirmedCommand = React.useCallback(async () => {
		if (!pending) return;
		const { userId, action } = pending;
		setConfirmBusy(true);
		setRowBusy({ userId, action });
		try {
			const r = await adminApi.postPresenceCommand({ user_id: userId, action });
			setPending(null);
			if (r.delivered === 0) {
				toast.warning(t('adminPresence.commandNotDelivered'), {
					description: t('adminPresence.presenceNotDeliveredListDesc'),
				});
			} else {
				toast.success(t('adminPresence.commandSent'), {
					description: t('adminPresence.deliveredCount', {
						count: r.delivered,
					}),
				});
			}
			void load();
		} catch (e) {
			const msg =
				e instanceof APIError
					? e.message
					: e instanceof Error
						? e.message
						: String(e);
			toast.error(t('adminPresence.commandFailed'), { description: msg });
		} finally {
			setConfirmBusy(false);
			setRowBusy(null);
		}
	}, [pending, load, t]);

	React.useEffect(() => {
		void load();
		const t = window.setInterval(() => void load(), 30_000);
		return () => window.clearInterval(t);
	}, [load]);

	const isRowBusy = (u: PresenceUser) =>
		rowBusy !== null && rowBusy.userId === u.user_id;

	const rootClass = embedded ? 'max-w-full' : 'p-8 max-w-6xl';

	return (
		<div className={rootClass}>
			<PresenceCommandModal
				open={pending !== null}
				pending={pending}
				onCancel={() => {
					if (!confirmBusy) setPending(null);
				}}
				onConfirm={() => void runConfirmedCommand()}
				confirmBusy={confirmBusy}
			/>

			{!embedded ? (
				<>
					<div className="flex flex-wrap items-center gap-4 mb-6">
						<div className="flex items-center gap-2 min-w-0">
							<UsersIcon
								className="w-7 h-7 text-violet-400 shrink-0"
								aria-hidden
							/>
							<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
								{t('adminPresence.title')}
							</h2>
						</div>
						<button
							type="button"
							onClick={() => void load()}
							disabled={loading}
							className={`inline-flex items-center gap-2 px-3 py-1.5 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-slate-300 text-sm border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50`}
						>
							<ArrowPathIcon
								className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
								aria-hidden
							/>
							{t('adminPresence.refreshList')}
						</button>
					</div>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-6 text-slate-400`}>
						{t('adminPresence.intro')}
					</p>
				</>
			) : (
				<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
					<p className={`${DESKTOP_TYPOGRAPHY.meta} text-slate-400 max-w-2xl`}>
						{t('adminPresence.embeddedIntro')}
					</p>
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className={`inline-flex items-center gap-2 px-3 py-1.5 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-slate-300 text-sm border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50`}
					>
						<ArrowPathIcon
							className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
							aria-hidden
						/>
						{t('adminPresence.refresh')}
					</button>
				</div>
			)}

			{redisAvailable === false && (
				<div
					className={`mb-6 p-4 ${DESKTOP_SURFACE.radius} border border-amber-500/30 bg-amber-500/10 ${DESKTOP_TYPOGRAPHY.body}`}
					role="status"
				>
					{t('adminPresence.redisDown')}
				</div>
			)}

			{error && (
				<div
					className={`mb-6 p-4 ${DESKTOP_SURFACE.radius} border border-red-500/30 bg-red-500/10 text-red-200 ${DESKTOP_TYPOGRAPHY.body}`}
				>
					{error}
				</div>
			)}

			<div
				className={`${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} overflow-hidden bg-slate-900/40`}
			>
				{loading && users.length === 0 ? (
					<div className={`p-8 text-center ${DESKTOP_TYPOGRAPHY.meta}`}>
						{t('adminPresence.loading')}
					</div>
				) : users.length === 0 ? (
					<div
						className={`p-8 text-center ${DESKTOP_TYPOGRAPHY.meta} text-slate-500`}
					>
						{t('adminPresence.empty')}
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-6xl text-left text-sm">
							<thead>
								<tr className="border-b border-white/10 bg-slate-900/80">
									<th
										className={`p-3 pl-4 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colUser')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colEmail')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colRole')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colSessions')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colConnected')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colActivity')}
									</th>
									<th
										className={`p-3 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colLastLogin')}
									</th>
									<th
										className={`p-3 pr-4 ${DESKTOP_TYPOGRAPHY.caption} text-slate-400`}
									>
										{t('adminPresence.colActions')}
									</th>
								</tr>
							</thead>
							<tbody>
								{users.map((u) => (
									<tr
										key={u.user_id}
										className="border-b border-white/5 hover:bg-white/3"
									>
										<td className="p-3 pl-4 align-middle">
											<div className="flex items-center gap-3 min-w-0 max-w-[20rem]">
												<SecureAvatar
													avatarUrl={u.avatar_url?.trim() || null}
													alt={t('adminPresence.avatarAlt', {
														name: primaryName(u),
													})}
													className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
												/>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2 min-w-0">
														<span
															className={`${DESKTOP_TYPOGRAPHY.body} font-medium truncate`}
															title={primaryName(u)}
														>
															{primaryName(u)}
														</span>
														<span
															className="h-2 w-2 shrink-0 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
															title={t('adminPresence.onlineBadge')}
															aria-hidden
														/>
													</div>
													{u.username ? (
														<div
															className={`${DESKTOP_TYPOGRAPHY.meta} text-slate-500 truncate`}
														>
															@{u.username}
														</div>
													) : null}
													<div
														className={`${DESKTOP_TYPOGRAPHY.small} text-slate-600 truncate font-mono`}
														title={u.user_id}
													>
														{u.user_id}
													</div>
												</div>
											</div>
										</td>
										<td
											className={`p-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-300 align-middle max-w-48`}
										>
											<span
												className="truncate block"
												title={u.email ?? undefined}
											>
												{u.email ?? '—'}
											</span>
										</td>
										<td className="p-3 align-middle">
											<div className="flex flex-col gap-1">
												<span
													className={`inline-flex w-fit rounded-md border border-white/10 bg-white/5 px-2 py-0.5 ${DESKTOP_TYPOGRAPHY.small}`}
												>
													{adminUserRoleLabelI18n(u.role, t)}
												</span>
												{u.is_active === false ? (
													<span className="text-amber-300/90 text-xs">
														{t('adminPresence.accountDisabled')}
													</span>
												) : null}
											</div>
										</td>
										<td
											className={`p-3 ${DESKTOP_TYPOGRAPHY.meta} align-middle`}
										>
											{u.sessions}
										</td>
										<td
											className={`p-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-400 align-middle whitespace-nowrap`}
										>
											{formatDt(u.connected_at)}
										</td>
										<td
											className={`p-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-400 align-middle whitespace-nowrap`}
										>
											{formatDt(u.last_seen_at)}
										</td>
										<td
											className={`p-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-400 align-middle whitespace-nowrap`}
										>
											{formatDt(u.last_login_at)}
										</td>
										<td className="p-3 pr-4 align-middle">
											<div className="flex flex-wrap gap-1.5 justify-end">
												{onOpenInCatalog ? (
													<button
														type="button"
														disabled={isRowBusy(u)}
														onClick={() => onOpenInCatalog(u.user_id)}
														className={`inline-flex items-center gap-1 px-2 py-1 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-xs text-violet-100 border border-violet-500/35 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-40`}
														title={t('adminPresence.openCatalogTitle')}
													>
														{t('adminPresence.openCatalog')}
													</button>
												) : null}
												<button
													type="button"
													disabled={isRowBusy(u)}
													onClick={() =>
														setPending({
															userId: u.user_id,
															action: 'reload',
															label: primaryName(u),
														})
													}
													className={`inline-flex items-center gap-1 px-2 py-1 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-xs text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40`}
													title={t('adminPresence.reloadRowTitle')}
												>
													{isRowBusy(u) && rowBusy?.action === 'reload' ? (
														<ArrowPathIcon
															className="w-3.5 h-3.5 shrink-0 animate-spin"
															aria-hidden
														/>
													) : (
														<ArrowPathIcon
															className="w-3.5 h-3.5 shrink-0"
															aria-hidden
														/>
													)}
													{t('adminPresence.reloadRow')}
												</button>
												<button
													type="button"
													disabled={isRowBusy(u)}
													onClick={() =>
														setPending({
															userId: u.user_id,
															action: 'logout',
															label: primaryName(u),
														})
													}
													className={`inline-flex items-center gap-1 px-2 py-1 ${DESKTOP_SURFACE.radius} ${DESKTOP_INTERACTIVE.btnRounded} text-xs text-amber-100 border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40`}
													title={t('adminPresence.logoutRowTitle')}
												>
													{isRowBusy(u) && rowBusy?.action === 'logout' ? (
														<ArrowPathIcon
															className="w-3.5 h-3.5 shrink-0 animate-spin"
															aria-hidden
														/>
													) : (
														<ArrowRightStartOnRectangleIcon
															className="w-3.5 h-3.5 shrink-0"
															aria-hidden
														/>
													)}
													{t('adminPresence.logoutRow')}
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<p
							className={`px-4 py-3 border-t border-white/5 ${DESKTOP_TYPOGRAPHY.small} text-slate-500`}
						>
							{t('adminPresence.footerHint')}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
