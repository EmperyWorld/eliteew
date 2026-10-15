/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared toolbar for Users catalog (presets, share link, refresh).
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	BookmarkIcon,
	LinkIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { AdminUsersNamedPreset } from '../adminUsersFilterPresets';
import { AdminButton, AdminSelect } from '../ui';

export interface AdminUsersCatalogToolbarProps {
	namedPresets: AdminUsersNamedPreset[];
	selectedPresetId: string;
	onPresetSelect: (id: string) => void;
	onDeletePreset: () => void;
	onSavePreset: () => void;
	onCopyShareLink: () => void;
	onRefresh: () => void;
	loading: boolean;
}

export function AdminUsersCatalogToolbar({
	namedPresets,
	selectedPresetId,
	onPresetSelect,
	onDeletePreset,
	onSavePreset,
	onCopyShareLink,
	onRefresh,
	loading,
}: AdminUsersCatalogToolbarProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	return (
		<div className="eliteew-admin-users-toolbar flex flex-wrap items-center gap-2">
			{namedPresets.length > 0 ? (
				<div className="flex min-w-44 items-center gap-1">
					<AdminSelect
						value={selectedPresetId}
						onChange={(e) => onPresetSelect(e.target.value)}
						className="text-xs min-w-36 py-1"
						aria-label={t('adminUsersHub.toolbar.presetsAria')}
					>
						<option value="">
							{t('adminUsersHub.toolbar.presetsPlaceholder')}
						</option>
						{namedPresets.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</AdminSelect>
					{selectedPresetId ? (
						<AdminButton
							variant="ghost"
							onClick={onDeletePreset}
							className="p-1.5 text-[var(--admin-ui-status-danger)] hover:bg-[var(--admin-ui-status-danger-bg)]"
							title={t('adminUsersHub.toolbar.deletePreset')}
							aria-label={t('adminUsersHub.toolbar.deletePreset')}
						>
							<TrashIcon className="h-4 w-4" />
						</AdminButton>
					) : null}
				</div>
			) : null}
			<AdminButton
				variant="secondary"
				onClick={onSavePreset}
				className="rounded-full px-3 py-1 text-xs"
			>
				<BookmarkIcon className="h-3.5 w-3.5" aria-hidden />
				{t('adminUsersHub.toolbar.savePreset')}
			</AdminButton>
			<AdminButton
				variant="secondary"
				onClick={onCopyShareLink}
				className="rounded-full px-3 py-1 text-xs"
				title={t('adminUsersHub.toolbar.shareLinkTitle')}
			>
				<LinkIcon className="h-3.5 w-3.5" aria-hidden />
				{t('adminUsersHub.toolbar.shareLink')}
			</AdminButton>
			<AdminButton
				variant="secondary"
				onClick={onRefresh}
				disabled={loading}
				className="rounded-full px-3 py-1 text-xs"
			>
				<ArrowPathIcon
					className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
					aria-hidden
				/>
				{t('adminUsersHub.toolbar.refresh')}
			</AdminButton>
			<span className="text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)] hidden sm:inline">
				<span className="kbd-hint rounded border border-[var(--admin-ui-border)] px-1">
					/
				</span>{' '}
				{t('adminUsersHub.toolbar.searchShortcut')}
			</span>
		</div>
	);
}
