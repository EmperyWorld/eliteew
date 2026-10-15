/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Removable filter chips row for admin Users catalog (i18n labels).
 *
 * Invariants:
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { TFunction } from 'i18next';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import type { AdminUsersFilterChipDef } from '../adminUsersActiveFilterChips';

export interface AdminUsersActiveFilterChipsProps {
	chips: AdminUsersFilterChipDef[];
	onClearChip: (chipId: string) => void;
	onClearAll?: () => void;
}

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

function chipLabel(
	t: TFunction<'desktopUi'>,
	def: AdminUsersFilterChipDef
): string {
	const raw = def.labelParams?.value;
	if (raw?.startsWith('adminUsersHub.')) {
		return t(def.labelKey, { value: t(raw) });
	}
	if (def.id === 'role' && def.labelParams?.role) {
		return t(def.labelKey, {
			role: adminUserRoleLabelI18n(def.labelParams.role, t),
		});
	}
	return t(def.labelKey, def.labelParams);
}

export function AdminUsersActiveFilterChips({
	chips,
	onClearChip,
	onClearAll,
}: AdminUsersActiveFilterChipsProps): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	if (chips.length === 0) return null;
	return (
		<fieldset className="eliteew-admin-active-filters flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0">
			<legend className={`${uiCaption} sr-only`}>
				{t('adminUsersHub.chips.legend')}
			</legend>
			<span className={uiCaption} aria-hidden>
				{t('adminUsersHub.chips.legend')}:
			</span>
			{chips.map((chip) => (
				<button
					key={chip.id}
					type="button"
					onClick={() => onClearChip(chip.id)}
					className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-100 hover:bg-violet-500/20"
					title={t('adminUsersHub.filters.clearAll')}
				>
					{chipLabel(t, chip)}
					<XMarkIcon className="h-3 w-3 opacity-80" aria-hidden />
				</button>
			))}
			{onClearAll ? (
				<button
					type="button"
					onClick={onClearAll}
					className="text-xs text-[var(--admin-ui-fg-muted)] underline-offset-2 hover:text-[var(--admin-ui-fg)] hover:underline"
				>
					{t('adminUsersHub.filters.clearAll')}
				</button>
			) : null}
		</fieldset>
	);
}
