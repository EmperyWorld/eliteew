/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Header chrome for admin user detail panel: avatar, identity, clipboard actions, and close.
 *
 * Invariants:
 * - Diagnostic report includes SSO history when available; no tokens exposed.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/adminUserDetail/AdminUserDetailPanel.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	ArrowTopRightOnSquareIcon,
	ClipboardDocumentIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { SecureAvatar } from '../../../components/profile/SecureAvatar';
import { keycloakUsersConsoleSearchUrl } from '../adminKeycloakConsole';
import { buildAdminUserDiagnosticReport } from '../adminUserDiagnosticReport';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { primaryName } from '../users/adminUsersFormatters';
import { AdminButton } from '../ui';
import type { AdminUserDetailPanelViewModel } from './useAdminUserDetailPanel';

const uiSubtitle =
	'text-[length:var(--admin-ui-text-md)] font-semibold text-[var(--admin-ui-fg)]';
const uiMeta =
	'text-[length:var(--admin-ui-text-xs)] text-[var(--admin-ui-fg-muted)]';

type AdminUserDetailPanelHeaderProps = {
	userRow: AdminDirectoryUserRow;
	t: TFunction<'desktopUi'>;
	onClose: () => void;
	ssoHistory: AdminUserDetailPanelViewModel['ssoOverview']['data'] extends infer D
		? D extends { history?: infer H }
			? H
			: undefined
		: undefined;
};

export function AdminUserDetailPanelHeader({
	userRow,
	t,
	onClose,
	ssoHistory,
}: AdminUserDetailPanelHeaderProps): React.ReactElement {
	return (
		<div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-4">
			<div className="flex min-w-0 items-center gap-3">
				<SecureAvatar
					avatarUrl={userRow.avatar_url?.trim() || null}
					alt=""
					className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
				/>
				<div className="min-w-0">
					<h2 id="admin-user-panel-title" className={`${uiSubtitle} truncate`}>
						{primaryName(userRow)}
					</h2>
					<p className={`${uiMeta} truncate`}>{userRow.email}</p>
					<div className="mt-1 flex flex-wrap gap-1">
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-white/10"
							onClick={() => {
								void navigator.clipboard
									.writeText(userRow.id)
									.then(() =>
										toast.success(t('adminUserDetail.clipboard.idCopied'))
									)
									.catch(() =>
										toast.error(t('adminUserDetail.clipboard.failed'))
									);
							}}
						>
							<ClipboardDocumentIcon className="h-3 w-3" aria-hidden />
							{t('adminUserDetail.actions.copyId')}
						</button>
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-white/10"
							onClick={() => {
								void navigator.clipboard
									.writeText(userRow.email)
									.then(() =>
										toast.success(t('adminUserDetail.clipboard.emailCopied'))
									)
									.catch(() =>
										toast.error(t('adminUserDetail.clipboard.failed'))
									);
							}}
						>
							<ClipboardDocumentIcon className="h-3 w-3" aria-hidden />
							{t('adminUserDetail.actions.copyEmail')}
						</button>
						<a
							href={keycloakUsersConsoleSearchUrl(userRow.email)}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100/90 hover:bg-amber-500/15"
						>
							<ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden />
							{t('adminUserDetail.actions.keycloak')}
						</a>
						<button
							type="button"
							className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-white/10"
							onClick={() => {
								const text = buildAdminUserDiagnosticReport(userRow, t, {
									ssoHistory,
								});
								void navigator.clipboard
									.writeText(text)
									.then(() =>
										toast.success(t('adminUserDetail.clipboard.reportCopied'))
									)
									.catch(() =>
										toast.error(t('adminUserDetail.clipboard.failed'))
									);
							}}
						>
							<ClipboardDocumentIcon className="h-3 w-3" aria-hidden />
							{t('adminUserDetail.actions.copyReport')}
						</button>
					</div>
				</div>
			</div>
			<AdminButton
				variant="ghost"
				onClick={onClose}
				className="shrink-0 p-2"
				aria-label={t('adminUserDetail.close')}
			>
				<XMarkIcon className="h-5 w-5" />
			</AdminButton>
		</div>
	);
}
